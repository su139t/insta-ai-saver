# 🚀 Insta AI Saver

An AI-powered Chrome Extension that lets you save Instagram reels and
posts, process them with AI, and search them later using natural
language.

## Features

-   Detect Instagram **Save** and **Unsave**
-   Extract:
    -   Logged-in user
    -   Creator username
    -   Post/Reel URL
    -   Caption
-   Save metadata to MongoDB
-   Remove metadata on unsave
-   Popup search UI with real-time search
-   Python AI engine for media processing

## Architecture

``` text
Instagram
    │
    ▼
Chrome Extension (Manifest V3)
    │
Content Script
    │
Background Service Worker
    │
Next.js API
    │
MongoDB
    │
Python AI Engine (FastAPI)
    │
AI Processing
```

## Tech Stack

### Extension

-   Manifest V3
-   JavaScript
-   HTML
-   CSS

### Backend

-   Next.js
-   TypeScript
-   MongoDB
-   Mongoose

### AI Engine

-   Python
-   FastAPI
-   yt-dlp
-   OpenCV
-   Faster-Whisper
-   EasyOCR
-   Sentence Transformers

## Project Structure

``` text
insta-ai-saver/
│
├── extension/
│   ├── manifest.json
│   ├── content.js
│   ├── background.js
│   ├── popup.html
│   ├── popup.js
│   └── styles.css
│
├── backend/
│
├── insta-ai-engine/
│   ├── main.py
│   ├── downloads/
│   └── venv/
│
└── README.md
```

## Workflow

1.  User clicks **Save** on Instagram.
2.  Extension extracts metadata.
3.  Background script collects Instagram cookies.
4.  Metadata is sent to the Next.js backend.
5.  Metadata is stored in MongoDB.
6.  Python AI engine downloads media.
7.  Future AI processing generates transcripts, OCR, embeddings, and
    semantic search indexes.

## Installation

### Backend

``` bash
npm install
npm run dev
```

### AI Engine

``` bash
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn yt-dlp faster-whisper easyocr opencv-python sentence-transformers
uvicorn main:app --reload --port 8000
or
venv/bin/python -m uvicorn main:app --reload --port 8000
```

### Chrome Extension

1.  Open `chrome://extensions`
2.  Enable **Developer Mode**
3.  Click **Load unpacked**
4.  Select the extension folder

## Current Status

  Feature              Status
  -------------------- --------
  Save Detection       ✅
  Unsave Detection     ✅
  Caption Extraction   ✅
  MongoDB Storage      ✅
  Search API           ✅
  Popup Search         ✅
  AI Engine            ✅
  Media Download       🚧
  OCR                  ⏳
  Whisper              ⏳
  Vision AI            ⏳
  Embeddings           ⏳
  Semantic Search      ⏳

## Roadmap

-   OCR for image posts
-   Whisper transcription for reels
-   Video understanding
-   Vector embeddings
-   Semantic search
-   AI tagging
-   Cloud sync

## License

MIT
