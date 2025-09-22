import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { UserProfileProvider } from '@/lib/UserProfileContext'
import { AuthProvider } from '@/lib/AuthContext'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter'
})

export const metadata: Metadata = {
  title: 'AstroWorld - AI Astrologer',
  description: 'Your personal AI astrologer powered by OpenAI. Get cosmic insights and celestial guidance.',
  keywords: ['AI', 'Astrology', 'OpenAI', 'Cosmic Guidance', 'Zodiac'],
  authors: [{ name: 'AstroWorld' }],
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <AuthProvider>
          <UserProfileProvider>
            {children}
          </UserProfileProvider>
        </AuthProvider>
      </body>
    </html>
  )
} 