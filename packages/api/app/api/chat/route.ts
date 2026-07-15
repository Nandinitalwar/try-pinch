import { NextRequest, NextResponse } from 'next/server'
import { InteractionAgent } from '@/lib/agents/interactionAgent'
import { ChatStorage } from '@/lib/chatStorage'
import { UserProfileService } from '@/lib/userProfile'
import { SimpleMemorySystem } from '@/lib/simpleMemory'

/**
 * Web chat API endpoint for testing Pinch
 * POST /api/chat
 */
export async function POST(request: NextRequest) {
  try {
    const { message, sessionId } = await request.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 })
    }

    // Use sessionId as a fake phone number for web testing
    const webPhoneNumber = sessionId || `web-${Date.now()}`
    
    console.log(`[WebChat][${webPhoneNumber}] Incoming: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`)

    // Get or create user
    const userId = await ChatStorage.getOrCreateUser(webPhoneNumber)
    if (!userId) {
      return NextResponse.json({ error: 'Failed to identify user' }, { status: 500 })
    }

    // Load conversation history
    const history = ChatStorage.formatForOpenAI(
      await ChatStorage.getConversationHistory(webPhoneNumber, 10)
    )

    // Save user message
    await ChatStorage.saveMessage(userId, 'user', message, undefined, { identifierIsUserId: true })

    // Load user profile and memories
    const userProfile = await UserProfileService.getUserProfile(webPhoneNumber)
    const memorySystem = new SimpleMemorySystem()
    const userMemories = await memorySystem.getMemories(webPhoneNumber)

    // Process with AI agent
    let aiResponse: string
    try {
      const agent = new InteractionAgent({
        userId,
        phoneNumber: webPhoneNumber,
        conversationHistory: history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        userProfile: userProfile ?? undefined,
        userMemories
      })

      aiResponse = await agent.processMessage(message)
    } catch (error) {
      console.error('[WebChat] Agent error:', error)
      aiResponse = 'I am having trouble right now. Please try again in a moment.'
    }

    // Save AI response
    await ChatStorage.saveMessage(userId, 'assistant', aiResponse, undefined, { identifierIsUserId: true })

    return NextResponse.json({ 
      response: aiResponse,
      sessionId: webPhoneNumber 
    })

  } catch (error) {
    console.error('[WebChat] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
