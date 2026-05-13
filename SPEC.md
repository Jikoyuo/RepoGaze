# RepoGaze - Architecture Forensics Engine

## Overview
RepoGaze transforms legacy spaghetti code into dynamic visual architecture maps powered by Gemini 1.5 Pro. Entry for Google Challenge 2026.

## Tech Stack
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS + Framer Motion + React Flow
- **Backend**: Go + Gin + Google AI Studio (Gemini 1.5 Pro)
- **API Key**: `GOOGLE_API_KEY` environment variable

## Design Language: "Aetheric Minimalist"
- **Palette**: Clean white (#FFFFFF) background, Google Blue accents (#4285F4), glassmorphism overlays
- **Typography**: Inter, system-ui fallback
- **Motion**: Butter-smooth Framer Motion animations (0.3s ease-out default)

## Core Features

### 1. Liquid Dropzone
- Drag & drop zone with liquid/blob reactive effects
- Glassmorphism container with subtle blur
- Particles floating in background
- Accepts zip files or multiple code files
- Visual feedback on drag-over (pulsing glow, scale up)

### 2. Neural Pulse Animation
- Particle system during AI analysis
- Blue gradient particles representing data flow
- Pulsing dots that "weave" together
- Smooth loading without progress bars

### 3. Architecture Visualization (React Flow)
- Custom nodes with language icons (Go, TS, Python, etc.)
- Staggered node entrance animation (appear one-by-one)
- Edge "electric flow" animation (dashed line animation)
- Physics-based dragging
- Smooth zoom/pan with minimap
- Click node → slide-in detail panel with AI explanation

### 4. AI Analysis Pipeline
- Go backend: receives code, forwards to Gemini API
- Returns structured JSON: nodes, edges, relationships, summaries
- Stateless processing (no file persistence)

## Project Structure
```
D:\FlowReconstruct\
├── frontend/          # Next.js app
│   ├── app/
│   ├── components/
│   │   ├── DropZone/
│   │   ├── NeuralPulse/
│   │   ├── ArchitectureGraph/
│   │   └── ui/
│   ├── lib/
│   └── package.json
├── backend/           # Go service
│   ├── main.go
│   ├── handlers/
│   ├── services/
│   └── go.mod
└── SPEC.md
```

## API Contract
### POST /api/analyze
**Request**: multipart/form-data with code files
**Response**:
```json
{
  "nodes": [
    {
      "id": "func_1",
      "label": "ProcessUserData",
      "type": "function",
      "language": "typescript",
      "summary": "Validates and transforms user input",
      "position": { "x": 100, "y": 200 }
    }
  ],
  "edges": [
    { "from": "func_1", "to": "func_2", "label": "calls" }
  ],
  "metadata": {
    "totalFiles": 42,
    "languages": ["typescript", "python"],
    "summary": "User authentication microservice"
  }
}
```

## Quality Gates
- [ ] Liquid dropzone responds to drag events with fluid animation
- [ ] Neural pulse plays during API call
- [ ] Nodes appear with staggered animation
- [ ] Edges animate with flowing dash pattern
- [ ] Click node → detail panel slides in with blur effect
- [ ] Smooth zoom/pan on React Flow canvas
- [ ] Error states handled gracefully
- [ ] Mobile responsive
