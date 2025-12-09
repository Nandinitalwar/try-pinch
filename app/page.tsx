export default function Home() {
  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Pinch SMS Bot</h1>
      <p>AI Astrologer SMS service</p>
      
      <h2>Webhook Endpoint</h2>
      <code style={{ display: 'block', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px', marginTop: '10px' }}>
        POST /api/webhook/twilio
      </code>
      
      <p style={{ marginTop: '20px' }}>
        Configure your Twilio webhook URL to point to this endpoint.
      </p>
    </div>
  )
}
