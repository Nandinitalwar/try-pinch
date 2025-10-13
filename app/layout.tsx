import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AstroWorld SMS API',
  description: 'Text-based astrology service powered by AI and Twilio',
  keywords: ['AI', 'Astrology', 'SMS', 'Twilio', 'API'],
  authors: [{ name: 'AstroWorld' }],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, backgroundColor: '#f5f5f5' }}>
        {children}
      </body>
    </html>
  )
} 