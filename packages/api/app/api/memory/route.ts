import { NextRequest, NextResponse } from 'next/server'

// Memory dashboard backed by Mem0 (https://docs.mem0.ai)
const MEM0_BASE_URL = 'https://api.mem0.ai/v1'

function mem0Headers(): Record<string, string> | null {
  const key = process.env.MEM0_API_KEY?.trim()
  if (!key) return null
  return {
    'Authorization': `Token ${key}`,
    'Content-Type': 'application/json',
  }
}

// GET /api/memory?phone={phone} - Get user's memory dashboard
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const phoneNumber = searchParams.get('phone')

  if (!phoneNumber) {
    return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
  }

  const headers = mem0Headers()
  if (!headers) {
    return NextResponse.json({ error: 'Memory service not configured' }, { status: 500 })
  }

  try {
    const response = await fetch(
      `${MEM0_BASE_URL}/memories/?user_id=${encodeURIComponent(phoneNumber)}`,
      { headers }
    )
    if (!response.ok) throw new Error(`Mem0 returned ${response.status}`)

    const result = await response.json()
    const memories: any[] = Array.isArray(result) ? result : result.results || []

    // Group memories by category for dashboard
    const memoriesByType = memories.reduce((acc: any, memory: any) => {
      const type = memory.categories?.[0] || 'general'
      if (!acc[type]) acc[type] = []
      acc[type].push({
        id: memory.id,
        memory_content: memory.memory,
        memory_type: type,
        created_at: memory.created_at,
        updated_at: memory.updated_at,
      })
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      data: {
        memories: memoriesByType,
        stats: {
          total_memories: memories.length,
        }
      }
    })

  } catch (error) {
    console.error('Memory dashboard error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch memory dashboard' },
      { status: 500 }
    )
  }
}

// POST /api/memory - Manage individual memories
export async function POST(request: NextRequest) {
  const headers = mem0Headers()
  if (!headers) {
    return NextResponse.json({ error: 'Memory service not configured' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { action, phone_number, ...data } = body

    if (!phone_number) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
    }

    switch (action) {
      case 'delete_memory': {
        const { memory_id } = data
        const response = await fetch(`${MEM0_BASE_URL}/memories/${memory_id}/`, {
          method: 'DELETE',
          headers,
        })
        if (!response.ok) throw new Error(`Mem0 returned ${response.status}`)

        return NextResponse.json({
          success: true,
          message: 'Memory deleted successfully'
        })
      }

      case 'edit_memory': {
        const { memory_id, new_content } = data
        const response = await fetch(`${MEM0_BASE_URL}/memories/${memory_id}/`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ text: new_content }),
        })
        if (!response.ok) throw new Error(`Mem0 returned ${response.status}`)

        return NextResponse.json({
          success: true,
          message: 'Memory updated successfully'
        })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Memory update error:', error)
    return NextResponse.json(
      { error: 'Failed to update memory' },
      { status: 500 }
    )
  }
}

// DELETE /api/memory?phone={phone} - Clear all memories for a user
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const phoneNumber = searchParams.get('phone')

  if (!phoneNumber) {
    return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
  }

  const headers = mem0Headers()
  if (!headers) {
    return NextResponse.json({ error: 'Memory service not configured' }, { status: 500 })
  }

  try {
    const response = await fetch(
      `${MEM0_BASE_URL}/memories/?user_id=${encodeURIComponent(phoneNumber)}`,
      { method: 'DELETE', headers }
    )
    if (!response.ok) throw new Error(`Mem0 returned ${response.status}`)

    return NextResponse.json({
      success: true,
      message: 'All memories cleared successfully'
    })

  } catch (error) {
    console.error('Memory clear error:', error)
    return NextResponse.json(
      { error: 'Failed to clear memories' },
      { status: 500 }
    )
  }
}
