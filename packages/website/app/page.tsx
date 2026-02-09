'use client'

import { useState } from 'react'

export default function Home() {
  const phoneNumber = '+1 (888) 921-1387'
  const smsLink = 'sms:+18889211387'
  const [isPinched, setIsPinched] = useState(false)

  const examples = [
    {
      user: "should i take a sick day at work tmr?",
      pinch: "Take the sick day. Your Pisces energy is way too scattered this week to push through — you'll just end up half-assing everything. Rest now, show up sharp Thursday."
    },
    {
      user: "what should i eat for dinner?",
      pinch: "Dal makhani and garlic naan. Taurus moons always need something rich and grounding when they're running on empty — don't overthink it."
    },
    {
      user: "how do i deal with my annoying coworker?",
      pinch: "Stop trying to win them over. You're a Scorpio — you don't need to be liked by everyone. Just be professional and keep it moving."
    }
  ]

  const messages = [
    { role: 'user', text: "should i take a sick day at work tmr?" },
    { role: 'pinch', text: "Take the sick day. You're a Scorpio running on fumes — you'll just snap at someone if you push through. Rest now, show up sharp Thursday." },
    { role: 'user', text: "ok what should i eat for dinner then" },
    { role: 'pinch', text: "Dal makhani and garlic naan. Your Taurus moon needs something rich and grounding when you're running on empty — don't overthink it." },
    { role: 'user', text: "lol also how do i deal with my annoying coworker" },
    { role: 'pinch', text: "Stop trying to win them over. You don't need to be liked by everyone. Just be professional and keep it moving." }
  ]

  return (
    <>
      <main style={{
        minHeight: '100vh',
        background: '#ffffff',
        padding: '40px 20px',
        fontFamily: 'Arial, sans-serif',
        transform: isPinched ? 'scale(0.95)' : 'scale(1)',
        transition: 'transform 0.3s ease'
      }}>
        <div style={{
          maxWidth: '700px',
          margin: '0 auto'
        }}>

          {/* Hero */}
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <h1 style={{
              fontSize: '32px',
              fontWeight: 'normal',
              margin: '0 0 16px 0',
              color: '#000000'
            }}>
              Try <span 
                onMouseEnter={() => setIsPinched(true)}
                onMouseLeave={() => setIsPinched(false)}
                style={{ cursor: 'pointer' }}
              >Pinch</span>
            </h1>
            
            <p style={{
              fontSize: '18px',
              fontWeight: 'normal',
              color: '#000000',
              margin: '0 0 32px 0'
            }}>
              Your AI astrologer, right in your texts.
            </p>

            <div>
              <a href={smsLink} style={{
                color: '#000000',
                fontSize: '18px',
                fontWeight: 'normal'
              }}>
                {phoneNumber}
              </a>
            </div>
          </div>

          {/* SMS thread */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                <div style={{
                  display: 'inline-block',
                  background: msg.role === 'user' ? '#34C759' : '#E5E5EA',
                  color: msg.role === 'user' ? '#ffffff' : '#000000',
                  padding: '10px 14px',
                  borderRadius: '18px',
                  maxWidth: '70%',
                  fontSize: '15px',
                  lineHeight: '1.4'
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  )
}
