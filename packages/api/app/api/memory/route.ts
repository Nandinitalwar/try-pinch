import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { SimpleMemorySystem } from '@/lib/simpleMemory'

// Memory management surface backed by Pinch's Convex memory table.

function hasAdminAccess(request: NextRequest): boolean {
  const expected = process.env.PINCH_MEMORY_ADMIN_SECRET?.trim()
  if (!expected) return false
  const actual = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(actual)
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)
}

function authorizeIdentifier(request: NextRequest, identifier: string): NextResponse | null {
  if (process.env.NODE_ENV !== 'production') return null
  if (/^(?:test-|web-|memory-(?:roundtrip|smoke)-)/.test(identifier)) return null
  if (hasAdminAccess(request)) return null
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const phoneNumber = searchParams.get('phone')
  if (!phoneNumber) {
    return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
  }
  const unauthorized = authorizeIdentifier(request, phoneNumber)
  if (unauthorized) return unauthorized

  try {
    const memorySystem = new SimpleMemorySystem()
    const memories = await memorySystem.listMemories(phoneNumber)
    const memoriesByType = memories.reduce<Record<string, unknown[]>>((groups, memory) => {
      const type = memory.memory_type || 'general'
      if (!groups[type]) groups[type] = []
      groups[type].push({
        id: memory.id,
        memory_key: memory.memory_key,
        memory_content: memory.memory_content,
        memory_type: type,
        importance: memory.importance,
        confidence: memory.confidence,
        source_event_ids: memory.source_event_ids,
        created_at: memory.created_at,
        updated_at: memory.updated_at,
      })
      return groups
    }, {})

    return NextResponse.json({
      success: true,
      data: {
        memories: memoriesByType,
        stats: { total_memories: memories.length },
      },
    })
  } catch (error) {
    console.error('Memory dashboard error:', error)
    return NextResponse.json({ error: 'Failed to fetch memory dashboard' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, phone_number: phoneNumber, memory_id: memoryId, new_content: newContent } = body
    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
    }
    const unauthorized = authorizeIdentifier(request, phoneNumber)
    if (unauthorized) return unauthorized

    const memorySystem = new SimpleMemorySystem()
    if (action === 'delete_memory') {
      if (!memoryId) return NextResponse.json({ error: 'Memory id required' }, { status: 400 })
      const deleted = await memorySystem.deleteMemory(phoneNumber, memoryId)
      return NextResponse.json({ success: deleted, message: deleted ? 'Memory deleted' : 'Memory not found' })
    }

    if (action === 'edit_memory') {
      if (!memoryId || !newContent?.trim()) {
        return NextResponse.json({ error: 'Memory id and content required' }, { status: 400 })
      }
      const updated = await memorySystem.editMemory(phoneNumber, memoryId, newContent)
      return NextResponse.json({ success: updated, message: updated ? 'Memory updated' : 'Memory not found' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Memory update error:', error)
    return NextResponse.json({ error: 'Failed to update memory' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const phoneNumber = searchParams.get('phone')
  if (!phoneNumber) {
    return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
  }
  const unauthorized = authorizeIdentifier(request, phoneNumber)
  if (unauthorized) return unauthorized

  try {
    const memorySystem = new SimpleMemorySystem()
    const deleted = await memorySystem.clearMemories(phoneNumber)
    return NextResponse.json({ success: true, message: `${deleted} memories cleared` })
  } catch (error) {
    console.error('Memory clear error:', error)
    return NextResponse.json({ error: 'Failed to clear memories' }, { status: 500 })
  }
}
