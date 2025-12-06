# Starting Converso Development Servers

Due to macOS permission restrictions when running servers in the background, please start the servers manually in your terminal.

## Quick Start

### Option 1: Two Terminal Windows (Recommended)

**Terminal 1 - Backend:**
```bash
cd "/Users/satyasharma/Documents/Cursor Codes/Converso-AI-Platform/Converso-backend"
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd "/Users/satyasharma/Documents/Cursor Codes/Converso-AI-Platform/Converso-frontend"
npm run dev
```

### Option 2: Using the Startup Script

```bash
cd "/Users/satyasharma/Documents/Cursor Codes/Converso-AI-Platform"
./start-dev.sh
```

## Access Your Application

Once both servers are running:

- **Frontend:** http://localhost:8082
- **Backend API:** http://localhost:3001
- **Health Check:** http://localhost:3001/health

## Troubleshooting

If you see permission errors:
1. Make sure you're running the commands in your own terminal (not through Cursor's background processes)
2. Check if ports 3001 and 8082 are already in use:
   ```bash
   lsof -i:3001
   lsof -i:8082
   ```
3. Kill any existing processes:
   ```bash
   lsof -ti:3001 | xargs kill -9
   lsof -ti:8082 | xargs kill -9
   ```

## Expected Output

**Backend should show:**
```
🚀 Converso Backend Server running on http://localhost:3001
📊 Health check available at http://localhost:3001/health
```

**Frontend should show:**
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:8082/
  ➜  Network: use --host to expose
```
