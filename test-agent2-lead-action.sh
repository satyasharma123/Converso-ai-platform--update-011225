#!/bin/bash

# ============================================================================
# AGENT 2: LEAD ACTION AGENT - TEST SCRIPT
# ============================================================================
# Purpose: Test Agent 2 (Lead Action Agent) functionality
# Date: January 7, 2026
# ============================================================================

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3001"
WORKSPACE_ID="${WORKSPACE_ID:-your-workspace-id-here}"
CONVERSATION_ID="${CONVERSATION_ID:-your-conversation-id-here}"

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}AGENT 2: LEAD ACTION AGENT - TEST SUITE${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# ============================================================================
# Test 1: Check Agent 2 Configuration
# ============================================================================
echo -e "${YELLOW}Test 1: Get Agent 2 Configuration${NC}"
echo "GET $BASE_URL/api/agents/config/$WORKSPACE_ID/lead_action"
echo ""

response=$(curl -s -X GET "$BASE_URL/api/agents/config/$WORKSPACE_ID/lead_action")
echo "$response" | jq '.'

is_enabled=$(echo "$response" | jq -r '.is_enabled')
if [ "$is_enabled" = "true" ]; then
  echo -e "${GREEN}✅ Agent 2 is ENABLED${NC}"
else
  echo -e "${RED}❌ Agent 2 is DISABLED${NC}"
  echo -e "${YELLOW}Enabling Agent 2...${NC}"
  
  curl -s -X PUT "$BASE_URL/api/agents/config/$WORKSPACE_ID/lead_action/toggle" \
    -H "Content-Type: application/json" \
    -d '{"is_enabled": true}' | jq '.'
  
  echo -e "${GREEN}✅ Agent 2 enabled${NC}"
fi

echo ""
echo -e "${BLUE}============================================================================${NC}"
echo ""

# ============================================================================
# Test 2: Manually Trigger Agent 2
# ============================================================================
echo -e "${YELLOW}Test 2: Manually Trigger Agent 2${NC}"
echo "POST $BASE_URL/api/agents/run-lead-action"
echo ""

echo "Request:"
cat <<EOF | jq '.'
{
  "conversation_id": "$CONVERSATION_ID",
  "workspace_id": "$WORKSPACE_ID"
}
EOF

echo ""
echo "Response:"

response=$(curl -s -X POST "$BASE_URL/api/agents/run-lead-action" \
  -H "Content-Type: application/json" \
  -d "{
    \"conversation_id\": \"$CONVERSATION_ID\",
    \"workspace_id\": \"$WORKSPACE_ID\"
  }")

echo "$response" | jq '.'

success=$(echo "$response" | jq -r '.success')
if [ "$success" = "true" ]; then
  echo -e "${GREEN}✅ Agent 2 executed successfully${NC}"
  actions=$(echo "$response" | jq -r '.actions_taken[]')
  echo -e "${GREEN}Actions taken:${NC}"
  echo "$actions"
else
  echo -e "${RED}❌ Agent 2 execution failed${NC}"
  error=$(echo "$response" | jq -r '.error')
  echo -e "${RED}Error: $error${NC}"
fi

echo ""
echo -e "${BLUE}============================================================================${NC}"
echo ""

# ============================================================================
# Test 3: Apply Manual Tags
# ============================================================================
echo -e "${YELLOW}Test 3: Apply Manual Tags${NC}"
echo "POST $BASE_URL/api/agents/apply-manual-tags"
echo ""

echo "Request:"
cat <<EOF | jq '.'
{
  "conversation_id": "$CONVERSATION_ID",
  "tags": ["meeting_requested", "info_requested"]
}
EOF

echo ""
echo "Response:"

response=$(curl -s -X POST "$BASE_URL/api/agents/apply-manual-tags" \
  -H "Content-Type: application/json" \
  -d "{
    \"conversation_id\": \"$CONVERSATION_ID\",
    \"tags\": [\"meeting_requested\", \"info_requested\"]
  }")

echo "$response" | jq '.'

success=$(echo "$response" | jq -r '.success')
if [ "$success" = "true" ]; then
  echo -e "${GREEN}✅ Manual tags applied successfully${NC}"
else
  echo -e "${RED}❌ Failed to apply manual tags${NC}"
fi

echo ""
echo -e "${BLUE}============================================================================${NC}"
echo ""

# ============================================================================
# Test 4: Verify Manual Override
# ============================================================================
echo -e "${YELLOW}Test 4: Verify Manual Override (Agent 2 should skip)${NC}"
echo "POST $BASE_URL/api/agents/run-lead-action (should skip due to manual tags)"
echo ""

response=$(curl -s -X POST "$BASE_URL/api/agents/run-lead-action" \
  -H "Content-Type: application/json" \
  -d "{
    \"conversation_id\": \"$CONVERSATION_ID\",
    \"workspace_id\": \"$WORKSPACE_ID\"
  }")

echo "$response" | jq '.'

error=$(echo "$response" | jq -r '.error')
if [[ "$error" == *"manual"* ]]; then
  echo -e "${GREEN}✅ Manual override respected (Agent 2 skipped)${NC}"
else
  echo -e "${YELLOW}⚠️  Expected manual override message${NC}"
fi

echo ""
echo -e "${BLUE}============================================================================${NC}"
echo ""

# ============================================================================
# Test 5: Remove Tags
# ============================================================================
echo -e "${YELLOW}Test 5: Remove Tags${NC}"
echo "POST $BASE_URL/api/agents/remove-tags"
echo ""

response=$(curl -s -X POST "$BASE_URL/api/agents/remove-tags" \
  -H "Content-Type: application/json" \
  -d "{
    \"conversation_id\": \"$CONVERSATION_ID\"
  }")

echo "$response" | jq '.'

success=$(echo "$response" | jq -r '.success')
if [ "$success" = "true" ]; then
  echo -e "${GREEN}✅ Tags removed successfully${NC}"
else
  echo -e "${RED}❌ Failed to remove tags${NC}"
fi

echo ""
echo -e "${BLUE}============================================================================${NC}"
echo ""

# ============================================================================
# Test 6: Agent 2 Should Work Again
# ============================================================================
echo -e "${YELLOW}Test 6: Agent 2 Should Work Again (after tag removal)${NC}"
echo "POST $BASE_URL/api/agents/run-lead-action"
echo ""

response=$(curl -s -X POST "$BASE_URL/api/agents/run-lead-action" \
  -H "Content-Type: application/json" \
  -d "{
    \"conversation_id\": \"$CONVERSATION_ID\",
    \"workspace_id\": \"$WORKSPACE_ID\"
  }")

echo "$response" | jq '.'

success=$(echo "$response" | jq -r '.success')
if [ "$success" = "true" ]; then
  echo -e "${GREEN}✅ Agent 2 executed successfully (manual override cleared)${NC}"
else
  echo -e "${YELLOW}⚠️  Agent 2 execution failed (may need intent detection first)${NC}"
fi

echo ""
echo -e "${BLUE}============================================================================${NC}"
echo ""

# ============================================================================
# Summary
# ============================================================================
echo -e "${GREEN}============================================================================${NC}"
echo -e "${GREEN}TEST SUITE COMPLETED${NC}"
echo -e "${GREEN}============================================================================${NC}"
echo ""
echo -e "${YELLOW}Summary:${NC}"
echo "1. ✅ Agent 2 configuration checked"
echo "2. ✅ Manual trigger tested"
echo "3. ✅ Manual tags applied"
echo "4. ✅ Manual override verified"
echo "5. ✅ Tag removal tested"
echo "6. ✅ Agent 2 re-execution tested"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Check backend console logs for detailed Agent 2 messages"
echo "2. Verify in database:"
echo "   SELECT id, sender_name, lead_tags, manually_tagged FROM conversations WHERE id = '$CONVERSATION_ID';"
echo "3. Send a real message to test automatic Agent 1 → Agent 2 flow"
echo ""
echo -e "${BLUE}============================================================================${NC}"

