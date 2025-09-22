export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  userProfile?: UserProfile | null
  predictionId?: string
}

export interface UserProfile {
  id: string
  name: string
  dateOfBirth: string
  timeOfBirth: string
  placeOfBirth: string
  starSign: string
  currentProblems: string[]
  phoneNumber?: string
  smsNotifications?: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ChatSession {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
  userProfile?: UserProfile
  userId?: string
}

export interface TimePeriodPrediction {
  id: string
  userId: string
  userStarSign: string
  question: string
  prediction: string
  startDate: Date
  endDate: Date
  category: 'love' | 'career' | 'health' | 'travel' | 'education' | 'general'
  confidence: number
  astrologicalReasoning: string
  createdAt: Date
  status: 'pending' | 'success' | 'failed' | 'expired'
  userFeedback?: string
  actualOutcome?: string
  reminderSent: boolean
  messageId: string
}

export interface LearningOutcome {
  id: string
  starSign: string
  category: string
  prediction: string
  outcome: 'success' | 'failed'
  astrologicalReasoning: string
  createdAt: Date
  userId?: string
}

export interface StarSignCategoryPattern {
  starSign: string
  category: string
  successRate: number
  totalPredictions: number
  successfulPredictions: number
  averageTimeframe: number
  lastUpdated: Date
  commonReasons: string[]
}

export interface Contact {
  id: string
  name: string
  phone?: string
  email?: string
  relationship: string
} 