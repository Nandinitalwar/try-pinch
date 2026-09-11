'use client'

// Local test console for Pinch. Mirrors the iMessage pipeline: same agent,
// same vault, same memory - so anything that works here works over text.
import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  media?: string[]   // data URLs, for showing what was sent
  vaultEvents?: string[]
  chartUrl?: string
}

interface Place {
  _id: string
  name: string
  category?: string
  city?: string
  note?: string
  mentionCount: number
}

interface Garment {
  _id: string
  item: string
  category?: string
  color?: string
  vibe?: string
  wornCount: number
}

interface MemoryFact {
  id: string
  memory_key?: string
  memory_content: string
  memory_type: string
  importance: number
  confidence?: number
}

interface Task {
  _id: string
  title: string
  status: 'pending' | 'snoozed' | 'completed' | 'cancelled'
  dueAt?: number
}

export default function TestPage() {
  const [sessionId, setSessionId] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState<Array<{ data: string; mimeType: string; preview: string }>>([])
  const [loading, setLoading] = useState(false)
  const [places, setPlaces] = useState<Place[]>([])
  const [garments, setGarments] = useState<Garment[]>([])
  const [memories, setMemories] = useState<MemoryFact[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskInput, setTaskInput] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const chartUrls = useRef<string[]>([])

  // Persist the session across reloads so the vault keeps building
  useEffect(() => {
    const saved = localStorage.getItem('pinch-test-session')
    const id = saved || `test-${crypto.randomUUID()}`
    if (!saved) localStorage.setItem('pinch-test-session', id)
    setSessionId(id)
  }, [])

  useEffect(() => {
    if (sessionId) refreshVault(sessionId)
  }, [sessionId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => () => {
    chartUrls.current.forEach(url => URL.revokeObjectURL(url))
  }, [])

  async function refreshVault(id: string) {
    try {
      const [vaultResponse, memoryResponse, tasksResponse] = await Promise.all([
        fetch(`/api/vault?sessionId=${encodeURIComponent(id)}`),
        fetch(`/api/memory?phone=${encodeURIComponent(id)}`),
        fetch(`/api/tasks?sessionId=${encodeURIComponent(id)}`),
      ])
      if (vaultResponse.ok) {
        const data = await vaultResponse.json()
        setPlaces(data.places || [])
        setGarments(data.garments || [])
      }
      if (memoryResponse.ok) {
        const data = await memoryResponse.json()
        const groups = data.data?.memories as Record<string, MemoryFact[]> | undefined
        setMemories(groups ? Object.values(groups).flat() : [])
      }
      if (tasksResponse.ok) setTasks((await tasksResponse.json()).tasks || [])
    } catch {
      // Context display is non-critical; ignore failures
    }
  }

  async function createTask() {
    const title = taskInput.trim()
    if (!title || !sessionId) return
    const response = await fetch('/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, title, idempotencyKey: crypto.randomUUID() }),
    })
    if (response.ok) {
      setTaskInput('')
      await refreshVault(sessionId)
    }
  }

  async function completeTask(id: string) {
    const response = await fetch('/api/tasks', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, id, status: 'completed' }),
    })
    if (response.ok) await refreshVault(sessionId)
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return
    for (const file of Array.from(files)) {
      const extension = file.name.toLowerCase().split('.').pop() || ''
      const fallbackAudioTypes: Record<string, string> = {
        m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', webm: 'audio/webm',
        aac: 'audio/aac', caf: 'audio/x-caf', aiff: 'audio/aiff', amr: 'audio/amr',
        ogg: 'audio/ogg', opus: 'audio/opus',
      }
      const mimeType = file.type || fallbackAudioTypes[extension] || 'application/octet-stream'
      const reader = new FileReader()
      await new Promise<void>(resolve => {
        reader.onload = () => {
          const result = reader.result as string
          const base64 = result.split(',')[1]
          const preview = `data:${mimeType};base64,${base64}`
          setPending(p => [...p, { data: base64, mimeType, preview }])
          resolve()
        }
        reader.readAsDataURL(file)
      })
    }
  }

  async function send() {
    if ((!input.trim() && pending.length === 0) || loading) return

    const text = input
    const media = pending
    setInput('')
    setPending([])
    setMessages(m => [...m, { role: 'user', content: text, media: media.map(p => p.preview) }])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionId,
          media: media.map(p => ({ data: p.data, mimeType: p.mimeType })),
        }),
      })
      const data = await res.json()
      let chartUrl: string | undefined
      if (data.chartGenerated) {
        const chartResponse = await fetch('/api/chart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: data.sessionId || sessionId }),
        })
        if (chartResponse.ok) {
          chartUrl = URL.createObjectURL(await chartResponse.blob())
          chartUrls.current.push(chartUrl)
        }
      }
      setMessages(m => [...m, {
        role: 'assistant',
        content: data.response || data.error || 'no response',
        vaultEvents: data.vaultEvents,
        chartUrl,
      }])
      refreshVault(sessionId)
    } catch (error) {
      setMessages(m => [...m, { role: 'assistant', content: `error: ${error}` }])
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    chartUrls.current.forEach(url => URL.revokeObjectURL(url))
    chartUrls.current = []
    const id = `test-${crypto.randomUUID()}`
    localStorage.setItem('pinch-test-session', id)
    setSessionId(id)
    setMessages([])
    setPlaces([])
    setGarments([])
    setMemories([])
    setTasks([])
  }

  return (
    <div style={S.page}>
      <div style={S.chatCol}>
        <div style={S.header}>
          <div>
            <div style={S.title}>Pinch test console</div>
            <div style={S.sub}>session {sessionId.slice(-6)}</div>
          </div>
          <button onClick={reset} style={S.resetBtn}>new user</button>
        </div>

        <div style={S.messages}>
          {messages.length === 0 && (
            <div style={S.empty}>
              <div style={{ marginBottom: 12, fontWeight: 500 }}>Try:</div>
              <div>&ldquo;born march 3 1996, 4:15am, new delhi&rdquo;</div>
              <div>&ldquo;my sister Maya is getting married in September&rdquo;</div>
              <div>paste a TikTok or Reel link</div>
              <div>upload an outfit photo</div>
              <div>attach a voice note with something worth remembering</div>
              <div>&ldquo;where should i eat this weekend&rdquo;</div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ ...S.row, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ ...S.bubble, ...(m.role === 'user' ? S.userBubble : S.aiBubble) }}>
                {m.media?.map((src, j) => (
                  src.startsWith('data:video')
                    ? <video key={j} src={src} style={S.thumb} controls />
                    : src.startsWith('data:audio')
                      ? <audio key={j} src={src} style={S.audio} controls />
                    : <img key={j} src={src} alt="" style={S.thumb} />
                ))}
                {m.chartUrl && <img src={m.chartUrl} alt="Pinch birth chart" style={S.chart} />}
                {m.content && <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>}
                {m.vaultEvents && m.vaultEvents.length > 0 && (
                  <div style={S.vaultNote}>{m.vaultEvents.join(' · ')}</div>
                )}
              </div>
            </div>
          ))}
          {loading && <div style={{ ...S.row, justifyContent: 'flex-start' }}><div style={{ ...S.bubble, ...S.aiBubble, opacity: 0.5 }}>thinking…</div></div>}
          <div ref={endRef} />
        </div>

        {pending.length > 0 && (
          <div style={S.pendingBar}>
            {pending.map((p, i) => (
              <div key={i} style={S.pendingItem}>
                {p.mimeType.startsWith('video')
                  ? '🎬'
                  : p.mimeType.startsWith('audio')
                    ? '🎙️'
                    : <img src={p.preview} alt="" style={S.pendingThumb} />}
                <button onClick={() => setPending(x => x.filter((_, j) => j !== i))} style={S.removeBtn}>×</button>
              </div>
            ))}
          </div>
        )}

        <div style={S.inputBar}>
          <button onClick={() => fileRef.current?.click()} style={S.attachBtn} title="attach photo, video, or voice note">+</button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*,audio/*,.caf,.amr,.aiff,.opus"
            multiple
            style={{ display: 'none' }}
            onChange={e => handleFiles(e.target.files)}
          />
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="text pinch…"
            style={S.input}
          />
          <button onClick={send} disabled={loading} style={S.sendBtn}>send</button>
        </div>
      </div>

      <div style={S.vaultCol}>
        <div style={S.vaultHeader}>Pinch control plane</div>

        <div style={S.sectionLabel}>Delegated tasks ({tasks.filter(t => t.status === 'pending' || t.status === 'snoozed').length})</div>
        <div style={S.taskComposer}>
          <input
            value={taskInput}
            onChange={event => setTaskInput(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') createTask() }}
            placeholder="add a task"
            style={S.taskInput}
          />
          <button onClick={createTask} style={S.taskAdd}>+</button>
        </div>
        {tasks.length === 0 && <div style={S.vaultEmpty}>Delegate a concrete job to Pinch.</div>}
        {tasks.map(task => (
          <div key={task._id} style={{ ...S.vaultItem, opacity: task.status === 'completed' ? 0.45 : 1 }}>
            <div style={S.taskRow}>
              <button
                onClick={() => completeTask(task._id)}
                disabled={task.status === 'completed' || task.status === 'cancelled'}
                aria-label={`Complete ${task.title}`}
                style={S.taskCheck}
              >{task.status === 'completed' ? '✓' : ''}</button>
              <div>
                <div style={S.memoryText}>{task.title}</div>
                <div style={S.vaultMeta}>{task.status}{task.dueAt ? ` · ${new Date(task.dueAt).toLocaleString()}` : ''}</div>
              </div>
            </div>
          </div>
        ))}

        <div style={{ ...S.sectionLabel, marginTop: 24 }}>Memory ({memories.length})</div>
        {memories.length === 0 && <div style={S.vaultEmpty}>Tell Pinch a lasting preference, relationship, or plan.</div>}
        {memories.map(memory => (
          <div key={memory.id} style={S.vaultItem}>
            <div style={S.memoryText}>{memory.memory_content}</div>
            <div style={S.vaultMeta}>
              {memory.memory_type}
              {memory.memory_key ? ` · ${memory.memory_key}` : ''}
            </div>
          </div>
        ))}

        <div style={{ ...S.sectionLabel, marginTop: 24 }}>Saved places ({places.length})</div>
        {places.length === 0 && <div style={S.vaultEmpty}>Share a TikTok or Reel link.</div>}
        {places.map(p => (
          <div key={p._id} style={S.vaultItem}>
            <div style={S.vaultName}>
              {p.name}
              {p.mentionCount > 1 && <span style={S.badge}>{p.mentionCount}×</span>}
            </div>
            <div style={S.vaultMeta}>{[p.category, p.city].filter(Boolean).join(' · ')}</div>
            {p.note && <div style={S.vaultNoteSm}>{p.note}</div>}
          </div>
        ))}

        <div style={{ ...S.sectionLabel, marginTop: 24 }}>Wardrobe ({garments.length})</div>
        {garments.length === 0 && <div style={S.vaultEmpty}>Upload an outfit photo.</div>}
        {garments.map(g => (
          <div key={g._id} style={S.vaultItem}>
            <div style={S.vaultName}>
              {g.item}
              {g.wornCount > 1 && <span style={S.badge}>{g.wornCount}×</span>}
            </div>
            <div style={S.vaultMeta}>{[g.color, g.category].filter(Boolean).join(' · ')}</div>
            {g.vibe && <div style={S.vaultNoteSm}>reads {g.vibe}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: { display: 'flex', height: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#0b0b0d', color: '#e8e8ea' },
  chatCol: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #1e1e22' },
  title: { fontSize: 15, fontWeight: 600 },
  sub: { fontSize: 12, color: '#6b6b73', marginTop: 2 },
  resetBtn: { background: 'transparent', border: '1px solid #2a2a30', color: '#9a9aa2', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' },
  messages: { flex: 1, overflowY: 'auto', padding: 20 },
  empty: { color: '#5a5a62', fontSize: 13, lineHeight: 1.9, marginTop: 40, textAlign: 'center' },
  row: { display: 'flex', marginBottom: 12 },
  bubble: { maxWidth: '78%', padding: '10px 14px', borderRadius: 18, fontSize: 14, lineHeight: 1.45 },
  userBubble: { background: '#2f6fed', color: '#fff', borderBottomRightRadius: 5 },
  aiBubble: { background: '#1a1a1f', color: '#e8e8ea', borderBottomLeftRadius: 5 },
  thumb: { maxWidth: 200, borderRadius: 10, display: 'block', marginBottom: 6 },
  audio: { width: 240, maxWidth: '100%', display: 'block', marginBottom: 6 },
  chart: { width: 'min(520px, 100%)', display: 'block', borderRadius: 14, marginBottom: 10, border: '1px solid #34303a' },
  vaultNote: { marginTop: 8, paddingTop: 8, borderTop: '1px solid #2a2a30', fontSize: 11, color: '#7ec98f' },
  pendingBar: { display: 'flex', gap: 8, padding: '8px 20px' },
  pendingItem: { position: 'relative', width: 48, height: 48, borderRadius: 8, background: '#1a1a1f', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  pendingThumb: { width: 48, height: 48, objectFit: 'cover', borderRadius: 8 },
  removeBtn: { position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, border: 'none', background: '#3a3a42', color: '#fff', fontSize: 12, cursor: 'pointer', lineHeight: 1 },
  inputBar: { display: 'flex', gap: 8, padding: '12px 20px 20px', alignItems: 'center' },
  attachBtn: { width: 34, height: 34, borderRadius: 17, border: '1px solid #2a2a30', background: 'transparent', color: '#9a9aa2', fontSize: 18, cursor: 'pointer', flexShrink: 0 },
  input: { flex: 1, background: '#141418', border: '1px solid #2a2a30', borderRadius: 18, padding: '9px 15px', color: '#e8e8ea', fontSize: 14, outline: 'none' },
  sendBtn: { background: '#2f6fed', border: 'none', color: '#fff', padding: '9px 18px', borderRadius: 18, fontSize: 13, cursor: 'pointer', flexShrink: 0 },
  vaultCol: { width: 300, borderLeft: '1px solid #1e1e22', overflowY: 'auto', padding: 20, flexShrink: 0 },
  vaultHeader: { fontSize: 15, fontWeight: 600, marginBottom: 20 },
  sectionLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#6b6b73', marginBottom: 10 },
  vaultEmpty: { fontSize: 12, color: '#4a4a52', marginBottom: 8 },
  vaultItem: { padding: '9px 0', borderBottom: '1px solid #17171b' },
  vaultName: { fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 },
  badge: { fontSize: 10, background: '#2a2a32', color: '#9a9aa2', padding: '1px 6px', borderRadius: 8 },
  vaultMeta: { fontSize: 11, color: '#6b6b73', marginTop: 2 },
  vaultNoteSm: { fontSize: 11, color: '#8a8a92', marginTop: 4, lineHeight: 1.4 },
  memoryText: { fontSize: 12, color: '#c9c9cf', lineHeight: 1.4 },
  taskComposer: { display: 'flex', gap: 6, marginBottom: 10 },
  taskInput: { minWidth: 0, flex: 1, background: '#141418', border: '1px solid #2a2a30', borderRadius: 8, padding: '7px 9px', color: '#e8e8ea', fontSize: 12, outline: 'none' },
  taskAdd: { width: 30, border: 0, borderRadius: 8, color: '#fff', background: '#2f6fed', cursor: 'pointer' },
  taskRow: { display: 'flex', alignItems: 'flex-start', gap: 8 },
  taskCheck: { width: 16, height: 16, marginTop: 1, padding: 0, flexShrink: 0, border: '1px solid #4a4a52', borderRadius: 5, background: 'transparent', color: '#7ec98f', fontSize: 11, lineHeight: '14px', cursor: 'pointer' },
}
