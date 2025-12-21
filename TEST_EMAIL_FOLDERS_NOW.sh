#!/bin/bash

# Test email folder filtering
# This should show DIFFERENT counts for each folder

echo "=== Testing Email Folder API ==="
echo ""

USER_ID="5a8d206b-ea85-4502-bd16-994fe26cb601"

echo "1. Testing INBOX folder:"
curl -s "http://localhost:3001/api/conversations?type=email&folder=inbox&userId=$USER_ID" | jq '.data | length'

echo ""
echo "2. Testing SENT folder:"
curl -s "http://localhost:3001/api/conversations?type=email&folder=sent&userId=$USER_ID" | jq '.data | length'

echo ""
echo "3. Testing DELETED folder:"
curl -s "http://localhost:3001/api/conversations?type=email&folder=deleted&userId=$USER_ID" | jq '.data | length'

echo ""
echo "4. Testing ALL emails (no folder filter):"
curl -s "http://localhost:3001/api/conversations?type=email&userId=$USER_ID" | jq '.data | length'

echo ""
echo "=== Expected: Different counts for each folder ==="
echo "=== If all show 612, the fix didn't work ==="


