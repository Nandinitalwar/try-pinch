'use client'

import { useState, useEffect, Suspense } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function ResetPasswordForm() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isValidSession, setIsValidSession] = useState(false)
  
  const { updatePassword } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleAuthTokens = async () => {
      console.log('Current URL:', window.location.href)
      console.log('Current hash:', window.location.hash)
      
      // Check if we have valid tokens from the email link (URL params)
      const accessToken = searchParams.get('access_token')
      const refreshToken = searchParams.get('refresh_token')
      const type = searchParams.get('type')
      
      // Also check hash fragments (Supabase sometimes uses these)
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const hashAccessToken = hashParams.get('access_token')
      const hashRefreshToken = hashParams.get('refresh_token')
      const hashType = hashParams.get('type')
      
      console.log('Reset password page - URL params:')
      console.log('access_token:', accessToken)
      console.log('refresh_token:', refreshToken)
      console.log('type:', type)
      console.log('All search params:', Object.fromEntries(searchParams.entries()))
      
      console.log('Hash params:')
      console.log('hash access_token:', hashAccessToken)
      console.log('hash refresh_token:', hashRefreshToken)
      console.log('hash type:', hashType)
      console.log('All hash params:', Object.fromEntries(hashParams.entries()))
      
      // Use hash params if URL params are not available
      const finalAccessToken = accessToken || hashAccessToken
      const finalRefreshToken = refreshToken || hashRefreshToken
      const finalType = type || hashType
      
      console.log('Final tokens to use:')
      console.log('finalAccessToken:', finalAccessToken)
      console.log('finalRefreshToken:', finalRefreshToken)
      console.log('finalType:', finalType)
      
      if (finalAccessToken && finalRefreshToken && finalType === 'recovery') {
        console.log('Valid tokens found, setting up session...')
        
        try {
          // Set the session using the tokens
          const { data, error } = await supabase.auth.setSession({
            access_token: finalAccessToken,
            refresh_token: finalRefreshToken,
          })
          
          console.log('Session setup result:', { data, error })
          
          if (error) {
            console.error('Error setting session:', error)
            setError('Invalid or expired reset link. Please request a new password reset.')
          } else {
            console.log('Session set successfully, user:', data.user)
            setIsValidSession(true)
          }
        } catch (err) {
          console.error('Exception setting session:', err)
          setError('Invalid or expired reset link. Please request a new password reset.')
        }
      } else {
        console.log('Invalid or missing tokens')
        setError('Invalid or expired reset link. Please request a new password reset.')
      }
    }
    
    handleAuthTokens()
  }, [searchParams])

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    
    console.log('Password update attempt started')
    
    if (!password || !confirmPassword) {
      console.log('Validation failed: missing password fields')
      setError('Please fill in all fields')
      return
    }

    if (password !== confirmPassword) {
      console.log('Validation failed: passwords do not match')
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      console.log('Validation failed: password too short')
      setError('Password must be at least 6 characters long')
      return
    }

    setIsLoading(true)
    setError('')
    setMessage('')
    
    console.log('Calling updatePassword...')

    try {
      const { error } = await updatePassword(password)
      
      console.log('Update password result:', { error })
      
      if (error) {
        console.error('Password update failed:', error)
        setError(error.message)
      } else {
        console.log('Password updated successfully')
        setMessage('Password updated successfully! Redirecting to login...')
        setTimeout(() => {
          router.push('/')
        }, 2000)
      }
    } catch (err) {
      console.error('Exception during password update:', err)
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
              Set New Password
            </h1>
            <p className="mt-2 text-stardust-300">
              Enter your new password below
            </p>
          </div>

          {!isValidSession ? (
            <div className="space-y-6">
              <div className="text-red-400 text-sm text-center bg-red-900/20 p-3 rounded-lg">
                {error}
              </div>
              <div className="text-center">
                <Link 
                  href="/" 
                  className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
                >
                  Back to Sign In
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handlePasswordUpdate} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-stardust-300 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                  placeholder="Enter new password"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stardust-300 mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="form-input"
                  placeholder="Confirm new password"
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
                {isLoading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-stardust-900 flex items-center justify-center px-4">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}