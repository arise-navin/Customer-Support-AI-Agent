# Operational Troubleshooting & Diagnostics Guide

**Application:** `signet-customer-support-lab`  
**Environment:** Windows / macOS / Linux, Node.js v24+, PostgreSQL 16+, Ollama  

---

## 1. PostgreSQL Database Issues

### Symptom: Port 5432 Already in Use
```
Error: listen EADDRINUSE: address already in use 127.0.0.1:5432
```
**Resolution:**
1. Check running PostgreSQL processes:
   - Windows PowerShell: `Get-Process -Name postgres -ErrorAction SilentlyContinue | Stop-Process -Force`
   - Linux/macOS: `pkill -u postgres`
2. Restart the embedded PostgreSQL runner:
   ```bash
   node scripts/start-db.js
   ```

### Symptom: WIN1252 Encoding Errors on Currency Symbols
```
Character with byte sequence 0xe2 0x82 0xb9 in encoding "WIN1252" has no equivalent
```
**Resolution:**
- The codebase uses standard ISO currency code `INR` instead of unicode symbols (`₹`) to prevent encoding failures on Windows ANSI database clusters.

### Symptom: Resetting & Re-Seeding Database
```bash
npx prisma migrate reset --force
npm run seed -w @signet/database
```

---

## 2. Ollama LLM Connection Issues

### Symptom: Ollama Service Unreachable
```
SignetGatewayError / FetchError: connect ECONNREFUSED 127.0.0.1:11434
```
**Resolution:**
1. Ensure the Ollama daemon is running:
   ```bash
   ollama serve
   ```
2. Check health endpoint in browser: `http://localhost:11434/api/tags`
3. Verify model availability:
   ```bash
   ollama list
   ollama pull beam:cloud
   ```

### Symptom: LLM Timeout (Prompt Takes Longer than 120s)
- Increase `OLLAMA_TIMEOUT_MS` in `.env`:
  ```env
  OLLAMA_TIMEOUT_MS=180000
  ```

---

## 3. Signet Gateway & Governance Diagnostics

### Symptom: Signet Gateway Returns 502 / 503 Fail-Closed Error
```
SignetGatewayError [503]: Failed to communicate with Signet Gateway at http://localhost:8080. Request blocked (fail-closed).
```
**Resolution:**
- This is intentional **fail-closed behavior**. The application strictly avoids silent fallback to unmonitored Ollama when in `SIGNET_REAL` mode.
- If running without an external Signet Gateway, switch the execution mode to `SIGNET_MOCK` or `DIRECT_OLLAMA` via the UI at `/signet-settings` or via API:
  ```bash
  curl -X PATCH http://localhost:3001/api/v1/signet/config -H "Content-Type: application/json" -d '{"executionMode":"SIGNET_MOCK"}'
  ```

### Symptom: Agent Blocked by Emergency Kill Switch
```
Execution blocked: Agent 'support-agent-001' has been terminated by the administrative Kill Switch.
```
**Resolution:**
- Open the Kill Switch Dashboard at `/kill-switch` and click **Restore**, or restore via API:
  ```bash
  curl -X POST http://localhost:3001/api/v1/signet/kill-switch -H "Content-Type: application/json" -d '{"agentId":"support-agent-001","action":"RESTORE"}'
  ```
