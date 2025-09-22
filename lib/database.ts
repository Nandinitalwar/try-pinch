// Database infrastructure for AstroWorld
// Currently uses localStorage for persistence, but designed for easy migration to real databases

export interface ChatSession {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
  userProfile?: any
  userId?: string // For future multi-user support
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  userProfile?: any
  responseType?: 'specific' | 'general'
  storedResponse?: string
}

export interface UserProfile {
  id: string
  name: string
  dateOfBirth: string
  timeOfBirth: string
  placeOfBirth: string
  starSign: string
  currentProblems: string[]
  contacts: Contact[]
  createdAt: Date
  updatedAt: Date
}

export interface Contact {
  id: string
  name: string
  phone?: string
  email?: string
  relationship: string
}

export interface StoredResponse {
  id: string
  question: string
  response: string
  userId?: string
  createdAt: Date
  tags?: string[]
}

// Database class for managing data persistence
export class AstroWorldDatabase {
  private static instance: AstroWorldDatabase
  private storagePrefix = 'astroworld_'

  private constructor() {}

  public static getInstance(): AstroWorldDatabase {
    if (!AstroWorldDatabase.instance) {
      AstroWorldDatabase.instance = new AstroWorldDatabase()
    }
    return AstroWorldDatabase.instance
  }

  // Chat Sessions Management
  async saveChatSession(session: ChatSession): Promise<void> {
    try {
      const sessions = await this.getChatSessions()
      const existingIndex = sessions.findIndex(s => s.id === session.id)
      
      if (existingIndex >= 0) {
        sessions[existingIndex] = session
      } else {
        sessions.unshift(session) // Add new sessions at the beginning
      }
      
      localStorage.setItem(`${this.storagePrefix}chat_sessions`, JSON.stringify(sessions))
    } catch (error) {
      console.error('Error saving chat session:', error)
      throw error
    }
  }

  async getChatSessions(): Promise<ChatSession[]> {
    try {
      const saved = localStorage.getItem(`${this.storagePrefix}chat_sessions`)
      if (!saved) return []
      
      const parsed = JSON.parse(saved)
      // Convert date strings back to Date objects
      return parsed.map((chat: any) => ({
        ...chat,
        createdAt: new Date(chat.createdAt),
        updatedAt: new Date(chat.updatedAt)
      }))
    } catch (error) {
      console.error('Error loading chat sessions:', error)
      return []
    }
  }

  async deleteChatSession(sessionId: string): Promise<void> {
    try {
      const sessions = await this.getChatSessions()
      const filtered = sessions.filter(s => s.id !== sessionId)
      localStorage.setItem(`${this.storagePrefix}chat_sessions`, JSON.stringify(filtered))
    } catch (error) {
      console.error('Error deleting chat session:', error)
      throw error
    }
  }

  async getChatSession(sessionId: string): Promise<ChatSession | null> {
    try {
      const sessions = await this.getChatSessions()
      return sessions.find(s => s.id === sessionId) || null
    } catch (error) {
      console.error('Error loading chat session:', error)
      return null
    }
  }

  // User Profile Management
  async saveUserProfile(profile: UserProfile): Promise<void> {
    try {
      localStorage.setItem(`${this.storagePrefix}user_profile`, JSON.stringify(profile))
    } catch (error) {
      console.error('Error saving user profile:', error)
      throw error
    }
  }

  async getUserProfile(): Promise<UserProfile | null> {
    try {
      const saved = localStorage.getItem(`${this.storagePrefix}user_profile`)
      if (!saved) return null
      
      const parsed = JSON.parse(saved)
      return {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
        updatedAt: new Date(parsed.updatedAt)
      }
    } catch (error) {
      console.error('Error loading user profile:', error)
      return null
    }
  }

  // Stored Responses Management
  async saveStoredResponse(response: StoredResponse): Promise<void> {
    try {
      const responses = await this.getStoredResponses()
      const existingIndex = responses.findIndex(r => r.id === response.id)
      
      if (existingIndex >= 0) {
        responses[existingIndex] = response
      } else {
        responses.unshift(response)
      }
      
      localStorage.setItem(`${this.storagePrefix}stored_responses`, JSON.stringify(responses))
    } catch (error) {
      console.error('Error saving stored response:', error)
      throw error
    }
  }

  async getStoredResponses(): Promise<StoredResponse[]> {
    try {
      const saved = localStorage.getItem(`${this.storagePrefix}stored_responses`)
      if (!saved) return []
      
      const parsed = JSON.parse(saved)
      return parsed.map((response: any) => ({
        ...response,
        createdAt: new Date(response.createdAt)
      }))
    } catch (error) {
      console.error('Error loading stored responses:', error)
      return []
    }
  }

  async deleteStoredResponse(responseId: string): Promise<void> {
    try {
      const responses = await this.getStoredResponses()
      const filtered = responses.filter(r => r.id !== responseId)
      localStorage.setItem(`${this.storagePrefix}stored_responses`, JSON.stringify(filtered))
    } catch (error) {
      console.error('Error deleting stored response:', error)
      throw error
    }
  }

  // Search and Filter Functions
  async searchChatSessions(query: string): Promise<ChatSession[]> {
    try {
      const sessions = await this.getChatSessions()
      const lowerQuery = query.toLowerCase()
      
      return sessions.filter(session => 
        session.title.toLowerCase().includes(lowerQuery) ||
        session.messages.some(msg => 
          msg.content.toLowerCase().includes(lowerQuery)
        )
      )
    } catch (error) {
      console.error('Error searching chat sessions:', error)
      return []
    }
  }

  async getChatSessionsByDateRange(startDate: Date, endDate: Date): Promise<ChatSession[]> {
    try {
      const sessions = await this.getChatSessions()
      return sessions.filter(session => {
        const sessionDate = new Date(session.updatedAt)
        return sessionDate >= startDate && sessionDate <= endDate
      })
    } catch (error) {
      console.error('Error filtering chat sessions by date:', error)
      return []
    }
  }

  // Data Export/Import
  async exportAllData(): Promise<string> {
    try {
      const data = {
        chatSessions: await this.getChatSessions(),
        userProfile: await this.getUserProfile(),
        storedResponses: await this.getStoredResponses(),
        exportDate: new Date().toISOString()
      }
      return JSON.stringify(data, null, 2)
    } catch (error) {
      console.error('Error exporting data:', error)
      throw error
    }
  }

  async importData(data: string): Promise<void> {
    try {
      const parsed = JSON.parse(data)
      
      if (parsed.chatSessions) {
        localStorage.setItem(`${this.storagePrefix}chat_sessions`, JSON.stringify(parsed.chatSessions))
      }
      
      if (parsed.userProfile) {
        localStorage.setItem(`${this.storagePrefix}user_profile`, JSON.stringify(parsed.userProfile))
      }
      
      if (parsed.storedResponses) {
        localStorage.setItem(`${this.storagePrefix}stored_responses`, JSON.stringify(parsed.storedResponses))
      }
    } catch (error) {
      console.error('Error importing data:', error)
      throw error
    }
  }

  // Database Maintenance
  async clearAllData(): Promise<void> {
    try {
      const keys = Object.keys(localStorage)
      const astroKeys = keys.filter(key => key.startsWith(this.storagePrefix))
      astroKeys.forEach(key => localStorage.removeItem(key))
    } catch (error) {
      console.error('Error clearing data:', error)
      throw error
    }
  }

  async getDatabaseStats(): Promise<{
    chatSessions: number
    totalMessages: number
    storedResponses: number
    totalStorageSize: number
  }> {
    try {
      const sessions = await this.getChatSessions()
      const responses = await this.getStoredResponses()
      const totalMessages = sessions.reduce((sum, session) => sum + session.messages.length, 0)
      
      // Calculate storage size
      const allData = {
        chatSessions: sessions,
        userProfile: await this.getUserProfile(),
        storedResponses: responses
      }
      const storageSize = new Blob([JSON.stringify(allData)]).size
      
      return {
        chatSessions: sessions.length,
        totalMessages,
        storedResponses: responses.length,
        totalStorageSize: storageSize
      }
    } catch (error) {
      console.error('Error getting database stats:', error)
      return {
        chatSessions: 0,
        totalMessages: 0,
        storedResponses: 0,
        totalStorageSize: 0
      }
    }
  }
}

// Export singleton instance
export const db = AstroWorldDatabase.getInstance()

// Future database integration hooks (for when you want to add real databases)
export interface DatabaseProvider {
  saveChatSession(session: ChatSession): Promise<void>
  getChatSessions(): Promise<ChatSession[]>
  deleteChatSession(sessionId: string): Promise<void>
  getChatSession(sessionId: string): Promise<ChatSession | null>
  saveUserProfile(profile: UserProfile): Promise<void>
  getUserProfile(): Promise<UserProfile | null>
  saveStoredResponse(response: StoredResponse): Promise<void>
  getStoredResponses(): Promise<StoredResponse[]>
  deleteStoredResponse(responseId: string): Promise<void>
}

// Example: PostgreSQL provider (for future use)
export class PostgreSQLProvider implements DatabaseProvider {
  async saveChatSession(session: ChatSession): Promise<void> {
    // TODO: Implement PostgreSQL integration
    throw new Error('PostgreSQL integration not yet implemented')
  }

  async getChatSessions(): Promise<ChatSession[]> {
    // TODO: Implement PostgreSQL integration
    throw new Error('PostgreSQL integration not yet implemented')
  }

  async deleteChatSession(sessionId: string): Promise<void> {
    // TODO: Implement PostgreSQL integration
    throw new Error('PostgreSQL integration not yet implemented')
  }

  async getChatSession(sessionId: string): Promise<ChatSession | null> {
    // TODO: Implement PostgreSQL integration
    throw new Error('PostgreSQL integration not yet implemented')
  }

  async saveUserProfile(profile: UserProfile): Promise<void> {
    // TODO: Implement PostgreSQL integration
    throw new Error('PostgreSQL integration not yet implemented')
  }

  async getUserProfile(): Promise<UserProfile | null> {
    // TODO: Implement PostgreSQL integration
    throw new Error('PostgreSQL integration not yet implemented')
  }

  async saveStoredResponse(response: StoredResponse): Promise<void> {
    // TODO: Implement PostgreSQL integration
    throw new Error('PostgreSQL integration not yet implemented')
  }

  async getStoredResponses(): Promise<StoredResponse[]> {
    // TODO: Implement PostgreSQL integration
    throw new Error('PostgreSQL integration not yet implemented')
  }

  async deleteStoredResponse(responseId: string): Promise<void> {
    // TODO: Implement PostgreSQL integration
    throw new Error('PostgreSQL integration not yet implemented')
  }
}
