# SMS Text Agent Optimization Guide

## ✅ **System Prompt Updated**
The system prompt has been updated to be more conversational and SMS-friendly, similar to the Poke agent architecture.

## **Key Changes Made:**

### **Before (Aggressive):**
```
You are an astrologer. 
Be prescriptive, confident, and extremely specific. 
People want extreme ideas and tangible outcomes. 
They want you to be in control. 
Be direct and avoid filler.
```

### **After (Conversational):**
```
You are the astrological advisor for AstroWorld, a personalized astrology text service. 
You are the "insight engine" of AstroWorld, providing astrological guidance and predictions 
while AstroWorld handles user conversations and message delivery.

Focus on being:
- Conversational and warm, like texting a knowledgeable friend
- Concise (SMS-friendly responses, 1-3 sentences typically)
- Insightful but not overwhelming
- Supportive and encouraging
- Specific to their astrological profile when relevant
```

## **Additional SMS Optimizations to Consider:**

### **1. Response Length Management**
```javascript
// Add to route.ts after OpenAI call
const response = completion.choices[0].message.content;
const maxSMSLength = 160; // Standard SMS length

// Split long responses into multiple messages
if (response.length > maxSMSLength) {
  const messages = splitIntoSMSChunks(response, maxSMSLength);
  return { messages: messages }; // Return array instead of single message
}
```

### **2. Context Memory for Conversations**
```javascript
// Add conversation context storage
const conversationHistory = await getRecentConversation(userProfile.id, 3); // Last 3 exchanges
const contextualPrompt = `Recent conversation context:
${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Current question: ${message}`;
```

### **3. SMS-Specific Formatting**
```javascript
// Format responses for SMS
function formatForSMS(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '*$1*') // Bold to asterisks
    .replace(/\*(.*?)\*/g, '_$1_')     // Italic to underscores
    .replace(/\n\n/g, '\n')           // Reduce double line breaks
    .trim();
}
```

### **4. Emoji Integration**
```javascript
// Add contextual emojis for SMS engagement
const emojiMap = {
  'love': '💕', 'money': '💰', 'career': '🚀', 
  'health': '🌟', 'travel': '✈️', 'family': '👨‍👩‍👧‍👦'
};
```

### **5. Time-Aware Responses**
```javascript
// Add time context for better SMS timing
const currentHour = new Date().getHours();
const timeContext = currentHour < 12 ? 'morning' : 
                   currentHour < 17 ? 'afternoon' : 'evening';

const timeAwarePrompt = `It's ${timeContext} for the user. Adjust your tone accordingly.`;
```

### **6. Quick Response Suggestions**
```javascript
// Add suggested follow-up questions
const suggestions = [
  "Tell me more about love",
  "What about my career?", 
  "Any health insights?",
  "Lucky numbers today?"
];
```

## **Conversation Flow Improvements:**

### **1. Greeting Detection**
```javascript
const greetings = ['hi', 'hello', 'hey', 'good morning', 'good evening'];
const isGreeting = greetings.some(g => message.toLowerCase().includes(g));

if (isGreeting) {
  systemPrompt += `\nThis is a greeting. Respond warmly and ask what they'd like to know about today.`;
}
```

### **2. Follow-up Question Handling**
```javascript
if (conversationHistory.length > 0) {
  systemPrompt += `\nThis is a follow-up question. Reference their previous question naturally.`;
}
```

### **3. Clarification Requests**
```javascript
const needsClarification = ['what', 'how', 'when', 'why', 'explain'];
const isQuestion = needsClarification.some(w => message.toLowerCase().includes(w));

if (isQuestion) {
  systemPrompt += `\nUser is asking for clarification. Be more detailed but still concise.`;
}
```

## **Testing the New System:**

### **Expected Response Style Changes:**

**Before:**
> "CANCER: Your financial Jupiter is in retrograde! Sell all stocks immediately. Invest in gold by Friday or face bankruptcy. Mercury demands action NOW!"

**After:**
> "Hey Emma! 💰 With Jupiter shifting this week, it's a great time to review your finances. Maybe hold off on big purchases until next Tuesday when things stabilize. Your Cancer intuition will guide you! ✨"

## **Next Steps:**
1. ✅ System prompt updated
2. Test the new conversational tone
3. Implement SMS length limits
4. Add conversation memory
5. Deploy and test with real SMS integration

## **SMS Integration Considerations:**
- **Character limits**: Standard SMS is 160 chars, but most carriers support 1600+ chars
- **Delivery timing**: Respect user time zones and quiet hours
- **Opt-out compliance**: Always include STOP instructions
- **Rate limiting**: Don't overwhelm users with too many messages
- **Context persistence**: Remember conversation state between messages
