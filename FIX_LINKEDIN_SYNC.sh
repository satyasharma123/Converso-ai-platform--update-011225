#!/bin/bash

# ============================================
# FIX LINKEDIN NAMES AND DOWNLOAD MESSAGES
# ============================================
# This script will:
# 1. Enrich sender names (fix "LinkedIn Contact")
# 2. Download missing messages from other party

echo "=========================================="
echo "  LinkedIn Sync Fix Script"
echo "=========================================="

# Get the connected account ID from the database
echo ""
echo "Step 1: Getting your LinkedIn connected account ID..."
echo ""

# You need to get your connectedAccountId from Supabase
# Run this SQL in Supabase SQL Editor:
# SELECT id FROM connected_accounts WHERE account_type = 'linkedin' LIMIT 1;

# Replace YOUR_CONNECTED_ACCOUNT_ID with your actual ID
CONNECTED_ACCOUNT_ID="YOUR_CONNECTED_ACCOUNT_ID"

if [ "$CONNECTED_ACCOUNT_ID" = "YOUR_CONNECTED_ACCOUNT_ID" ]; then
  echo "ERROR: Please edit this script and replace YOUR_CONNECTED_ACCOUNT_ID"
  echo ""
  echo "To find your ID, run this SQL in Supabase:"
  echo "  SELECT id FROM connected_accounts WHERE account_type = 'linkedin' LIMIT 1;"
  echo ""
  exit 1
fi

# Backend URL
BACKEND_URL="http://localhost:3001"

echo "Using Connected Account ID: $CONNECTED_ACCOUNT_ID"
echo ""

# Step 2: Enrich sender names from attendee data
echo "Step 2: Enriching sender names (fixing 'LinkedIn Contact')..."
curl -X POST "$BACKEND_URL/api/linkedin/sync/action2" \
  -H "Content-Type: application/json" \
  -d "{}"
echo ""
echo ""

# Step 3: Enrich profile pictures
echo "Step 3: Enriching profile pictures..."
curl -X POST "$BACKEND_URL/api/linkedin/sync/action3" \
  -H "Content-Type: application/json" \
  -d "{}"
echo ""
echo ""

# Step 4: Download missing messages
echo "Step 4: Downloading missing messages..."
curl -X POST "$BACKEND_URL/api/linkedin/sync/action4" \
  -H "Content-Type: application/json" \
  -d "{\"connectedAccountId\": \"$CONNECTED_ACCOUNT_ID\"}"
echo ""
echo ""

echo "=========================================="
echo "  Sync Complete!"
echo "=========================================="
echo ""
echo "Now refresh your browser (Cmd + Shift + R)"
echo "The names and messages should be fixed."
