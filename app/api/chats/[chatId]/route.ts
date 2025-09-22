import { NextRequest, NextResponse } from 'next/server'
import { ChatDatabase } from '../../../../lib/chatDatabase'
import { supabaseServer as supabase } from '../../../../lib/supabaseServer'

// GET /api/chats/[chatId] - Get a specific chat session
export async function GET(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
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

    const chatSession = await ChatDatabase.getChatSession(params.chatId, user.id)
    
    if (!chatSession) {
      return NextResponse.json({ error: 'Chat session not found' }, { status: 404 })
    }

    return NextResponse.json({ chatSession })
  } catch (error: any) {
    console.error('Error fetching chat session:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT /api/chats/[chatId] - Update a chat session
export async function PUT(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
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
    console.error('Error updating chat session:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/chats/[chatId] - Delete a chat session
export async function DELETE(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
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

    await ChatDatabase.deleteChatSession(params.chatId, user.id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting chat session:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
