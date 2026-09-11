import { NextRequest, NextResponse } from 'next/server'
import { InteractionAgent } from '@/lib/agents/interactionAgent'
import { ChatStorage } from '@/lib/chatStorage'
import { UserProfileService } from '@/lib/userProfile'
import { SimpleMemorySystem } from '@/lib/simpleMemory'
import { Vault } from '@/lib/vault'
import { scheduleFromMessage } from '@/lib/followups'
import { getChartDeliveryReason } from '@/lib/chartDelivery'
import { composeMultimodalInput } from '@/lib/mediaIngest'
import { getConversationFastPath } from '@/lib/conversationFastPath'

/**
 * Web chat API endpoint for testing Pinch.
 * Mirrors the iMessage pipeline so what you see here is what a real text does.
 *
 * POST /api/chat
 *   { message, sessionId, media?: [{ data: base64, mimeType }] }
 */
export async function POST(request: NextRequest) {
  try {
    const { message, sessionId, media } = await request.json()

    const inlineMedia: Array<{ data: string; mimeType: string }> = Array.isArray(media) ? media : []

    if ((!message || typeof message !== 'string') && inlineMedia.length === 0) {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 })
    }

    const text: string = typeof message === 'string' ? message : ''

    // Use sessionId as a fake phone number for web testing
    const webPhoneNumber = sessionId || `web-${crypto.randomUUID()}`

    console.log(`[WebChat][${webPhoneNumber}] Incoming: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"${inlineMedia.length ? ` +${inlineMedia.length} media` : ''}`)

    // Get or create user
    const userId = await ChatStorage.getOrCreateUser(webPhoneNumber)
    if (!userId) {
      return NextResponse.json({ error: 'Failed to identify user' }, { status: 500 })
    }

    // Log the raw inbound event before anything interprets it
    const eventId = await Vault.logInbound({
      phoneNumber: webPhoneNumber,
      source: 'web',
      text: text || undefined,
      mediaUrls: [],
    })

    // Load conversation history
    const history = ChatStorage.formatForOpenAI(
      await ChatStorage.getConversationHistory(webPhoneNumber, 10)
    )

    // Analyze uploads before saving/replying. Exact speech from a voice note
    // becomes ordinary user text for history, retrieval, reminders, and memory.
    const vaultEvents: string[] = []
    const mediaResult = inlineMedia.length > 0
      ? await Vault.processMedia({
        phoneNumber: webPhoneNumber,
        inlineMedia,
        text,
        eventId,
      })
      : { visualSummaries: [], transcripts: [], failedCount: 0 }
    vaultEvents.push(...mediaResult.visualSummaries.map(summary => `saw: ${summary}`))
    if (mediaResult.transcripts.length > 0) vaultEvents.push(`transcribed ${mediaResult.transcripts.length} voice note${mediaResult.transcripts.length === 1 ? '' : 's'}`)
    const multimodal = composeMultimodalInput(text, mediaResult)
    const fastPathReply = getConversationFastPath(multimodal.agentMessage)

    await ChatStorage.saveMessage(userId, 'user', multimodal.historyMessage, undefined, { identifierIsUserId: true })

    // Ingest any shared links before replying, so "I just sent you a tiktok,
    // what's in it" works on the first turn rather than the next one
    if (multimodal.effectiveMessage) {
      const saved = await Vault.processLinks({
        phoneNumber: webPhoneNumber,
        text: multimodal.effectiveMessage,
        eventId,
      })
      if (saved > 0) vaultEvents.push(`saved ${saved} place(s) from links`)
    }

    // Load user profile and memories. Passing the message means retrieval is
    // relevance-ranked instead of just most-recent.
    const userProfile = await UserProfileService.getUserProfile(webPhoneNumber)
    const memorySystem = new SimpleMemorySystem()
    const userMemories = fastPathReply
      ? []
      : await memorySystem.getMemories(webPhoneNumber, 10, multimodal.effectiveMessage || undefined)

    // Process with AI agent
    let aiResponse: string
    try {
      if (fastPathReply) {
        aiResponse = fastPathReply
      } else {
        const agent = new InteractionAgent({
          userId,
          phoneNumber: webPhoneNumber,
          conversationHistory: history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          userProfile: userProfile ?? undefined,
          userMemories
        })

        aiResponse = await agent.processMessage(multimodal.agentMessage)
      }
    } catch (error) {
      console.error('[WebChat] Agent error:', error)
      aiResponse = 'I am having trouble right now. Please try again in a moment.'
    }

    // Save AI response
    await ChatStorage.saveMessage(userId, 'assistant', aiResponse, undefined, { identifierIsUserId: true })

    // If this turn created a chart, or they explicitly asked to see the chart
    // already on file, tell the client to fetch its private SVG rendering.
    const updatedProfile = await UserProfileService.getUserProfile(webPhoneNumber)
    const chartGenerated = Boolean(getChartDeliveryReason(userProfile, updatedProfile, multimodal.effectiveMessage))

    if (chartGenerated && !updatedProfile?.chart_introduced_at) {
      await UserProfileService.markChartIntroduced(webPhoneNumber)
    }

    // Schedule follow-ups for anything they said is coming up. After the reply,
    // never in the response path.
    if (multimodal.effectiveMessage && !fastPathReply) {
      try {
        const n = await scheduleFromMessage({ phoneNumber: webPhoneNumber, message: multimodal.effectiveMessage, eventId })
        if (n > 0) vaultEvents.push(`scheduled ${n} follow-up${n === 1 ? '' : 's'}`)
      } catch (error) {
        console.error('[WebChat] Follow-up scheduling error:', error)
      }
    }

    // Persist memory - the web path never did this, which is why testing here
    // always looked like the agent had amnesia.
    try {
      const extractor = new SimpleMemorySystem()
      const memories = multimodal.effectiveMessage && !fastPathReply
        ? await extractor.extractMemories(
            multimodal.effectiveMessage,
            aiResponse,
            webPhoneNumber,
            eventId
          )
        : []
      if (memories.length > 0) {
        await extractor.storeMemories(webPhoneNumber, memories)
      }
    } catch (error) {
      console.error('[WebChat] Memory extraction error:', error)
    }

    return NextResponse.json({
      response: aiResponse,
      sessionId: webPhoneNumber,
      vaultEvents,
      chartGenerated,
    })

  } catch (error) {
    console.error('[WebChat] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
