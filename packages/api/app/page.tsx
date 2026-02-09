export default function Home() {
  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Pinch API</h1>
      <p>SMS AI Astrologer webhook service.</p>
      <code style={{ display: 'block', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px', marginTop: '10px' }}>
        POST /api/webhook/twilio
      </code>
    </div>
  )
}