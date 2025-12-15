#!/bin/bash

# LinkedIn Webhook Tunnel Setup Script
# This script starts ngrok on the correct port (3001 - backend API)

echo "🚀 Starting LinkedIn Webhook Tunnel..."
echo ""
echo "📋 Configuration:"
echo "   Backend API: http://localhost:3001"
echo "   Forwarding to: Backend API (port 3001)"
echo ""
echo "⚠️  IMPORTANT: After ngrok starts, you need to:"
echo "   1. Copy the HTTPS forwarding URL (e.g., https://xxx.ngrok-free.app)"
echo "   2. Go to Unipile Dashboard: https://dashboard.unipile.com"
echo "   3. Navigate to: Settings → Webhooks"
echo "   4. Update webhook URL to: https://xxx.ngrok-free.app/api/linkedin/webhook"
echo "   5. Save changes"
echo ""
echo "🔍 Testing:"
echo "   - Send a LinkedIn message to your connected account"
echo "   - Check backend logs for: [Webhook] Received event"
echo "   - Check frontend console for: [SSE] Received linkedin_message event"
echo "   - Verify unread badge appears on conversation"
echo ""
echo "Starting ngrok tunnel..."
echo ""

# Start ngrok on port 3001 (backend API)
ngrok http 3001
