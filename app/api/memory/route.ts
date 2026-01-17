import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/memory?phone={phone} - Get user's memory dashboard
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const phoneNumber = searchParams.get('phone')
  
  if (!phoneNumber) {
    return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    // Get all memories
    const { data: memories, error: memoriesError } = await supabase
      .from('user_memories')
      .select('*')
      .eq('phone_number', phoneNumber)
      .eq('is_active', true)
      .order('importance_score', { ascending: false })
      .order('created_at', { ascending: false })

    if (memoriesError) throw memoriesError

    // Get clusters
    const { data: clusters, error: clustersError } = await supabase
      .from('memory_clusters')
      .select('*')
      .eq('phone_number', phoneNumber)
      .order('cluster_score', { ascending: false })

    if (clustersError) throw clustersError

    // Get conversation patterns
    const { data: patterns, error: patternsError } = await supabase
      .from('conversation_patterns')
      .select('*')
      .eq('phone_number', phoneNumber)
      .order('confidence_level', { ascending: false })

    if (patternsError) throw patternsError

    // Get pending verifications
    const { data: verifications, error: verificationsError } = await supabase
      .from('memory_verifications')
      .select(`
        *,
        user_memories (memory_content, memory_summary)
      `)
      .eq('phone_number', phoneNumber)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (verificationsError) throw verificationsError

    // Get user preferences
    const { data: preferences, error: preferencesError } = await supabase
      .from('user_memory_preferences')
      .select('*')
      .eq('phone_number', phoneNumber)
      .single()

    // Group memories by type for dashboard
    const memoriesByType = memories?.reduce((acc: any, memory: any) => {
      if (!acc[memory.memory_type]) acc[memory.memory_type] = []
      acc[memory.memory_type].push(memory)
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      data: {
        memories: memoriesByType || {},
        clusters: clusters || [],
        patterns: patterns || [],
        verifications: verifications || [],
        preferences: preferences || {
          memory_enabled: true,
          auto_extract: true,
          verification_frequency: 'important_only'
        },
        stats: {
          total_memories: memories?.length || 0,
          by_importance: {
            critical: memories?.filter((m: any) => m.importance_score >= 8).length || 0,
            important: memories?.filter((m: any) => m.importance_score >= 6 && m.importance_score < 8).length || 0,
            moderate: memories?.filter((m: any) => m.importance_score >= 4 && m.importance_score < 6).length || 0
          },
          by_verification: {
            verified: memories?.filter((m: any) => m.verification_status === 'verified').length || 0,
            unverified: memories?.filter((m: any) => m.verification_status === 'unverified').length || 0,
            disputed: memories?.filter((m: any) => m.verification_status === 'disputed').length || 0
          }
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

// POST /api/memory - Update user memory preferences or verify memories
export async function POST(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { action, phone_number, ...data } = body

    if (!phone_number) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
    }

    switch (action) {
      case 'update_preferences':
        const { data: preferences, error: prefError } = await supabase
          .from('user_memory_preferences')
          .upsert({
            phone_number,
            ...data.preferences,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'phone_number'
          })
          .select()

        if (prefError) throw prefError

        return NextResponse.json({
          success: true,
          message: 'Preferences updated successfully',
          data: preferences
        })

      case 'verify_memory':
        const { memory_id, verification_response, approved } = data

        // Update verification record
        await supabase
          .from('memory_verifications')
          .update({
            status: approved ? 'confirmed' : 'rejected',
            user_response: verification_response,
            verified_at: new Date().toISOString()
          })
          .eq('memory_id', memory_id)
          .eq('phone_number', phone_number)

        // Update memory verification status
        const newStatus = approved ? 'verified' : (verification_response === 'outdated' ? 'outdated' : 'disputed')
        await supabase
          .from('user_memories')
          .update({
            verification_status: newStatus,
            is_active: approved
          })
          .eq('id', memory_id)
          .eq('phone_number', phone_number)

        return NextResponse.json({
          success: true,
          message: `Memory ${approved ? 'verified' : 'disputed'} successfully`
        })

      case 'delete_memory':
        const { memory_id: deleteId } = data

        await supabase
          .from('user_memories')
          .update({
            is_active: false,
            verification_status: 'outdated'
          })
          .eq('id', deleteId)
          .eq('phone_number', phone_number)

        return NextResponse.json({
          success: true,
          message: 'Memory deleted successfully'
        })

      case 'edit_memory':
        const { memory_id: editId, new_content, new_summary } = data

        await supabase
          .from('user_memories')
          .update({
            memory_content: new_content,
            memory_summary: new_summary,
            extraction_method: 'corrected',
            updated_at: new Date().toISOString()
          })
          .eq('id', editId)
          .eq('phone_number', phone_number)

        return NextResponse.json({
          success: true,
          message: 'Memory updated successfully'
        })

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

// DELETE /api/memory - Clear all memories for a user
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const phoneNumber = searchParams.get('phone')
  
  if (!phoneNumber) {
    return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    // Deactivate all memories instead of hard delete
    await supabase
      .from('user_memories')
      .update({
        is_active: false,
        verification_status: 'outdated'
      })
      .eq('phone_number', phoneNumber)

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