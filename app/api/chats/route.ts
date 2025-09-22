import { NextRequest, NextResponse } from 'next/server'
import { ChatDatabase } from '../../../lib/chatDatabase'
import { supabaseServer as supabase } from '../../../lib/supabaseServer'

// GET /api/chats - Get all chat sessions for the authenticated user
export async function GET(request: NextRequest) {
  try {
    // Get the user from the Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const chatSessions = await ChatDatabase.getChatSessions(user.id)
    return NextResponse.json({ chatSessions })
  } catch (error: any) {
    console.error('Error fetching chat sessions:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/chats - Create a new chat session
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { chatSession } = body

    if (!chatSession) {
      return NextResponse.json({ error: 'Chat session data is required' }, { status: 400 })
    }

    await ChatDatabase.saveChatSession(chatSession, user.id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error creating chat session:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
