# Test Frontend API Response

## Check What Data Frontend Is Receiving

### Step 1: Open Browser DevTools
1. In Firefox, press `F12` or `Cmd+Option+I`
2. Go to **Network** tab
3. Refresh the Email Inbox page

### Step 2: Find the API Call
Look for a request to:
```
/api/conversations/with-intents?type=email&folder=inbox
```

### Step 3: Check Response
Click on the request → **Response** tab

**Look for these fields in the JSON:**
```json
{
  "data": [
    {
      "id": "...",
      "senderName": "...",
      "subject": "...",
      "intent": {                    // ← Should be here if Agent 1 ran
        "primary_intent": "pricing_inquiry",
        "confidence_score": 0.92,
        "detected_keywords": ["pricing", "cost"]
      },
      "lead_tags": ["info_requested"],  // ← Should be here if Agent 2 ran
      "manually_tagged": false
    }
  ]
}
```

### Step 4: Verify
- **If `intent` and `lead_tags` are present:** Frontend WILL display them
- **If `intent` and `lead_tags` are null/missing:** Agents haven't processed these conversations yet

---

## Alternative: Test with curl

```bash
curl "http://localhost:3001/api/conversations/with-intents?type=email&folder=inbox&userId=314fd989-3a7b-4c87-ab4d-f8e276a4fd22&userRole=admin" \
  -H "X-Workspace-Id: eaf12104-abe4-4518-9bb5-f598c2a22053" \
  | jq '.data[0] | {subject, intent, lead_tags}'
```

This will show you if the API is returning AI data.

