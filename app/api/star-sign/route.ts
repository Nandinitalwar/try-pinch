import { NextRequest, NextResponse } from 'next/server'
import { getStarSignData, getAllStarSigns, getCompatibleSigns, getGemstones, getDailyRoutine, getSpiritualPath } from '@/lib/astrologyDataSources'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const starSign = searchParams.get('sign')
    const type = searchParams.get('type')

    if (!starSign) {
      return NextResponse.json({
        availableSigns: getAllStarSigns(),
        message: 'Please specify a star sign using the "sign" parameter'
      })
    }

    const signData = getStarSignData(starSign)
    
    if (!signData) {
      return NextResponse.json({
        error: 'Star sign not found',
        availableSigns: getAllStarSigns(),
        message: 'Please use one of the available star signs'
      }, { status: 404 })
    }

    // Return specific type of information if requested
    if (type) {
      switch (type) {
        case 'compatibility':
          return NextResponse.json({
            starSign: starSign,
            compatibleSigns: signData.compatibleSigns,
            incompatibleSigns: signData.incompatibleSigns,
            message: `Compatibility information for ${starSign}`
          })

        case 'gemstones':
          return NextResponse.json({
            starSign: starSign,
            gemstones: signData.gemstones,
            message: `Recommended gemstones for ${starSign}`
          })

        case 'daily-routine':
          return NextResponse.json({
            starSign: starSign,
            dailyRoutine: signData.dailyRoutine,
            message: `Daily routine recommendations for ${starSign}`
          })

        case 'spiritual-path':
          return NextResponse.json({
            starSign: starSign,
            spiritualPath: signData.spiritualPath,
            message: `Spiritual path guidance for ${starSign}`
          })

        case 'career':
          return NextResponse.json({
            starSign: starSign,
            careerPaths: signData.careerPaths,
            strengths: signData.strengths,
            message: `Career guidance for ${starSign}`
          })

        case 'health':
          return NextResponse.json({
            starSign: starSign,
            healthAreas: signData.healthAreas,
            luckyColors: signData.luckyColors,
            message: `Health guidance for ${starSign}`
          })

        case 'love':
          return NextResponse.json({
            starSign: starSign,
            loveTraits: signData.loveTraits,
            compatibleSigns: signData.compatibleSigns,
            message: `Love and relationship guidance for ${starSign}`
          })

        case 'remedies':
          return NextResponse.json({
            starSign: starSign,
            remedies: signData.remedies,
            mantras: signData.mantras,
            luckyDays: signData.luckyDays,
            message: `Remedies and mantras for ${starSign}`
          })

        default:
          return NextResponse.json({
            error: 'Invalid type parameter',
            availableTypes: ['compatibility', 'gemstones', 'daily-routine', 'spiritual-path', 'career', 'health', 'love', 'remedies'],
            message: 'Please specify a valid type parameter'
          }, { status: 400 })
      }
    }

    // Return complete star sign information
    return NextResponse.json({
      starSign: starSign,
      data: signData,
      message: `Complete astrological information for ${starSign}`,
      source: 'Aggregated from multiple Indian astrology websites for accuracy'
    })

  } catch (error) {
    console.error('Error in star sign API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch star sign information' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { starSign, question, userProfile } = await request.json()

    if (!starSign || !question) {
      return NextResponse.json({
        error: 'Star sign and question are required'
      }, { status: 400 })
    }

    const signData = getStarSignData(starSign)
    
    if (!signData) {
      return NextResponse.json({
        error: 'Star sign not found',
        availableSigns: getAllStarSigns()
      }, { status: 404 })
    }

    // Generate personalized response based on star sign data and user question
    let response = ''
    
    if (question.toLowerCase().includes('compatibility') || question.toLowerCase().includes('relationship')) {
      response = `For ${starSign}, your most compatible signs are ${signData.compatibleSigns.join(', ')}. ${signData.loveTraits.join('. ')}. Avoid relationships with ${signData.incompatibleSigns.join(', ')} as they may create challenges.`
    } else if (question.toLowerCase().includes('career') || question.toLowerCase().includes('job')) {
      response = `Based on your ${starSign} nature, excellent career paths include: ${signData.careerPaths.join(', ')}. Your strengths like ${signData.strengths.slice(0, 3).join(', ')} will help you excel in these fields.`
    } else if (question.toLowerCase().includes('gemstone') || question.toLowerCase().includes('stone')) {
      response = `For ${starSign}, the most beneficial gemstones are: ${signData.gemstones.join(', ')}. These stones will enhance your natural ${signData.element} element and bring balance to your life.`
    } else if (question.toLowerCase().includes('health') || question.toLowerCase().includes('wellness')) {
      response = `As a ${starSign}, focus on these health areas: ${signData.healthAreas.join(', ')}. Wear ${signData.luckyColors.join(' or ')} colors and practice the daily routine: ${signData.dailyRoutine}`
    } else if (question.toLowerCase().includes('daily') || question.toLowerCase().includes('routine')) {
      response = `Your ${starSign} daily routine: ${signData.dailyRoutine} This will help balance your ${signData.element} element and enhance your natural ${signData.quality} qualities.`
    } else if (question.toLowerCase().includes('spiritual') || question.toLowerCase().includes('meditation')) {
      response = `Your spiritual path as ${starSign}: ${signData.spiritualPath} Focus on developing ${signData.weaknesses.slice(0, 2).join(' and ')} while enhancing your natural ${signData.strengths.slice(0, 2).join(' and ')}.`
    } else {
      // General personality and guidance
      response = `As a ${starSign}, you are ${signData.personality} Your ruling planet ${signData.ruler} gives you ${signData.strengths.slice(0, 3).join(', ')}. To improve, work on ${signData.weaknesses.slice(0, 2).join(' and ')}.`
    }

    return NextResponse.json({
      starSign: starSign,
      question: question,
      response: response,
      data: signData,
      message: `Personalized guidance for ${starSign}`
    })

  } catch (error) {
    console.error('Error in star sign POST API:', error)
    return NextResponse.json(
      { error: 'Failed to process star sign question' },
      { status: 500 }
    )
  }
} 