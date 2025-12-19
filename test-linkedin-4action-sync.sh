#!/bin/bash

# LinkedIn 4-Action Sync Test Script
# This script helps test the LinkedIn sync implementation

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:3001/api}"
WORKSPACE_ID="${WORKSPACE_ID:-}"
CONNECTED_ACCOUNT_ID="${CONNECTED_ACCOUNT_ID:-}"

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}LinkedIn 4-Action Sync Test Script${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Function to print section header
print_section() {
  echo ""
  echo -e "${GREEN}==> $1${NC}"
  echo ""
}

# Function to make API call and pretty print
api_call() {
  local method=$1
  local endpoint=$2
  local data=$3
  local description=$4
  
  echo -e "${YELLOW}${description}${NC}"
  echo "$ curl -X ${method} '${API_BASE_URL}${endpoint}'"
  
  if [ -n "$data" ]; then
    echo "  Data: ${data}"
    response=$(curl -s -X ${method} "${API_BASE_URL}${endpoint}" \
      -H "Content-Type: application/json" \
      -d "${data}")
  else
    response=$(curl -s -X ${method} "${API_BASE_URL}${endpoint}")
  fi
  
  echo ""
  echo "Response:"
  echo "$response" | jq '.' 2>/dev/null || echo "$response"
  echo ""
}

# Check if jq is installed
if ! command -v jq &> /dev/null; then
  echo -e "${YELLOW}Warning: jq not found. Install it for better JSON formatting: brew install jq${NC}"
  echo ""
fi

# Get workspace ID if not provided
if [ -z "$WORKSPACE_ID" ]; then
  echo -e "${YELLOW}WORKSPACE_ID not set. Trying to fetch...${NC}"
  # This would require auth - skip for now
  echo -e "${RED}Please set WORKSPACE_ID environment variable${NC}"
  echo "Example: export WORKSPACE_ID='your-workspace-uuid'"
  exit 1
fi

print_section "Step 1: Get LinkedIn Accounts"
api_call "GET" "/linkedin/accounts?workspace_id=${WORKSPACE_ID}" "" "Fetching LinkedIn accounts for workspace"

# Extract connected account ID if not provided
if [ -z "$CONNECTED_ACCOUNT_ID" ]; then
  echo -e "${YELLOW}Please enter your Connected Account ID (from above):${NC}"
  read -r CONNECTED_ACCOUNT_ID
  
  if [ -z "$CONNECTED_ACCOUNT_ID" ]; then
    echo -e "${RED}Connected Account ID is required!${NC}"
    exit 1
  fi
fi

export CONNECTED_ACCOUNT_ID

print_section "Step 2: Check Current Sync Status"
api_call "GET" "/linkedin/sync/status?connectedAccountId=${CONNECTED_ACCOUNT_ID}" "" "Getting sync status"

print_section "Step 3: Run Full 4-Action Sync"
echo -e "${YELLOW}Do you want to run a full sync? This will:${NC}"
echo "  - Download all chats (Action 1)"
echo "  - Enrich sender details (Action 2)"
echo "  - Fetch profile pictures (Action 3)"
echo "  - Download all messages (Action 4)"
echo ""
echo -e "${YELLOW}Continue? (y/n)${NC}"
read -r confirm

if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
  api_call "POST" "/linkedin/sync/full" "{\"connectedAccountId\":\"${CONNECTED_ACCOUNT_ID}\"}" "Running full 4-action sync"
else
  echo "Skipped full sync."
fi

print_section "Step 4: Check Updated Sync Status"
api_call "GET" "/linkedin/sync/status?connectedAccountId=${CONNECTED_ACCOUNT_ID}" "" "Getting updated sync status"

print_section "Step 5: Test Individual Actions (Optional)"
echo -e "${YELLOW}Do you want to test individual actions? (y/n)${NC}"
read -r confirm

if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
  
  echo -e "${BLUE}Testing Action 1: Download Chats${NC}"
  api_call "POST" "/linkedin/sync/action1" "{\"connectedAccountId\":\"${CONNECTED_ACCOUNT_ID}\"}" "Action 1: Downloading chats"
  
  echo -e "${BLUE}Testing Action 2: Enrich Senders${NC}"
  api_call "POST" "/linkedin/sync/action2" "" "Action 2: Enriching sender details"
  
  echo -e "${BLUE}Testing Action 3: Enrich Pictures${NC}"
  api_call "POST" "/linkedin/sync/action3" "" "Action 3: Enriching profile pictures"
  
  echo -e "${BLUE}Testing Action 4: Download Messages${NC}"
  api_call "POST" "/linkedin/sync/action4" "{\"connectedAccountId\":\"${CONNECTED_ACCOUNT_ID}\"}" "Action 4: Downloading messages"
  
else
  echo "Skipped individual action tests."
fi

print_section "Step 6: Test Resume Sync"
echo -e "${YELLOW}Do you want to test resume sync? (y/n)${NC}"
read -r confirm

if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
  api_call "POST" "/linkedin/sync/resume" "{\"connectedAccountId\":\"${CONNECTED_ACCOUNT_ID}\"}" "Resuming sync for incomplete items"
else
  echo "Skipped resume sync test."
fi

print_section "Step 7: Final Sync Status"
api_call "GET" "/linkedin/sync/status?connectedAccountId=${CONNECTED_ACCOUNT_ID}" "" "Getting final sync status"

print_section "Test Complete!"
echo -e "${GREEN}All tests completed!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Check your backend logs for detailed sync information"
echo "2. Run SQL queries to verify data quality (see LINKEDIN_4ACTION_QUICKSTART.md)"
echo "3. Test the webhook by sending a LinkedIn DM"
echo "4. Check the UI to see if messages display correctly"
echo ""
echo -e "${GREEN}Success criteria:${NC}"
echo "✓ All actions completed without errors"
echo "✓ Sync status shows 0 pending items"
echo "✓ Zero messages with null sender_name (run SQL query)"
echo "✓ LinkedIn inbox shows conversations and messages"
echo ""



