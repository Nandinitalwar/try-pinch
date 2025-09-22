'use client'

import React from 'react'
import AuthPage from '../../components/AuthPage'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back to Chat Link */}
        <Link 
          href="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to chat
        </Link>

        {/* Login Card */}
        <div className="bg-gray-800 rounded-lg p-8 shadow-xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Welcome to AstroWorld</h1>
            <p className="text-gray-400">Sign in to save your chat history and get personalized insights</p>
          </div>
          
          <AuthPage />
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-500">
            By continuing, you agree to our terms of service
          </p>
        </div>
      </div>
    </div>
  )
}