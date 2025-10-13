export default function Home() {
  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', maxWidth: '800px', margin: '0 auto' }}>
      <h1>AstroWorld SMS API</h1>
      <p>Text-based astrology service powered by AI</p>
      
      <h2>Endpoints</h2>
      <ul>
        <li><strong>POST /api/webhook/twilio</strong> - Twilio SMS webhook</li>
        <li><strong>POST /api/sms</strong> - Send SMS messages</li>
        <li><strong>POST /api/chat</strong> - AI chat completions</li>
        <li><strong>GET /logs</strong> - View real-time development logs (dev only)</li>
      </ul>
      
      <h2>Development</h2>
      <p>
        <a href="/logs" style={{ 
          color: '#0070f3', 
          textDecoration: 'none',
          fontWeight: 'bold',
          padding: '8px 16px',
          backgroundColor: '#f0f0f0',
          borderRadius: '4px',
          display: 'inline-block',
          marginTop: '10px'
        }}>
          View Real-Time Logs 📊
        </a>
      </p>
      
      <h2>Setup</h2>
      <p>Configure your Twilio webhook URL to point to: <code>{typeof window !== 'undefined' ? window.location.origin : '[your-domain]'}/api/webhook/twilio</code></p>
      
      <h2>Environment Variables</h2>
      <ul>
        <li>TWILIO_ACCOUNT_SID</li>
        <li>TWILIO_AUTH_TOKEN</li>
        <li>TWILIO_PHONE_NUMBER</li>
        <li>OPENAI_API_KEY</li>
        <li>NEXT_PUBLIC_SUPABASE_URL</li>
        <li>SUPABASE_SERVICE_ROLE_KEY</li>
      </ul>
      
      <h2>Testing</h2>
      <ul>
        <li>Run <code>npm run test:supabase</code> to verify Supabase integration</li>
        <li>Run <code>npm run dev</code> and visit <code>/logs</code> to see API logs</li>
      </ul>
      
      <p style={{ marginTop: '40px', color: '#666' }}>
        Users can text your Twilio number to chat with the AI astrologer.
      </p>
    </div>
  )
}