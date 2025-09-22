'use client'

import React, { useState } from 'react'
import { TimePeriodPrediction } from '../lib/types'
import { PredictionDatabase } from '../lib/predictionService'

interface PredictionFeedbackProps {
  prediction: TimePeriodPrediction
  onFeedbackSubmitted: () => void
  onClose: () => void
}

export default function PredictionFeedback({ 
  prediction, 
  onFeedbackSubmitted, 
  onClose 
}: PredictionFeedbackProps) {
  const [feedback, setFeedback] = useState<'success' | 'failed' | null>(null)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleFeedbackSubmit = async () => {
    if (!feedback) return
    
    setIsSubmitting(true)
    
    try {
      // Update prediction status
      PredictionDatabase.updatePredictionStatus(prediction.id, feedback, comment)
      
      // Save learning outcome
      const learningOutcome = {
        id: `learning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        starSign: prediction.userStarSign,
        category: prediction.category,
        prediction: prediction.prediction,
        outcome: feedback,
        astrologicalReasoning: prediction.astrologicalReasoning,
        createdAt: new Date(),
        userId: prediction.userId
      }
      
      PredictionDatabase.saveLearningOutcome(learningOutcome)
      
      // Update star sign category patterns
      PredictionDatabase.updateStarSignCategoryPatterns(
        prediction.userStarSign, 
        prediction.category, 
        feedback
      )
      
      onFeedbackSubmitted()
    } catch (error) {
      console.error('Failed to submit feedback:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-semibold text-white mb-4">
          Prediction Feedback
        </h3>
        
        <div className="mb-4">
          <p className="text-gray-300 mb-2">
            I predicted: <span className="text-purple-400 font-medium">{prediction.prediction}</span>
          </p>
          <p className="text-gray-300 mb-4">
            Category: <span className="text-blue-400 capitalize">{prediction.category}</span>
          </p>
        </div>
        
        <div className="mb-4">
          <p className="text-white mb-3">Did this prediction come true?</p>
          <div className="flex gap-3">
            <button
              onClick={() => setFeedback('success')}
              className={`flex-1 py-2 px-4 rounded-lg border transition-colors ${
                feedback === 'success'
                  ? 'bg-green-600 border-green-500 text-white'
                  : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
              }`}
            >
              ✅ Yes
            </button>
            <button
              onClick={() => setFeedback('failed')}
              className={`flex-1 py-2 px-4 rounded-lg border transition-colors ${
                feedback === 'failed'
                  ? 'bg-red-600 border-red-500 text-white'
                  : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
              }`}
            >
              ❌ No
            </button>
          </div>
        </div>
        
        {feedback && (
          <div className="mb-4">
            <label className="block text-white mb-2">
              Additional comments (optional):
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What happened? Any details that could help improve future predictions?"
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
              rows={3}
            />
          </div>
        )}
        
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleFeedbackSubmit}
            disabled={!feedback || isSubmitting}
            className="flex-1 py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </div>
      </div>
    </div>
  )
}
