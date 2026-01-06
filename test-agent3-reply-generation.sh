#!/bin/bash

# Test Script for Agent 3 - Reply Generation
# Run this after the backend is running

echo "🧪 Testing Agent 3: Reply Generation Implementation"
echo "===================================================="
echo ""

# Configuration
BACKEND_URL="http://localhost:3001"
WORKSPACE_ID="eaf12104-abe4-4518-9bb5-f598c2a22053"
CONVERSATION_ID="cd34714c-f3f6-378e-ee42-e7cb7618867d"
USER_ID="test-user-123"

echo "📋 Test 1: Get Reply Generation Configuration (Admin)"
echo "-------------------------------------------------------"
curl -X GET "$BACKEND_URL/api/agents/reply-config/$WORKSPACE_ID?user_role=admin"
echo -e "\n"

echo ""
echo "📋 Test 2: Get Reply Generation Configuration (SDR)"
echo "-------------------------------------------------------"
curl -X GET "$BACKEND_URL/api/agents/reply-config/$WORKSPACE_ID?user_role=sdr"
echo -e "\n"

echo ""
echo "📋 Test 3: Enable Agent 3 for Workspace"
echo "-------------------------------------------------------"
curl -X PUT "$BACKEND_URL/api/agents/config/$WORKSPACE_ID/reply_generation/toggle" \
  -H "Content-Type: application/json" \
  -d '{"is_enabled": true}'
echo -e "\n"

echo ""
echo "📋 Test 4: Generate Reply Draft (Meeting Request)"
echo "-------------------------------------------------------"
curl -X POST "$BACKEND_URL/api/agents/generate-reply" \
  -H "Content-Type: application/json" \
  -d "{
    \"conversation_id\": \"$CONVERSATION_ID\",
    \"workspace_id\": \"$WORKSPACE_ID\",
    \"user_id\": \"$USER_ID\",
    \"user_role\": \"admin\",
    \"conversation_history\": {
      \"sender_name\": \"John Doe\",
      \"subject\": \"Meeting Request\",
      \"detected_intent\": \"meeting_request\",
      \"messages\": [
        {
          \"content\": \"Hi, I would like to schedule a demo call. Are you available this week?\",
          \"is_from_lead\": true,
          \"created_at\": \"2026-01-06T10:00:00Z\"
        }
      ]
    }
  }"
echo -e "\n"

echo ""
echo "📋 Test 5: Generate Reply Draft (Pricing Inquiry)"
echo "-------------------------------------------------------"
curl -X POST "$BACKEND_URL/api/agents/generate-reply" \
  -H "Content-Type: application/json" \
  -d "{
    \"conversation_id\": \"$CONVERSATION_ID\",
    \"workspace_id\": \"$WORKSPACE_ID\",
    \"user_id\": \"$USER_ID\",
    \"user_role\": \"admin\",
    \"conversation_history\": {
      \"sender_name\": \"Jane Smith\",
      \"subject\": \"Pricing Question\",
      \"detected_intent\": \"pricing_inquiry\",
      \"messages\": [
        {
          \"content\": \"Hi, I'm interested in your product. How much does it cost per month?\",
          \"is_from_lead\": true,
          \"created_at\": \"2026-01-06T11:00:00Z\"
        }
      ]
    }
  }"
echo -e "\n"

echo ""
echo "📋 Test 6: Regenerate Reply Draft"
echo "-------------------------------------------------------"
curl -X POST "$BACKEND_URL/api/agents/regenerate-reply" \
  -H "Content-Type: application/json" \
  -d "{
    \"conversation_id\": \"$CONVERSATION_ID\",
    \"workspace_id\": \"$WORKSPACE_ID\",
    \"user_id\": \"$USER_ID\",
    \"user_role\": \"admin\",
    \"conversation_history\": {
      \"sender_name\": \"John Doe\",
      \"subject\": \"Demo Request\",
      \"detected_intent\": \"demo_request\",
      \"messages\": [
        {
          \"content\": \"Can you show me a demo? I would love to see your platform in action.\",
          \"is_from_lead\": true,
          \"created_at\": \"2026-01-06T12:00:00Z\"
        }
      ]
    }
  }"
echo -e "\n"

echo ""
echo "📋 Test 7: Test SDR Permission (Should Fail if allow_sdr_access=false)"
echo "-------------------------------------------------------"
curl -X POST "$BACKEND_URL/api/agents/generate-reply" \
  -H "Content-Type: application/json" \
  -d "{
    \"conversation_id\": \"$CONVERSATION_ID\",
    \"workspace_id\": \"$WORKSPACE_ID\",
    \"user_id\": \"$USER_ID\",
    \"user_role\": \"sdr\",
    \"conversation_history\": {
      \"sender_name\": \"Test Lead\",
      \"subject\": \"Info Request\",
      \"detected_intent\": \"interested\",
      \"messages\": [
        {
          \"content\": \"I'd like more information about your product.\",
          \"is_from_lead\": true,
          \"created_at\": \"2026-01-06T13:00:00Z\"
        }
      ]
    }
  }"
echo -e "\n"

echo ""
echo "📋 Test 8: Update Configuration (Enable SDR Access)"
echo "-------------------------------------------------------"
curl -X PUT "$BACKEND_URL/api/agents/reply-config/$WORKSPACE_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_role\": \"admin\",
    \"config_data\": {
      \"mode\": \"draft_only\",
      \"allow_sdr_access\": true,
      \"required_tags\": [\"meeting_requested\", \"info_requested\"],
      \"safety_rules\": {
        \"no_commitments\": true,
        \"no_pricing\": true,
        \"no_calendar_links\": true,
        \"no_legal_medical_financial\": true
      },
      \"tone\": \"friendly\",
      \"max_draft_length\": 800,
      \"include_signature\": true
    }
  }"
echo -e "\n"

echo ""
echo "📋 Test 9: Test SDR Permission Again (Should Succeed Now)"
echo "-------------------------------------------------------"
curl -X POST "$BACKEND_URL/api/agents/generate-reply" \
  -H "Content-Type: application/json" \
  -d "{
    \"conversation_id\": \"$CONVERSATION_ID\",
    \"workspace_id\": \"$WORKSPACE_ID\",
    \"user_id\": \"$USER_ID\",
    \"user_role\": \"sdr\",
    \"conversation_history\": {
      \"sender_name\": \"Test Lead\",
      \"subject\": \"Info Request\",
      \"detected_intent\": \"interested\",
      \"messages\": [
        {
          \"content\": \"I'd like more information about your product.\",
          \"is_from_lead\": true,
          \"created_at\": \"2026-01-06T13:00:00Z\"
        }
      ]
    }
  }"
echo -e "\n"

echo ""
echo "===================================================="
echo "✅ Tests Complete!"
echo ""
echo "Next Steps:"
echo "1. Check console logs in your backend terminal"
echo "2. Look for: '[Agent 3] ✅ Reply generated successfully'"
echo "3. Verify response contains reply_draft and metadata"
echo "4. Test with different intents and conversation contexts"
echo "5. Verify safety guardrails are working"
echo ""

