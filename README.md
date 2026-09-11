# PostCraft AI

PostCraft AI is a topical idea engine for creating thoughtful LinkedIn posts.

## Current flow

1. Choose a topic or enter a custom topic.
2. Discover recent stories from Google News RSS.
3. Clean, filter, rank, and diversify the story shortlist.
4. Select one story.
5. Ollama generates three story-specific angles and explains why each is useful.
6. Choose an angle.
7. Ollama generates the LinkedIn post.
8. Copy, regenerate, sharpen, or make the post more human.

## Local setup

Requirements:

- Node.js
- Ollama
- A local Ollama model such as `llama3.2`

Install dependencies:

```bash
npm install
```

Create `.env.local` from `.env.example` and configure Ollama if needed:

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2
```

Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Architecture

```text
Topic
  ↓
Google News RSS
  ↓
Clean + filter + rank + diversify
  ↓
5 story opportunities
  ↓
Selected story
  ↓
Ollama: 3 angles + rationale
  ↓
Selected angle
  ↓
Ollama: LinkedIn post
  ↓
Copy / refine
```

The AI integration is provider-based so another provider can be added later without changing the UI flow.

## Token-efficiency principle

Discovery is handled in code. AI is called only after the user selects a story, and the post is generated only after an angle is selected. The app does not send full articles to the model.


## Workspace

Authenticated users can view saved posts at `/workspace`, filter by status, search saved content, and delete saved posts.
