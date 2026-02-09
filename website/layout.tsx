import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pinch – Your AI Astrologer via SMS',
  description: 'Text Pinch for personality-driven astrological advice. No apps, no jargon, just real talk about your chart.',
  keywords: ['AI', 'Astrology', 'SMS', 'AI Astrologer', 'Birth Chart', 'Horoscope'],
  authors: [{ name: 'Pinch' }],
  openGraph: {
    title: 'Pinch – Your AI Astrologer via SMS',
    description: 'Text Pinch for personality-driven astrological advice.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ 
        fontFamily: 'Arial, sans-serif', 
        margin: 0, 
        backgroundColor: '#ffffff',
        color: '#000000'
      }}>
        {children}
      </body>
    </html>
  )
} 