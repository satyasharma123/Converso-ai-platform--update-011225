/**
 * OpenAI Utility
 * Wrapper for OpenAI API integration using GPT-4o-mini
 */

import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Model configuration
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const MAX_TOKENS = 500; // For intent detection responses
const TEMPERATURE = 0.3; // Lower = more consistent, higher = more creative

/**
 * Intent detection with OpenAI
 */
export async function detectIntentWithAI(
  messageContent: string,
  conversationContext?: {
    subject?: string;
    sender_name?: string;
    conversation_history?: string[];
  }
): Promise<{
  primary_intent: string;
  secondary_intents: string[];
  confidence_score: number;
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  detected_keywords: string[];
  is_urgent: boolean;
  reasoning: string;
}> {
  // Build context for better analysis
  const contextInfo = [
    conversationContext?.subject ? `Subject: ${conversationContext.subject}` : '',
    conversationContext?.sender_name ? `Sender: ${conversationContext.sender_name}` : '',
    conversationContext?.conversation_history?.length
      ? `Previous messages: ${conversationContext.conversation_history.join(' | ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const systemPrompt = `You are an expert email intent classifier for a sales CRM platform. Analyze the email and classify it into one of these intent categories:

**Intent Categories:**
1. **pricing_inquiry** - Questions about cost, pricing, plans, billing
2. **demo_request** - Requests to see a demo, trial, or preview
3. **meeting_request** - Requests for calls, meetings, or availability
4. **support_question** - Technical help, how-to questions, issues
5. **objection** - Concerns, hesitations, competitive mentions
6. **interested** - Positive interest, wants to learn more
7. **not_interested** - Explicit disinterest, unsubscribe requests
8. **follow_up** - Checking in, following up on previous conversation
9. **other** - Doesn't fit above categories

**Your task:**
- Identify the PRIMARY intent (most dominant)
- List SECONDARY intents if multiple are present
- Provide confidence score (0.0 to 1.0)
- Detect sentiment (positive, neutral, negative, mixed)
- Extract key keywords that indicate the intent
- Determine if the message is urgent (time-sensitive)
- Provide brief reasoning for your classification

Respond ONLY with valid JSON matching this exact structure:
{
  "primary_intent": "intent_category_name",
  "secondary_intents": ["intent1", "intent2"],
  "confidence_score": 0.85,
  "sentiment": "positive",
  "detected_keywords": ["keyword1", "keyword2", "keyword3"],
  "is_urgent": false,
  "reasoning": "Brief explanation of why this intent was chosen"
}`;

  const userPrompt = `${contextInfo ? contextInfo + '\n\n' : ''}Email Message:\n${messageContent}`;

  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const result = JSON.parse(content);

    // Validate and return
    return {
      primary_intent: result.primary_intent || 'other',
      secondary_intents: result.secondary_intents || [],
      confidence_score: Math.min(Math.max(result.confidence_score || 0.5, 0), 1),
      sentiment: result.sentiment || 'neutral',
      detected_keywords: result.detected_keywords || [],
      is_urgent: result.is_urgent || false,
      reasoning: result.reasoning || '',
    };
  } catch (error: any) {
    console.error('Error calling OpenAI API:', error);
    throw new Error(`OpenAI API error: ${error.message}`);
  }
}

/**
 * Generate reply with OpenAI (for Agent 3 - Reply Generation)
 */
export async function generateReplyWithAI(
  messageContent: string,
  intent: string,
  conversationContext?: {
    subject?: string;
    sender_name?: string;
    conversation_history?: string[];
    company_info?: string;
  }
): Promise<{
  reply_text: string;
  tone: string;
  reasoning: string;
}> {
  const contextInfo = [
    conversationContext?.subject ? `Subject: ${conversationContext.subject}` : '',
    conversationContext?.sender_name ? `Sender: ${conversationContext.sender_name}` : '',
    conversationContext?.company_info ? `Company Context: ${conversationContext.company_info}` : '',
    conversationContext?.conversation_history?.length
      ? `Conversation History:\n${conversationContext.conversation_history.join('\n---\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const systemPrompt = `You are a professional sales representative writing email replies. 

**Context:**
- Detected Intent: ${intent}
- Your role: Helpful, professional, and empathetic sales representative

**Instructions:**
1. Write a natural, professional email reply
2. Match the tone to the intent (excited for demo requests, understanding for objections, etc.)
3. Be concise but complete (2-4 paragraphs max)
4. Include a clear call-to-action when appropriate
5. Use the sender's name if available
6. Don't include subject line or signature (will be added separately)

Respond ONLY with valid JSON:
{
  "reply_text": "The complete email reply text",
  "tone": "professional|friendly|empathetic|enthusiastic",
  "reasoning": "Brief explanation of approach"
}`;

  const userPrompt = `${contextInfo ? contextInfo + '\n\n' : ''}Original Message:\n${messageContent}\n\nGenerate an appropriate reply.`;

  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7, // Slightly higher for more natural writing
      max_tokens: 1000, // More tokens for reply generation
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const result = JSON.parse(content);

    return {
      reply_text: result.reply_text || '',
      tone: result.tone || 'professional',
      reasoning: result.reasoning || '',
    };
  } catch (error: any) {
    console.error('Error calling OpenAI API for reply generation:', error);
    throw new Error(`OpenAI API error: ${error.message}`);
  }
}

export default openai;

