#!/bin/bash
# Simple script to restart backend after fixing linkedin_sender_id issue
# Just run: ./RUN_THESE_COMMANDS.sh

echo "🔄 Step 1: Killing existing backend..."
pkill -f "tsx watch"
sleep 2

echo "✅ Step 2: Starting backend with new code..."
cd "/Users/satyasharma/Documents/Cursor Codes/Converso-AI-Platform/Converso-backend"
npm run dev

# Backend will now run with enhanced debugging
# Watch for logs showing:
# - [SYNC DEBUG] messages
# - [Unipile] Fetching LinkedIn profile for provider_id: ...
# - [LinkedIn Sync] ✓ Enriched profile ...
