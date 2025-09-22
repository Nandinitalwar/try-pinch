'use client'

import React, { useState, useEffect } from 'react'
import { Star, Heart, Briefcase, Gem, Sun, Moon, Zap, Users, Calendar, MapPin, ChevronDown, ChevronUp } from 'lucide-react'
import { useUserProfile } from '@/lib/UserProfileContext'

interface StarSignData {
  english: string
  sanskrit: string
  element: string
  quality: string
  ruler: string
  luckyNumbers: number[]
  luckyColors: string[]
  luckyDays: string[]
  unluckyDays: string[]
  compatibleSigns: string[]
  incompatibleSigns: string[]
  strengths: string[]
  weaknesses: string[]
  careerPaths: string[]
  healthAreas: string[]
  loveTraits: string[]
  gemstones: string[]
  mantras: string[]
  remedies: string[]
  personality: string
  dailyRoutine: string
  spiritualPath: string
}

export default function StarSignInfo() {
  const { userProfile } = useUserProfile()
  const [starSignData, setStarSignData] = useState<StarSignData | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    if (userProfile?.starSign) {
      fetchStarSignData()
    }
  }, [userProfile?.starSign])

  const fetchStarSignData = async () => {
    if (!userProfile?.starSign) return
    
    setLoading(true)
    try {
      const response = await fetch(`/api/star-sign?sign=${encodeURIComponent(userProfile.starSign)}`)
      if (response.ok) {
        const data = await response.json()
        setStarSignData(data.data)
      }
    } catch (error) {
      console.error('Error fetching star sign data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!userProfile?.starSign || !starSignData) {
    return null
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Star },
    { id: 'personality', label: 'Personality', icon: Heart },
    { id: 'career', label: 'Career', icon: Briefcase },
    { id: 'health', label: 'Health', icon: Zap },
    { id: 'love', label: 'Love & Relationships', icon: Heart },
    { id: 'remedies', label: 'Remedies', icon: Gem },
    { id: 'daily', label: 'Daily Routine', icon: Sun },
    { id: 'spiritual', label: 'Spiritual Path', icon: Moon }
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-cosmic-600/10 p-3 rounded-lg border border-cosmic-500/20">
                <div className="text-sm text-cosmic-400 mb-1">Element</div>
                <div className="text-white font-medium">{starSignData.element}</div>
              </div>
              <div className="bg-cosmic-600/10 p-3 rounded-lg border border-cosmic-500/20">
                <div className="text-sm text-cosmic-400 mb-1">Quality</div>
                <div className="text-white font-medium">{starSignData.quality}</div>
              </div>
              <div className="bg-cosmic-600/10 p-3 rounded-lg border border-cosmic-500/20">
                <div className="text-sm text-cosmic-400 mb-1">Ruling Planet</div>
                <div className="text-white font-medium">{starSignData.ruler}</div>
              </div>
              <div className="bg-cosmic-600/10 p-3 rounded-lg border border-cosmic-500/20">
                <div className="text-sm text-cosmic-400 mb-1">Sanskrit Name</div>
                <div className="text-white font-medium">{starSignData.sanskrit}</div>
              </div>
            </div>
            
            <div className="bg-cosmic-600/10 p-4 rounded-lg border border-cosmic-500/20">
              <div className="text-sm text-cosmic-400 mb-2">Lucky Numbers</div>
              <div className="flex gap-2 flex-wrap">
                {starSignData.luckyNumbers.map((num, index) => (
                  <span key={index} className="px-2 py-1 bg-cosmic-600/30 rounded text-white text-sm">
                    {num}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-cosmic-600/10 p-4 rounded-lg border border-cosmic-500/20">
              <div className="text-sm text-cosmic-400 mb-2">Lucky Colors</div>
              <div className="flex gap-2 flex-wrap">
                {starSignData.luckyColors.map((color, index) => (
                  <span key={index} className="px-2 py-1 bg-cosmic-600/30 rounded text-white text-sm">
                    {color}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )

      case 'personality':
        return (
          <div className="space-y-4">
            <div className="bg-cosmic-600/10 p-4 rounded-lg border border-cosmic-500/20">
              <div className="text-sm text-cosmic-400 mb-2">Personality</div>
              <div className="text-white text-sm">{starSignData.personality}</div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-cosmic-600/10 p-4 rounded-lg border border-cosmic-500/20">
                <div className="text-sm text-cosmic-400 mb-2">Strengths</div>
                <ul className="text-white space-y-1">
                  {starSignData.strengths.slice(0, 4).map((strength, index) => (
                    <li key={index} className="text-sm">• {strength}</li>
                  ))}
                </ul>
              </div>
              
              <div className="bg-cosmic-600/10 p-4 rounded-lg border border-cosmic-500/20">
                <div className="text-sm text-cosmic-400 mb-2">Areas to Improve</div>
                <ul className="text-white space-y-1">
                  {starSignData.weaknesses.slice(0, 4).map((weakness, index) => (
                    <li key={index} className="text-sm">• {weakness}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )

      case 'career':
        return (
          <div className="space-y-4">
            <div className="bg-cosmic-600/10 p-4 rounded-lg border border-cosmic-500/20">
              <div className="text-sm text-cosmic-400 mb-2">Recommended Career Paths</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {starSignData.careerPaths.slice(0, 6).map((career, index) => (
                  <div key={index} className="px-3 py-2 bg-cosmic-600/30 rounded text-white text-sm">
                    {career}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )

      case 'health':
        return (
          <div className="space-y-4">
            <div className="bg-cosmic-600/10 p-4 rounded-lg border border-cosmic-500/20">
              <div className="text-sm text-cosmic-400 mb-2">Health Focus Areas</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {starSignData.healthAreas.map((area, index) => (
                  <div key={index} className="px-3 py-2 bg-cosmic-600/30 rounded text-white text-sm">
                    {area}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )

      case 'love':
        return (
          <div className="space-y-4">
            <div className="bg-cosmic-600/10 p-4 rounded-lg border border-cosmic-500/20">
              <div className="text-sm text-cosmic-400 mb-2">Love Traits</div>
              <ul className="text-white space-y-1">
                {starSignData.loveTraits.slice(0, 4).map((trait, index) => (
                  <li key={index} className="text-sm">• {trait}</li>
                ))}
              </ul>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-cosmic-600/10 p-4 rounded-lg border border-cosmic-500/20">
                <div className="text-sm text-cosmic-400 mb-2">Compatible Signs</div>
                <div className="flex gap-2 flex-wrap">
                  {starSignData.compatibleSigns.map((sign, index) => (
                    <span key={index} className="px-2 py-1 bg-green-600/30 rounded text-green-300 text-sm">
                      {sign}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="bg-cosmic-600/10 p-4 rounded-lg border border-cosmic-500/20">
                <div className="text-sm text-cosmic-400 mb-2">Challenging Signs</div>
                <div className="flex gap-2 flex-wrap">
                  {starSignData.incompatibleSigns.map((sign, index) => (
                    <span key={index} className="px-2 py-1 bg-red-600/30 rounded text-red-300 text-sm">
                      {sign}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )

      case 'remedies':
        return (
          <div className="space-y-4">
            <div className="bg-cosmic-600/10 p-4 rounded-lg border border-cosmic-500/20">
              <div className="text-sm text-cosmic-400 mb-2">Recommended Gemstones</div>
              <div className="flex gap-2 flex-wrap">
                {starSignData.gemstones.map((gem, index) => (
                  <span key={index} className="px-3 py-2 bg-cosmic-600/30 rounded text-white text-sm">
                    {gem}
                  </span>
                ))}
              </div>
            </div>
            
            <div className="bg-cosmic-600/10 p-4 rounded-lg border border-cosmic-500/20">
              <div className="text-sm text-cosmic-400 mb-2">Remedies</div>
              <ul className="text-white space-y-1">
                {starSignData.remedies.slice(0, 3).map((remedy, index) => (
                  <li key={index} className="text-sm">• {remedy}</li>
                ))}
              </ul>
            </div>
          </div>
        )

      case 'daily':
        return (
          <div className="space-y-4">
            <div className="bg-cosmic-600/10 p-4 rounded-lg border border-cosmic-500/20">
              <div className="text-sm text-cosmic-400 mb-2">Daily Routine</div>
              <div className="text-white text-sm">{starSignData.dailyRoutine}</div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-cosmic-600/10 p-4 rounded-lg border border-cosmic-500/20">
                <div className="text-sm text-cosmic-400 mb-2">Lucky Days</div>
                <div className="flex gap-2 flex-wrap">
                  {starSignData.luckyDays.map((day, index) => (
                    <span key={index} className="px-2 py-1 bg-green-600/30 rounded text-green-300 text-sm">
                      {day}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="bg-cosmic-600/10 p-4 rounded-lg border border-cosmic-500/20">
                <div className="text-sm text-cosmic-400 mb-2">Challenging Days</div>
                <div className="flex gap-2 flex-wrap">
                  {starSignData.unluckyDays.map((day, index) => (
                    <span key={index} className="px-2 py-1 bg-red-600/30 rounded text-red-300 text-sm">
                      {day}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )

      case 'spiritual':
        return (
          <div className="space-y-4">
            <div className="bg-cosmic-600/10 p-4 rounded-lg border border-cosmic-500/20">
              <div className="text-sm text-cosmic-400 mb-2">Spiritual Path</div>
              <div className="text-white text-sm">{starSignData.spiritualPath}</div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="bg-cosmic-600/10 rounded-2xl p-4 border border-cosmic-500/20">
        <div className="animate-pulse">
          <div className="h-4 bg-cosmic-600/30 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-cosmic-600/30 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-cosmic-600/10 rounded-2xl border border-cosmic-500/20 overflow-hidden">
      {/* Compact Header - Always Visible */}
      <div className="bg-cosmic-600/20 p-4 border-b border-cosmic-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Star className="w-5 h-5 text-cosmic-400" />
            <div>
              <h3 className="text-lg font-semibold text-cosmic-400">
                {starSignData.english} ({starSignData.sanskrit})
              </h3>
              <p className="text-sm text-cosmic-300">
                {starSignData.element} • {starSignData.quality} • Ruled by {starSignData.ruler}
              </p>
              <p className="text-xs text-cosmic-400 mt-1">
                Click to expand for detailed guidance
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-cosmic-400 hover:text-white transition-colors p-2"
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Expandable Content */}
      {isExpanded && (
        <>
          {/* Tab Navigation */}
          <div className="flex border-b border-cosmic-500/20 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'text-cosmic-400 border-b-2 border-cosmic-400 bg-cosmic-600/10'
                      : 'text-stardust-400 hover:text-stardust-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Tab Content */}
          <div className="p-4 max-h-96 overflow-y-auto">
            {renderTabContent()}
          </div>
        </>
      )}
    </div>
  )
} 