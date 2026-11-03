# Local Ollama LLM Integration & Setup Guide

**Target LLM Model:** `beam:cloud` (matches prompt's `beam:cloude` / `beam`)  
**Service Endpoint:** `http://localhost:11434`  
**Timeout Budget:** 120,000 ms (configurable via `OLLAMA_TIMEOUT_MS`)  

---

## 1. Prerequisites & Installation

Ensure Ollama is installed on the host system:

- **Windows:** Download and run the installer from [ollama.com/download/windows](https://ollama.com/download/windows).
- **macOS:** `brew install ollama` or download from [ollama.com](https://ollama.com).
- **Linux:** `curl -fsSL https://ollama.com/install.sh | sh`

Verify the Ollama daemon is active:
```bash
ollama --version
ollama list
```

---

## 2. Model Verification & Verification Test

The application connects to `beam:cloud` by default. Verify the model is pulled locally:
```bash
ollama list | grep beam
```

If the model is not present, pull it:
```bash
ollama pull beam:cloud
```

Test inference directly via HTTP:
```bash
curl http://localhost:11434/api/generate -d '{
  "model": "beam:cloud",
  "prompt": "Hello world",
  "stream": false
}'
```

---

## 3. Supported Model Capabilities

The Node.js `OllamaService` (`apps/backend/src/services/ollama.service.ts`) validates the following capabilities during initialization:

1. **Native Function Calling / Tools:** Employs the Ollama `/api/chat` native `tools` schema with Zod type definitions.
2. **Streaming Tokens:** Streams SSE chunks to the frontend with token usage metadata.
3. **Internal Thinking / Chain of Thought:** Surfaces `<think>...</think>` internal reasoning logs in the UI.
4. **Structured JSON Output:** Formats tool arguments with strict JSON schema validation.

---

## 4. Alternative Model Configuration

If `beam:cloud` is unavailable, specify an alternative model in `.env`:
```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
OLLAMA_TIMEOUT_MS=120000
```

The system will automatically validate the substituted model and adapt tool-calling schemas.
