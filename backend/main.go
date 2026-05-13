package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

type AnalysisNode struct {
	ID       string `json:"id"`
	Label    string `json:"label"`
	Type     string `json:"type"`
	Language string `json:"language"`
	Summary  string `json:"summary"`
	Position struct {
		X float64 `json:"x"`
		Y float64 `json:"y"`
	} `json:"position"`
}

type AnalysisEdge struct {
	From  string `json:"from"`
	To    string `json:"to"`
	Label string `json:"label"`
}

type AnalysisMetadata struct {
	TotalFiles int      `json:"totalFiles"`
	Languages  []string `json:"languages"`
	Summary    string   `json:"summary"`
}

type AnalysisResponse struct {
	Nodes    []AnalysisNode   `json:"nodes"`
	Edges    []AnalysisEdge   `json:"edges"`
	Metadata AnalysisMetadata `json:"metadata"`
}

func main() {
	// Load .env file — try cwd first, then the directory of the executable
	godotenv.Load()
	if os.Getenv("GOOGLE_API_KEY") == "" {
		if exePath, err := os.Executable(); err == nil {
			godotenv.Load(filepath.Join(filepath.Dir(exePath), ".env"))
		}
	}

	r := gin.Default()

	// CORS middleware
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "POST, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	r.POST("/api/analyze", handleAnalyze)
	r.POST("/api/github", handleGitHub)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("RepoGaze backend starting on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func handleAnalyze(c *gin.Context) {
	apiKey := os.Getenv("GOOGLE_API_KEY")
	if apiKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "GOOGLE_API_KEY not configured"})
		return
	}

	if err := c.Request.ParseMultipartForm(100 << 20); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse form data"})
		return
	}

	form := c.Request.MultipartForm
	if form == nil || form.File == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No files uploaded"})
		return
	}

	var codeContents []string
	var languages []string
	files := form.File["files"]

	for _, fileHeader := range files {
		ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
		lang := getLanguageFromExt(ext)
		if lang == "" {
			continue
		}

		if !contains(languages, lang) {
			languages = append(languages, lang)
		}

		file, err := fileHeader.Open()
		if err != nil {
			continue
		}
		defer file.Close()

		content, err := io.ReadAll(file)
		if err != nil {
			continue
		}
		codeContents = append(codeContents, fmt.Sprintf("=== %s (%s) ===\n%s", fileHeader.Filename, lang, string(content)))
	}

	if len(codeContents) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No valid code files found"})
		return
	}

	result, err := analyzeWithGemini(c.Request.Context(), apiKey, strings.Join(codeContents, "\n\n"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Analysis failed: %v", err)})
		return
	}

	result.Metadata.TotalFiles = len(files)
	result.Metadata.Languages = languages

	c.JSON(http.StatusOK, result)
}

func analyzeWithGemini(ctx context.Context, apiKey string, code string) (*AnalysisResponse, error) {
	model := "gemini-flash-latest"

	prompt := fmt.Sprintf(`You are an architecture forensics engine. Analyze the following code and produce a structured JSON response describing the architecture.

The code may contain multiple files in different programming languages. Your task is to:
1. Identify key functions, classes, modules, and their relationships
2. Map dependencies and call flows
3. Generate a visual graph representation

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation, just pure JSON):
{
  "nodes": [
    {
      "id": "unique_id",
      "label": "display_name",
      "type": "function|class|module|file|interface",
      "language": "typescript|python|go|javascript|java|rust|cpp",
      "summary": "brief_one_sentence_description",
      "position": {"x": number, "y": number}
    }
  ],
  "edges": [
    {
      "from": "source_node_id",
      "to": "target_node_id",
      "label": "calls|imports|extends|implements|uses"
    }
  ],
  "metadata": {
    "totalFiles": 0,
    "languages": [],
    "summary": "overall_project_description"
  }
}

Rules:
- Use semantic IDs like "func_1", "class_auth", "mod_main"
- Position nodes in a readable layout (x: 50-800, y: 50-600 range)
- Limit to max 15 nodes for clarity
- Focus on the most important architectural components
- Edge labels should describe the relationship type

CODE TO ANALYZE:
%s

Return only the JSON response:`, code)

	payload := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"parts": []map[string]interface{}{
					{"text": prompt},
				},
			},
		},
		"generationConfig": map[string]interface{}{
			"temperature":     0.3,
			"maxOutputTokens": 8192,
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, apiKey)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call Gemini API: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Gemini API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	var geminiResp struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}

	if err := json.Unmarshal(respBody, &geminiResp); err != nil {
		return nil, fmt.Errorf("failed to parse Gemini response: %w", err)
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("empty response from Gemini")
	}

	responseText := geminiResp.Candidates[0].Content.Parts[0].Text

	responseText = strings.TrimSpace(responseText)
	responseText = strings.TrimPrefix(responseText, "```json")
	responseText = strings.TrimPrefix(responseText, "```")
	responseText = strings.TrimSuffix(responseText, "```")
	responseText = strings.TrimSpace(responseText)

	var result AnalysisResponse
	if err := json.Unmarshal([]byte(responseText), &result); err != nil {
		return nil, fmt.Errorf("failed to parse analysis result: %w", err)
	}

	return &result, nil
}

func getLanguageFromExt(ext string) string {
	langMap := map[string]string{
		".ts":    "typescript",
		".tsx":   "typescript",
		".js":    "javascript",
		".jsx":   "javascript",
		".py":    "python",
		".go":    "go",
		".java":  "java",
		".rs":    "rust",
		".cpp":   "cpp",
		".c":     "c",
		".cs":    "csharp",
		".rb":    "ruby",
		".php":   "php",
		".swift": "swift",
		".kt":    "kotlin",
		".scala": "scala",
	}
	return langMap[ext]
}

func contains(slice []string, item string) bool {
	return slices.Contains(slice, item)
}

func handleGitHub(c *gin.Context) {
	var req struct {
		URL string `json:"url" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "URL is required"})
		return
	}

	log.Printf("Received GitHub URL: %s", req.URL)

	// Parse GitHub URL to extract owner, repo, and branch/path
	// Use greedy match to capture full repo name
	re := regexp.MustCompile(`github\.com/([^/]+)/([^/]+)(?:\.git)?`)
	matches := re.FindStringSubmatch(req.URL)

	log.Printf("Regex matches: %v (len=%d)", matches, len(matches))

	if len(matches) < 3 || matches[2] == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid GitHub URL format"})
		return
	}

	owner := matches[1]
	repo := strings.TrimSuffix(matches[2], ".git")
	branch := "main"

	// Check if URL has tree/branch specification
	treeMatch := regexp.MustCompile(`github\.com/[^/]+/[^/]+/tree/([^/]+)`)
	if tm := treeMatch.FindStringSubmatch(req.URL); len(tm) > 1 {
		branch = tm[1]
	}
	if len(matches) > 3 && matches[3] != "" {
		branch = matches[3]
	}

	log.Printf("Parsed: owner=%s, repo=%s, branch=%s", owner, repo, branch)

	// Try common branch names if main doesn't work
	branches := []string{branch, "main", "master"}
	var treeResp struct {
		Tree []struct {
			Path string `json:"path"`
			Type string `json:"type"`
			SHA  string `json:"sha"`
		} `json:"tree"`
	}
	var foundBranch string

	for _, b := range branches {
		apiURL := fmt.Sprintf("https://api.github.com/repos/%s/%s/git/trees/%s?recursive=1", owner, repo, b)
		log.Printf("Trying branch '%s': %s", b, apiURL)

		reqGit, err := http.NewRequestWithContext(c.Request.Context(), "GET", apiURL, nil)
		if err != nil {
			log.Printf("Error creating request for branch %s: %v", b, err)
			continue
		}
		reqGit.Header.Set("User-Agent", "RepoGaze")
		reqGit.Header.Set("Accept", "application/vnd.github.v3+json")
		if token := os.Getenv("GITHUB_TOKEN"); token != "" {
			reqGit.Header.Set("Authorization", "Bearer "+token)
		}

		resp, err := http.DefaultClient.Do(reqGit)
		if err != nil {
			log.Printf("Error fetching branch %s: %v", b, err)
			continue
		}

		if resp.StatusCode == http.StatusOK {
			if err := json.NewDecoder(resp.Body).Decode(&treeResp); err == nil {
				foundBranch = b
				log.Printf("Found valid branch: %s with %d files", b, len(treeResp.Tree))
				resp.Body.Close()
				break
			}
		} else {
			log.Printf("Branch %s returned status: %d", b, resp.StatusCode)
		}
		resp.Body.Close()
	}

	if foundBranch == "" {
		log.Printf("No valid branch found for %s/%s", owner, repo)
		c.JSON(http.StatusNotFound, gin.H{"error": "Repository not found or no code files available"})
		return
	}

	log.Printf("Fetching files from %s/%s (branch: %s)", owner, repo, foundBranch)

	// Filter code files and fetch their content
	codeExtensions := map[string]bool{
		".ts": true, ".tsx": true, ".js": true, ".jsx": true,
		".py": true, ".go": true, ".java": true, ".rs": true,
		".cpp": true, ".c": true, ".cs": true, ".rb": true,
		".php": true, ".swift": true, ".kt": true, ".scala": true,
	}

	files := make(map[string]string)
	maxFiles := 25 // Limit files
	maxFileSize := 80000 // 80KB per file

	for _, item := range treeResp.Tree {
		if len(files) >= maxFiles {
			break
		}

		ext := filepath.Ext(item.Path)
		if !codeExtensions[ext] || item.Type != "blob" {
			continue
		}

		// Skip test files and vendor directories
		if strings.Contains(item.Path, "/test") || strings.Contains(item.Path, "/vendor") ||
		   strings.Contains(item.Path, "/node_modules") || strings.Contains(item.Path, "_test.") {
			continue
		}

		rawURL := fmt.Sprintf("https://raw.githubusercontent.com/%s/%s/%s/%s", owner, repo, foundBranch, item.Path)
		fileReq, _ := http.NewRequestWithContext(c.Request.Context(), "GET", rawURL, nil)
		fileReq.Header.Set("User-Agent", "RepoGaze")
		if token := os.Getenv("GITHUB_TOKEN"); token != "" {
			fileReq.Header.Set("Authorization", "Bearer "+token)
		}

		fileResp, err := http.DefaultClient.Do(fileReq)
		if err != nil {
			continue
		}

		if fileResp.StatusCode == http.StatusOK {
			content, _ := io.ReadAll(io.LimitReader(fileResp.Body, int64(maxFileSize)))
			fileResp.Body.Close()

			if len(content) < maxFileSize {
				files[item.Path] = string(content)
			}
		} else {
			fileResp.Body.Close()
		}
	}

	if len(files) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "No code files found in repository"})
		return
	}

	log.Printf("Fetched %d files from %s/%s", len(files), owner, repo)
	c.JSON(http.StatusOK, gin.H{
		"files":    files,
		"metadata": gin.H{"totalFiles": len(files)},
	})
}
