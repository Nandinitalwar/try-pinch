'use client'

import { useState } from 'react'

export default function Home() {
  const phoneNumber = '+1 (888) 921-1387'
  const smsLink = 'sms:+18889211387'
  const [isPinched, setIsPinched] = useState(false)

  const examples = [
    {
      user: "should i take a sick day at work tmr?",
      pinch: "Take the sick day. You're gonna feel scattered tomorrow anyway, and you need to be sharp for your date. Just rest."
    },
    {
      user: "what should i eat for dinner?",
      pinch: "Dal makhani and garlic naan. You need something rich and grounding tonight — your energy's all over the place."
    },
    {
      user: "should i go to this party or stay home?",
      pinch: "Stay home. You're drained and forcing yourself out will just make it worse. Recharge tonight, go out when you actually want to."
    },
    {
      user: "how do i deal with my annoying coworker?",
      pinch: "Stop trying to win them over. You're a Scorpio — you don't need to be liked by everyone. Just be professional and keep it moving."
    }
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

          <div style={{ marginTop: '60px' }}>
            <div style={{
              display: 'grid',
              gap: '12px'
            }}>
              {examples.map((example, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {/* User message - right aligned, green */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      display: 'inline-block',
                      background: '#34C759',
                      color: '#ffffff',
                      padding: '10px 14px',
                      borderRadius: '18px',
                      maxWidth: '70%',
                      fontSize: '15px',
                      lineHeight: '1.4'
                    }}>
                      {example.user}
                    </div>
                  </div>

                  {/* Pinch response - left aligned, gray */}
                  <div style={{ textAlign: 'left' }}>
                    <div style={{
                      display: 'inline-block',
                      background: '#E5E5EA',
                      color: '#000000',
                      padding: '10px 14px',
                      borderRadius: '18px',
                      maxWidth: '70%',
                      fontSize: '15px',
                      lineHeight: '1.4'
                    }}>
                      {example.pinch}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
