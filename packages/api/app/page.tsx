import { redirect } from 'next/navigation'

export default function Home() {
  // Locally, this service is primarily the Pinch test console. Make the URL
  // developers naturally type land on the actual tester, while retaining the
  // lightweight API status page in production.
  if (process.env.NODE_ENV !== 'production') {
    redirect('/test')
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Pinch API</h1>
      <p>SMS/iMessage AI Astrologer webhook service.</p>
      <code style={{ display: 'block', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px', marginTop: '10px' }}>
        POST /api/webhook/twilio
      </code>
      <code style={{ display: 'block', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px', marginTop: '10px' }}>
        POST /api/webhook/linq
      </code>
    </div>
  )
}
