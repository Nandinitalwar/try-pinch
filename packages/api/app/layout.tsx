import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pinch API',
  description: 'SMS AI Astrologer webhook service',
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