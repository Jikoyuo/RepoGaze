# RepoGaze - Architecture Forensics Engine

Transform spaghetti code into visual architecture maps powered by Gemini 1.5 Pro.

![RepoGaze](https://img.shields.io/badge/Google%20Challenge-2026-blue)
![Powered by Gemini](https://img.shields.io/badge/Powered%20by-Gemini%201.5%20Pro-green)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![Go](https://img.shields.io/badge/Go-Backend-00ADD8)

## Features

- **Liquid Dropzone**: Animated drag-and-drop zone with blob effects and glassmorphism
- **Neural Pulse Animation**: Particle system visualization during AI analysis
- **Interactive Architecture Map**: React Flow-powered graph with:
  - Staggered node entrance animations
  - Animated edges with flowing dash patterns
  - Smooth zoom/pan with minimap
  - Click-to-reveal detail panels
  - Fullscreen mode
  - JSON export
- **Stateless Security**: All code processed in-memory, never persisted

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 + TypeScript + Tailwind CSS + Framer Motion |
| Visualization | React Flow (@xyflow/react) |
| Backend | Go + Gin |
| AI | Google AI Studio (Gemini 1.5 Pro) |

## Getting Started

### Prerequisites

- Node.js 18+
- Go 1.21+
- Google AI Studio API key

### Environment Setup

1. **Get your API key** from [Google AI Studio](https://aistudio.google.com/app/apikey)

2. **Configure backend** (`backend/.env` or environment variable):
   ```bash
   export GOOGLE_API_KEY=your_api_key_here
   ```

3. **Configure frontend** (copy `.env.example` to `.env.local`):
   ```bash
   cp frontend/.env.example frontend/.env.local
   # Edit .env.local and add your API key
   ```

### Running Locally

**Backend:**
```bash
cd backend
go mod tidy
go run main.go
# Server runs on http://localhost:8080
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# App runs on http://localhost:3000
```

### Development Mode (both simultaneously)

```bash
# Terminal 1 - Backend
cd backend && go run main.go

# Terminal 2 - Frontend
cd frontend && npm run dev
```

## API Endpoints

### POST /api/analyze

Upload code files for architecture analysis.

**Request:**
- Content-Type: `multipart/form-data`
- Body: `files` - one or more code files

**Response:**
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

### GET /health

Health check endpoint.

## Supported Languages

TypeScript, JavaScript, Python, Go, Java, Rust, C/C++, C#, Ruby, PHP, Swift, Kotlin, Scala

## Project Structure

```
.
├── backend/                 # Go backend service
│   ├── main.go             # Entry point + handlers
│   └── go.mod
├── frontend/                # Next.js frontend
│   ├── app/
│   │   ├── page.tsx        # Main page
│   │   ├── layout.tsx      # Root layout
│   │   └── globals.css     # Global styles
│   ├── components/
│   │   ├── DropZone/       # Animated dropzone
│   │   ├── NeuralPulse/    # Particle animation
│   │   └── ArchitectureGraph/ # React Flow graph
│   ├── lib/
│   └── package.json
├── SPEC.md                  # Project specification
└── README.md
```

## Design Principles

The UI follows the **"Aetheric Minimalist"** design language:
- Clean white (#FFFFFF) backgrounds
- Google Blue (#4285F4) accents
- Glassmorphism overlays with subtle blur
- Butter-smooth Framer Motion animations
- Responsive and accessible

## Deployment

### Frontend (Vercel)
```bash
cd frontend
npm run build
vercel deploy
```

### Backend (Cloud Run)
```bash
cd backend
gcloud run deploy repogaze-backend --source .
```

## License

MIT

---

Built with passion for the Google Challenge 2026
