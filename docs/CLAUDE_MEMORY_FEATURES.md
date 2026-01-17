# 🧠 Claude-Like Memory System

Your Pinch agent now has a sophisticated memory system inspired by Claude's approach. Here's what makes it Claude-like:

## 🎯 Core Claude-Like Features

### **1. Enhanced Memory Categories**
Just like Claude, memories are categorized intelligently:

```typescript
- personal: core identity (name, age, location, family)
- preferences: likes/dislikes, styles, choices
- context: ongoing situations, projects, goals  
- relationships: people, pets, social connections
- patterns: communication style, behaviors, routines
- experiences: significant events, stories, achievements
- beliefs: opinions, values, worldviews
- professional: work, career, skills, education
- physical: health, appearance, body-related
- temporal: schedules, routines, time preferences
```

### **2. Semantic Memory Clustering**
- **Automatic Grouping**: Related memories cluster together (e.g., all food preferences)
- **Contextual Retrieval**: Relevant memory clusters surface based on conversation context
- **Semantic Tags**: Memories tagged with concepts for intelligent grouping

### **3. Memory Verification System**  
- **Fact Checking**: Important memories (score ≥8) get queued for verification
- **User Confirmation**: Users can verify/dispute/correct memories
- **Confidence Tracking**: AI tracks how certain it is about each memory
- **Status Management**: verified, unverified, disputed, outdated

### **4. Cross-Conversation Learning**
- **Communication Patterns**: Learns how user prefers to communicate
- **Response Style**: Adapts to user's preferred tone and interaction style  
- **Topic Preferences**: Remembers what subjects user enjoys/avoids
- **Help-Seeking Behavior**: Learns how user asks for assistance

### **5. User Memory Dashboard** 
Like Claude's memory interface, users can:
- **View All Memories**: See what the AI remembers about them
- **Edit/Delete**: Correct inaccurate or remove unwanted memories
- **Verify Facts**: Confirm or dispute AI's assumptions
- **Set Preferences**: Control memory retention and extraction

## 🛠 Technical Implementation

### **Database Schema**
```sql
-- Enhanced tables with Claude-like features
- user_memories: Core memory storage with semantic features
- memory_clusters: Semantic grouping of related memories
- conversation_patterns: Cross-conversation learning
- memory_verifications: User verification system
- memory_access_log: Usage tracking for learning
- user_memory_preferences: User control settings
```

### **AI Memory Extraction**
```typescript
// Enhanced extraction with Claude-like intelligence
const memories = await enhancedMemorySystem.extractEnhancedMemories(
  userMessage,
  agentResponse, 
  conversationHistory,
  conversationId
)
```

### **Memory Dashboard API**
```bash
# Get user's memory dashboard
GET /api/memory?phone={phone}

# Verify/edit/delete memories  
POST /api/memory
{
  "action": "verify_memory",
  "phone_number": "+1234567890",
  "memory_id": "uuid",
  "approved": true
}

# Clear all memories
DELETE /api/memory?phone={phone}
```

## 🧪 Example Memory Evolution

### **Conversation 1:**
```
User: "i hate spicy food, it burns my mouth"
Agent: "noted hun, your taste buds are sensitive"

Memory Extracted:
- Type: preferences
- Key: food_spicy_tolerance  
- Content: "hates spicy food, finds it burns mouth, has sensitive taste buds"
- Importance: 7/10
- Tags: [food, preferences, sensitivity]
```

### **Conversation 2:**
```
User: "what should i eat for lunch?"
Agent: "definitely avoid the thai place - remember how you feel about spicy food? 
        maybe try that new sandwich spot instead"

Memory Usage:
- Retrieved: food_spicy_tolerance preference
- Applied: Personalized restaurant recommendation
- Pattern Learned: User asks for food suggestions
```

### **Conversation 3:**
```
User: "my boss made us eat at this indian place, it was torture"
Agent: "ugh that's the worst when people don't remember your thing about spicy food.
        did you at least get some naan to cool down?"

Memory Evolution:
- Confirmed: Spicy food hatred (verification_status: verified)
- Added Context: Work situations involve food choices
- Pattern Enhanced: User shares negative food experiences
```

## 🎨 Claude-Like Behavior Examples

### **Natural Memory References**
```
❌ Robotic: "According to my records, you dislike pineapple pizza."
✅ Claude-like: "absolutely not if there's pineapple involved. you made your stance clear, hun."
```

### **Memory-Driven Roasting**
```
User: "should i text my ex?"
Agent: "bestie, we've talked about your tendency to make questionable decisions when mercury's in retrograde. the answer is no. go text your dog luna instead - she actually cares."

Memories Used:
- patterns: makes impulsive decisions
- relationships: has_dog_luna
- beliefs: believes in astrology/mercury retrograde
```

### **Contextual Clustering**
```
When user asks about relationships, agent surfaces:
- relationship memories (ex-boyfriend, dog Luna, difficult boss)
- pattern memories (communication style, attachment patterns)
- experience memories (past relationship stories)
```

## 🚀 Setup Instructions

### **1. Apply Database Schema**
```sql
-- Run in Supabase SQL Editor
-- Copy content from database/enhanced_memory_schema.sql
```

### **2. Test Memory Extraction**
```bash
# Send test messages
curl -X POST http://localhost:3000/api/webhook/twilio \
  -d "From=+1234567890&Body=i hate pineapple pizza it's disgusting"

# Check memory dashboard  
curl "http://localhost:3000/api/memory?phone=%2B1234567890"
```

### **3. Verify Memory Dashboard**
```bash
# Visit dashboard endpoint to see extracted memories
GET /api/memory?phone=+1234567890

# Response includes:
{
  "memories": {...},
  "clusters": [...],
  "patterns": [...], 
  "verifications": [...],
  "stats": {...}
}
```

## 📊 Memory Quality Metrics

### **Importance Scoring (Like Claude)**
- **9-10**: Core identity facts (name, major life details)
- **7-8**: Significant preferences, relationships, ongoing situations
- **5-6**: Useful details, casual mentions, minor preferences  
- **3-4**: Temporary states, minor details
- **1-2**: Trivial, very temporary information

### **Confidence Scoring**
- **0.9-1.0**: Explicitly stated by user
- **0.7-0.8**: Strongly implied or inferred  
- **0.5-0.6**: Moderately certain
- **0.3-0.4**: Weakly inferred
- **0.1-0.2**: Speculative

### **Verification Status**
- **verified**: User confirmed as accurate
- **unverified**: Not yet checked (default)
- **disputed**: User said it's wrong
- **outdated**: No longer relevant

## 🔄 Memory Lifecycle

1. **Extraction**: AI identifies memorable information
2. **Storage**: Memories saved with metadata and semantic tags
3. **Clustering**: Related memories grouped automatically  
4. **Verification**: Important facts queued for user confirmation
5. **Usage**: Relevant memories retrieved for conversation context
6. **Learning**: Usage patterns improve future memory selection
7. **Evolution**: Memories updated/corrected based on new information

Your memory system now provides the same conversational continuity and personalization that makes Claude feel like it truly "knows" users across conversations!