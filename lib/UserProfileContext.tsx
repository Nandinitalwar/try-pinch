'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { UserProfile, Contact } from './types'

interface UserProfileContextType {
  userProfile: UserProfile | null
  contacts: Contact[]
  setUserProfile: (profile: UserProfile) => void
  addContact: (contact: Contact) => void
  updateContact: (id: string, contact: Partial<Contact>) => void
  deleteContact: (id: string) => void
  syncContacts: () => Promise<void>
  isProfileComplete: boolean
  calculateBirthChart: (profile: UserProfile) => Promise<void>
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined)

export const useUserProfile = () => {
  const context = useContext(UserProfileContext)
  if (context === undefined) {
    throw new Error('useUserProfile must be used within a UserProfileProvider')
  }
  return context
}

interface UserProfileProviderProps {
  children: ReactNode
}

export const UserProfileProvider: React.FC<UserProfileProviderProps> = ({ children }) => {
  const [userProfile, setUserProfileState] = useState<UserProfile | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])

  // Load profile from localStorage on mount
  useEffect(() => {
    const savedProfile = localStorage.getItem('astroworld_user_profile')
    const savedContacts = localStorage.getItem('astroworld_contacts')
    
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile)
        setUserProfileState(profile)
      } catch (error) {
        console.error('Error loading user profile:', error)
      }
    }
    
    if (savedContacts) {
      try {
        const contactsList = JSON.parse(savedContacts)
        setContacts(contactsList)
      } catch (error) {
        console.error('Error loading contacts:', error)
      }
    }
  }, [])

  const setUserProfile = (profile: UserProfile) => {
    setUserProfileState(profile)
    localStorage.setItem('astroworld_user_profile', JSON.stringify(profile))
  }

  const addContact = (contact: Contact) => {
    const newContacts = [...contacts, contact]
    setContacts(newContacts)
    localStorage.setItem('astroworld_contacts', JSON.stringify(newContacts))
  }

  const updateContact = (id: string, updates: Partial<Contact>) => {
    const updatedContacts = contacts.map(contact =>
      contact.id === id ? { ...contact, ...updates } : contact
    )
    setContacts(updatedContacts)
    localStorage.setItem('astroworld_contacts', JSON.stringify(updatedContacts))
  }

  const deleteContact = (id: string) => {
    const filteredContacts = contacts.filter(contact => contact.id !== id)
    setContacts(filteredContacts)
    localStorage.setItem('astroworld_contacts', JSON.stringify(filteredContacts))
  }

  const syncContacts = async () => {
    try {
      // Check if Web Contacts API is available
      if ('contacts' in navigator && 'select' in (navigator.contacts as any)) {
        const contacts = await (navigator.contacts as any).select(['name', 'email', 'tel'], { multiple: true })
        
        const newContacts: Contact[] = contacts.map((contact: any, index: number) => ({
          id: `contact_${Date.now()}_${index}`,
          name: contact.name?.[0] || 'Unknown',
          phone: contact.tel?.[0],
          email: contact.email?.[0],
          relationship: 'Contact',
        }))
        
        // Merge with existing contacts, avoiding duplicates
        const existingNames = contacts.map((c: any) => c.name?.toLowerCase())
        const uniqueNewContacts = newContacts.filter(contact => 
          !existingNames.includes(contact.name.toLowerCase())
        )
        
        if (uniqueNewContacts.length > 0) {
          const mergedContacts = [...contacts, ...uniqueNewContacts]
          setContacts(mergedContacts)
          localStorage.setItem('astroworld_contacts', JSON.stringify(mergedContacts))
        }
      } else {
        // Fallback: Show manual contact entry
        throw new Error('Web Contacts API not available')
      }
    } catch (error) {
      console.error('Error syncing contacts:', error)
      throw error
    }
  }

  const calculateBirthChart = async (profile: UserProfile) => {
    try {
      // This would typically call an external API for accurate birth chart calculation
      // For now, we'll create a simplified version
      const birthChart = {
        sunSign: profile.starSign,
        moonSign: profile.starSign, // Simplified
        ascendant: profile.starSign, // Simplified
        planetaryPositions: [],
        houses: []
      }
      
      const updatedProfile = { ...profile, birthChart }
      setUserProfile(updatedProfile)
    } catch (error) {
      console.error('Error calculating birth chart:', error)
    }
  }

  const isProfileComplete = Boolean(userProfile !== null && 
    userProfile.name && 
    userProfile.dateOfBirth && 
    userProfile.starSign)

  console.log('UserProfileContext state:', { 
    userProfile, 
    isProfileComplete, 
    hasName: userProfile?.name, 
    hasDateOfBirth: userProfile?.dateOfBirth, 
    hasStarSign: userProfile?.starSign 
  })

  const value: UserProfileContextType = {
    userProfile,
    contacts,
    setUserProfile,
    addContact,
    updateContact,
    deleteContact,
    syncContacts,
    isProfileComplete,
    calculateBirthChart
  }

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  )
} 