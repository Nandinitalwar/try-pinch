import { TimePeriodPrediction, LearningOutcome, StarSignCategoryPattern } from './types'

// Prediction extraction patterns
const TIME_PATTERNS = [
  /between (\w+ \d{4}) and (\w+ \d{4})/gi,
  /from (\w+) to (\w+) (\d{4})/gi,
  /during (\w+) of (\d{4})/gi,
  /in (\w+ \d{4})/gi,
  /(\w+ \d{4}) to (\w+ \d{4})/gi,
  /(\w+ \d{4}) through (\w+ \d{4})/gi
]

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
]

export class PredictionService {
  // Extract time periods from AI responses
  static extractTimePeriods(content: string): Array<{ startDate: Date; endDate: Date; text: string }> {
    const periods: Array<{ startDate: Date; endDate: Date; text: string }> = []
    
    for (const pattern of TIME_PATTERNS) {
      const matches = Array.from(content.matchAll(pattern))
      for (const match of matches) {
        try {
          let startDate: Date
          let endDate: Date
          let text: string
          
          if (pattern.source.includes('between') || pattern.source.includes('to')) {
            // "between March 2025 and September 2025"
            startDate = this.parseDate(match[1])
            endDate = this.parseDate(match[2])
            text = match[0]
          } else if (pattern.source.includes('from')) {
            // "from April to June 2025"
            const year = match[3]
            startDate = this.parseDate(`${match[1]} ${year}`)
            endDate = this.parseDate(`${match[2]} ${year}`)
            text = match[0]
          } else if (pattern.source.includes('during')) {
            // "during summer of 2025"
            const year = match[2]
            const season = match[1]
            const seasonDates = this.getSeasonDates(season, parseInt(year))
            startDate = seasonDates.start
            endDate = seasonDates.end
            text = match[0]
          } else if (pattern.source.includes('in')) {
            // "in March 2025"
            const date = this.parseDate(match[1])
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)
            startDate = date
            endDate = endOfMonth
            text = match[0]
          } else {
            // Generic pattern
            startDate = this.parseDate(match[1])
            endDate = this.parseDate(match[2])
            text = match[0]
          }
          
          if (startDate && endDate && startDate < endDate) {
            periods.push({ startDate, endDate, text })
          }
        } catch (error) {
          console.log('Failed to parse date pattern:', match[0], error)
        }
      }
    }
    
    return periods
  }
  
  // Parse date strings like "March 2025"
  private static parseDate(dateStr: string): Date {
    const parts = dateStr.trim().toLowerCase().split(' ')
    if (parts.length !== 2) throw new Error('Invalid date format')
    
    const month = parts[0]
    const year = parseInt(parts[1])
    
    if (isNaN(year) || year < 2020 || year > 2030) {
      throw new Error('Invalid year')
    }
    
    const monthIndex = MONTHS.indexOf(month)
    if (monthIndex === -1) throw new Error('Invalid month')
    
    return new Date(year, monthIndex, 1)
  }
  
  // Get season dates
  private static getSeasonDates(season: string, year: number): { start: Date; end: Date } {
    const seasonLower = season.toLowerCase()
    
    switch (seasonLower) {
      case 'spring':
        return { start: new Date(year, 2, 20), end: new Date(year, 5, 20) }
      case 'summer':
        return { start: new Date(year, 5, 21), end: new Date(year, 8, 22) }
      case 'autumn':
      case 'fall':
        return { start: new Date(year, 8, 23), end: new Date(year, 11, 20) }
      case 'winter':
        return { start: new Date(year, 11, 21), end: new Date(year + 1, 2, 19) }
      default:
        throw new Error('Invalid season')
    }
  }
  
  // Determine prediction category from question
  static categorizeQuestion(question: string): 'love' | 'career' | 'health' | 'travel' | 'education' | 'general' {
    const lowerQuestion = question.toLowerCase()
    
    if (lowerQuestion.includes('marry') || lowerQuestion.includes('relationship') || lowerQuestion.includes('love') || 
        lowerQuestion.includes('romance') || lowerQuestion.includes('partner') || lowerQuestion.includes('soulmate')) {
      return 'love'
    }
    
    if (lowerQuestion.includes('job') || lowerQuestion.includes('career') || lowerQuestion.includes('promotion') || 
        lowerQuestion.includes('business') || lowerQuestion.includes('work') || lowerQuestion.includes('salary')) {
      return 'career'
    }
    
    if (lowerQuestion.includes('health') || lowerQuestion.includes('illness') || lowerQuestion.includes('recovery') || 
        lowerQuestion.includes('wellness') || lowerQuestion.includes('medical') || lowerQuestion.includes('healing')) {
      return 'health'
    }
    
    if (lowerQuestion.includes('travel') || lowerQuestion.includes('trip') || lowerQuestion.includes('journey') || 
        lowerQuestion.includes('vacation') || lowerQuestion.includes('move') || lowerQuestion.includes('relocation')) {
      return 'travel'
    }
    
    if (lowerQuestion.includes('study') || lowerQuestion.includes('exam') || lowerQuestion.includes('education') || 
        lowerQuestion.includes('learning') || lowerQuestion.includes('school') || lowerQuestion.includes('college')) {
      return 'education'
    }
    
    return 'general'
  }
  
  // Create prediction from AI response
  static createPrediction(
    userId: string,
    userStarSign: string,
    question: string,
    aiResponse: string,
    messageId: string
  ): TimePeriodPrediction | null {
    const periods = this.extractTimePeriods(aiResponse)
    if (periods.length === 0) return null
    
    const category = this.categorizeQuestion(question)
    const period = periods[0] // Use first time period found
    
    return {
      id: `pred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      userStarSign,
      question,
      prediction: period.text,
      startDate: period.startDate,
      endDate: period.endDate,
      category,
      confidence: 0.8, // Default confidence
      astrologicalReasoning: this.extractAstrologicalReasoning(aiResponse),
      createdAt: new Date(),
      status: 'pending',
      reminderSent: false,
      messageId
    }
  }
  
  // Extract astrological reasoning from AI response
  private static extractAstrologicalReasoning(response: string): string {
    // Look for reasoning after "because", "since", "as", etc.
    const reasoningPatterns = [
      /because (.+?)(?=\.|$)/i,
      /since (.+?)(?=\.|$)/i,
      /as (.+?)(?=\.|$)/i,
      /due to (.+?)(?=\.|$)/i
    ]
    
    for (const pattern of reasoningPatterns) {
      const match = response.match(pattern)
      if (match) {
        return match[1].trim()
      }
    }
    
    // Fallback: extract last sentence as reasoning
    const sentences = response.split('.')
    return sentences[sentences.length - 2]?.trim() || 'Astrological timing based on planetary positions'
  }
  
  // Check if prediction date has passed
  static isPredictionExpired(prediction: TimePeriodPrediction): boolean {
    return new Date() > prediction.endDate
  }
  
  // Check if prediction is approaching (within 7 days)
  static isPredictionApproaching(prediction: TimePeriodPrediction): boolean {
    const now = new Date()
    const timeUntilStart = prediction.startDate.getTime() - now.getTime()
    const daysUntilStart = timeUntilStart / (1000 * 60 * 60 * 24)
    return daysUntilStart <= 7 && daysUntilStart > 0
  }
  
  // Get feedback request message for expired predictions
  static getFeedbackRequestMessage(prediction: TimePeriodPrediction): string {
    return `Last time I predicted "${prediction.prediction}" for you. Did this prediction come true? Please let me know so I can improve my future predictions for you and others with your star sign.`
  }
}

// Database operations for predictions
export class PredictionDatabase {
  private static getStorageKey(key: string): string {
    return `astro_predictions_${key}`
  }
  
  // Save prediction
  static savePrediction(prediction: TimePeriodPrediction): void {
    try {
      const predictions = this.getAllPredictions()
      predictions.push(prediction)
      localStorage.setItem(this.getStorageKey('all'), JSON.stringify(predictions))
    } catch (error) {
      console.error('Failed to save prediction:', error)
    }
  }
  
  // Get all predictions
  static getAllPredictions(): TimePeriodPrediction[] {
    try {
      const stored = localStorage.getItem(this.getStorageKey('all'))
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Failed to get predictions:', error)
      return []
    }
  }
  
  // Get predictions by user
  static getUserPredictions(userId: string): TimePeriodPrediction[] {
    return this.getAllPredictions().filter(p => p.userId === userId)
  }
  
  // Get pending predictions that need feedback
  static getPendingFeedbackPredictions(userId: string): TimePeriodPrediction[] {
    return this.getUserPredictions(userId).filter(p => 
      p.status === 'pending' && PredictionService.isPredictionExpired(p)
    )
  }
  
  // Update prediction status
  static updatePredictionStatus(
    predictionId: string, 
    status: 'success' | 'failed', 
    feedback?: string
  ): void {
    try {
      const predictions = this.getAllPredictions()
      const prediction = predictions.find(p => p.id === predictionId)
      if (prediction) {
        prediction.status = status
        prediction.userFeedback = feedback
        prediction.actualOutcome = status
        localStorage.setItem(this.getStorageKey('all'), JSON.stringify(predictions))
      }
    } catch (error) {
      console.error('Failed to update prediction:', error)
    }
  }
  
  // Save learning outcome
  static saveLearningOutcome(outcome: LearningOutcome): void {
    try {
      const outcomes = this.getAllLearningOutcomes()
      outcomes.push(outcome)
      localStorage.setItem(this.getStorageKey('learning'), JSON.stringify(outcomes))
    } catch (error) {
      console.error('Failed to save learning outcome:', error)
    }
  }
  
  // Get all learning outcomes
  static getAllLearningOutcomes(): LearningOutcome[] {
    try {
      const stored = localStorage.getItem(this.getStorageKey('learning'))
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Failed to get learning outcomes:', error)
      return []
    }
  }
  
  // Get star sign category patterns
  static getStarSignCategoryPatterns(): StarSignCategoryPattern[] {
    try {
      const stored = localStorage.getItem(this.getStorageKey('patterns'))
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Failed to get patterns:', error)
      return []
    }
  }
  
  // Update star sign category patterns
  static updateStarSignCategoryPatterns(starSign: string, category: string, outcome: 'success' | 'failed'): void {
    try {
      const patterns = this.getStarSignCategoryPatterns()
      let pattern = patterns.find(p => p.starSign === starSign && p.category === category)
      
      if (!pattern) {
        pattern = {
          starSign,
          category,
          successRate: 0,
          totalPredictions: 0,
          successfulPredictions: 0,
          averageTimeframe: 0,
          lastUpdated: new Date(),
          commonReasons: []
        }
        patterns.push(pattern)
      }
      
      pattern.totalPredictions++
      if (outcome === 'success') {
        pattern.successfulPredictions++
      }
      pattern.successRate = pattern.successfulPredictions / pattern.totalPredictions
      pattern.lastUpdated = new Date()
      
      localStorage.setItem(this.getStorageKey('patterns'), JSON.stringify(patterns))
    } catch (error) {
      console.error('Failed to update patterns:', error)
    }
  }
}
