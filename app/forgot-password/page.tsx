'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  
  const { resetPassword } = useAuth()
  const router = useRouter()

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      setError('Please enter your email address')
      return
    }

    setIsLoading(true)
    setError('')
    setMessage('')

    try {
      const { error } = await resetPassword(email)
      
      if (error) {
        setError(error.message)
      } else {
        setMessage('Password reset instructions have been sent to your email. Check your inbox and click the link to reset your password.')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-stardust-900 flex items-center justify-center px-4">
      <div className="cosmic-bg relative">
        <div className="max-w-md w-full space-y-8 bg-stardust-800/50 backdrop-blur-sm p-8 rounded-2xl border border-stardust-700 cosmic-glow">
          <div className="text-center">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
              Reset Password
            </h1>
            <p className="mt-2 text-stardust-300">
              Enter your email to receive reset instructions
            </p>
          </div>

          <form onSubmit={handleRequestReset} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-stardust-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                placeholder="Enter your email"
                required
              />
            </div>

            {error && (
              <div className="text-red-400 text-sm text-center bg-red-900/20 p-3 rounded-lg">
                {error}
              </div>
            )}

            {message && (
              <div className="text-green-400 text-sm text-center bg-green-900/20 p-3 rounded-lg">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary"
            >
              {isLoading ? 'Sending...' : 'Send Reset Instructions'}
            </button>

            <div className="text-center">
              <Link 
                href="/" 
                className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
              >
                Back to Sign In
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}