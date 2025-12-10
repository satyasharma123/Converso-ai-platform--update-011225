#!/bin/bash
# Quick restart script with enhanced debugging

echo "🔄 Killing old backend process..."
pkill -f "tsx watch"
sleep 2

echo "✅ Starting backend with enhanced debugging..."
cd "/Users/satyasharma/Documents/Cursor Codes/Converso-AI-Platform/Converso-backend"
npm run dev

# Watch for these debug logs:
# [SYNC DEBUG] ========== SAMPLE CHAT STRUCTURE ==========
# [SYNC DEBUG] ========== SAMPLE MESSAGE 1 ==========
# [SYNC DEBUG] ========== MESSAGE PAYLOAD 1 ==========
