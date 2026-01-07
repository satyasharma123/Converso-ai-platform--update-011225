-- Query 1: Check if Agent 1 has detected any intents
SELECT 
  COUNT(*) as intent_count,
  primary_intent,
  AVG(confidence_score) as avg_confidence
FROM conversation_intents
GROUP BY primary_intent
ORDER BY intent_count DESC;

-- Query 2: Check if Agent 2 has applied any lead tags
SELECT 
  COUNT(*) as tagged_count,
  lead_tags,
  manually_tagged
FROM conversations
WHERE lead_tags IS NOT NULL
GROUP BY lead_tags, manually_tagged
ORDER BY tagged_count DESC;

-- Query 3: Get sample conversations with AI data
SELECT 
  c.id,
  c.sender_name,
  c.subject,
  c.lead_tags,
  c.manually_tagged,
  ci.primary_intent,
  ci.confidence_score
FROM conversations c
LEFT JOIN conversation_intents ci ON ci.conversation_id = c.id
WHERE c.lead_tags IS NOT NULL OR ci.id IS NOT NULL
ORDER BY c.last_message_at DESC
LIMIT 5;

