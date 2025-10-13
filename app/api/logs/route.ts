import { NextRequest, NextResponse } from 'next/server'
import { addLog, getLogs, clearLogs } from '@/lib/logger'

// GET - Retrieve logs
export async function GET(request: NextRequest) {
  const logs = getLogs()
  return NextResponse.json({ 
    logs,
    count: logs.length,
    timestamp: new Date().toISOString()
  })
}

// DELETE - Clear logs
export async function DELETE(request: NextRequest) {
  clearLogs()
  return NextResponse.json({ success: true, message: 'Logs cleared' })
}

// POST - Add a log entry (useful for client-side logging)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { level = 'info', message, data } = body
    
    addLog(level, message, data)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid log entry' },
      { status: 400 }
    )
  }
}

