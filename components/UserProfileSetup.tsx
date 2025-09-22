'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useUserProfile } from '../lib/UserProfileContext'
import { Calendar, MapPin, User, Star, Search, X, Phone } from 'lucide-react'

interface Location {
  id: string
  name: string
  type: 'city' | 'state' | 'country'
  fullPath: string
  city?: string
  state?: string
  country?: string
  latitude?: number
  longitude?: number
  population?: number
}

interface UserProfileSetupProps {
  onClose?: () => void
}

export default function UserProfileSetup({ onClose }: UserProfileSetupProps = {}) {
  const { userProfile, setUserProfile } = useUserProfile()
  
  const [name, setName] = useState(userProfile?.name || '')
  const [dateOfBirth, setDateOfBirth] = useState(userProfile?.dateOfBirth || '')
  const [timeOfBirth, setTimeOfBirth] = useState(userProfile?.timeOfBirth || '')
  const [placeOfBirth, setPlaceOfBirth] = useState(userProfile?.placeOfBirth || '')
  const [starSign, setStarSign] = useState(userProfile?.starSign || '')
  const [phoneNumber, setPhoneNumber] = useState(userProfile?.phoneNumber || '')
  const [smsNotifications, setSmsNotifications] = useState(userProfile?.smsNotifications || false)
  
  // Location search states
  const [locationQuery, setLocationQuery] = useState(userProfile?.placeOfBirth || '')
  const [locationSuggestions, setLocationSuggestions] = useState<Location[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  
  const searchRef = useRef<HTMLDivElement>(null)

  // Handle clicks outside suggestions dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Search locations using GeoNames API
  const handleLocationSearch = async (query: string) => {
    setLocationQuery(query)
    
    if (query.length < 2) {
      setLocationSuggestions([])
      setShowSuggestions(false)
      return
    }

    setIsSearching(true)
    
    try {
      const response = await fetch(`/api/geonames?q=${encodeURIComponent(query)}&maxRows=15`)
      if (response.ok) {
        const data = await response.json()
        setLocationSuggestions(data.locations || [])
        setShowSuggestions(true)
      } else {
        const errorData = await response.json()
        console.error('GeoNames API error:', errorData)
        
        if (errorData.limitExceeded) {
          // Show message that API limit is exceeded
          setLocationSuggestions([])
          setShowSuggestions(true)
        } else {
          setLocationSuggestions([])
          setShowSuggestions(false)
        }
      }
    } catch (error) {
      console.error('Error searching locations:', error)
      setLocationSuggestions([])
      setShowSuggestions(false)
    } finally {
      setIsSearching(false)
    }
  }

  const handleLocationSelect = (location: Location) => {
    setSelectedLocation(location)
    setPlaceOfBirth(location.fullPath)
    setLocationQuery(location.fullPath)
    setShowSuggestions(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name || !dateOfBirth || !starSign) {
      alert('Please fill in all required fields')
      return
    }

    const profile = {
      name,
      dateOfBirth,
      timeOfBirth,
      placeOfBirth,
      starSign,
      phoneNumber,
      smsNotifications,
      currentProblems: userProfile?.currentProblems || [],
      id: userProfile?.id || `profile_${Date.now()}`,
      createdAt: userProfile?.createdAt || new Date(),
      updatedAt: new Date()
    }

    setUserProfile(profile)
    
    // Close the modal after saving
    if (onClose) {
      onClose()
    }
  }

  const starSigns = [
    { display: 'Aries (Mesha)', value: 'Aries' },
    { display: 'Taurus (Vrishabha)', value: 'Taurus' },
    { display: 'Gemini (Mithuna)', value: 'Gemini' },
    { display: 'Cancer (Karka)', value: 'Cancer' },
    { display: 'Leo (Simha)', value: 'Leo' },
    { display: 'Virgo (Kanya)', value: 'Virgo' },
    { display: 'Libra (Tula)', value: 'Libra' },
    { display: 'Scorpio (Vrishchika)', value: 'Scorpio' },
    { display: 'Sagittarius (Dhanu)', value: 'Sagittarius' },
    { display: 'Capricorn (Makara)', value: 'Capricorn' },
    { display: 'Aquarius (Kumbha)', value: 'Aquarius' },
    { display: 'Pisces (Meena)', value: 'Pisces' }
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-white mb-2">
          <User className="inline w-4 h-4 mr-2" />
          Full Name *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="Enter your full name"
          required
        />
      </div>

      {/* Date of Birth */}
      <div>
        <label className="block text-sm font-medium text-white mb-2">
          <Calendar className="inline w-4 h-4 mr-2" />
          Date of Birth *
        </label>
        <input
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          required
        />
      </div>

      {/* Time of Birth */}
      <div>
        <label className="block text-sm font-medium text-white mb-2">
          <Calendar className="inline w-4 h-4 mr-2" />
          Time of Birth (Optional)
        </label>
        <input
          type="time"
          value={timeOfBirth}
          onChange={(e) => setTimeOfBirth(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>

      {/* Place of Birth */}
      <div>
        <label className="block text-sm font-medium text-white mb-2">
          <MapPin className="inline w-4 h-4 mr-2" />
          Place of Birth (Optional)
        </label>
        <div className="relative">
          <input
            type="text"
            value={locationQuery}
            onChange={(e) => handleLocationSearch(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10"
            placeholder="Search for city, state, or country"
          />
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          
          {isSearching && (
            <div className="absolute right-10 top-1/2 -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
            </div>
          )}
          
          {showSuggestions && locationSuggestions.length > 0 && (
            <div
              ref={searchRef}
              className="absolute z-50 w-full bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto mt-1"
            >

              {locationSuggestions.map((location) => (
                <div
                  key={location.id}
                  className="p-3 cursor-pointer hover:bg-gray-700 text-white border-b border-gray-600 last:border-b-0"
                  onClick={() => handleLocationSelect(location)}
                >
                  <div className="font-medium">{location.name}</div>
                  <div className="text-sm text-gray-400">{location.fullPath}</div>
                  <div className="text-xs text-purple-400 capitalize">{location.type}</div>
                </div>
              ))}
            </div>
          )}
          
          {showSuggestions && locationSuggestions.length === 0 && !isSearching && (
            <div className="absolute z-10 w-full bg-gray-800 border border-gray-600 rounded-lg shadow-lg mt-1 p-3">
              <div className="text-gray-400 text-sm mb-2">
                Location search unavailable. You can type your location manually below.
              </div>
              <input
                type="text"
                value={placeOfBirth}
                onChange={(e) => setPlaceOfBirth(e.target.value)}
                className="w-full px-2 py-1 bg-gray-700 border border-gray-500 rounded text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                placeholder="Type your location manually (e.g., Mumbai, Maharashtra, India)"
                onBlur={() => setShowSuggestions(false)}
              />
            </div>
          )}
        </div>
        

      </div>

      {/* Star Sign */}
      <div>
        <label className="block text-sm font-medium text-white mb-2">
          <Star className="inline w-4 h-4 mr-2" />
          Star Sign *
        </label>
        <select
          value={starSign}
          onChange={(e) => setStarSign(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          required
        >
          <option value="">Select your star sign</option>
          {starSigns.map((sign) => (
            <option key={sign.value} value={sign.value}>{sign.display}</option>
          ))}
        </select>
      </div>

      {/* Phone Number */}
      <div>
        <label className="block text-sm font-medium text-white mb-2">
          <Phone className="inline w-4 h-4 mr-2" />
          Phone Number (Optional)
        </label>
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="+1 (555) 123-4567"
        />
        <p className="text-xs text-gray-400 mt-1">For SMS notifications about your predictions</p>
      </div>

      {/* SMS Notifications Toggle */}
      {phoneNumber && (
        <div>
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={smsNotifications}
              onChange={(e) => setSmsNotifications(e.target.checked)}
              className="w-4 h-4 text-purple-600 bg-gray-800 border border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
            />
            <span className="text-sm text-white">Send me SMS notifications for important predictions</span>
          </label>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800"
      >
        Save Profile
      </button>
    </form>
  )
} 