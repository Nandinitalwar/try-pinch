# 🚀 **Real-Time Tool Calling Test Guide**

## **What's New:**
Your AI astrologer now has **REAL-TIME tool calling** capabilities that can query Indian astrology websites live!

## **Available Tools:**

### 1. **Daily Horoscope** 🌟
- **Function**: `get_daily_horoscope`
- **Query**: "What's today's horoscope for Cancer?"
- **Sources**: GaneshaSpeaks, AstroSage, AstroVed
- **Real-time**: Fetches current daily horoscope from live websites

### 2. **Nakshatra Information** 🌙
- **Function**: `get_nakshatra_info`
- **Query**: "Tell me about Ashwini Nakshatra"
- **Sources**: Multiple Indian astrology websites
- **Real-time**: Searches for current Nakshatra details

### 3. **Planetary Transits** 🪐
- **Function**: `get_planetary_transits`
- **Query**: "What are Jupiter's current transits?"
- **Sources**: Live astrology websites
- **Real-time**: Gets current planetary movement data

### 4. **Muhurta Timing** ⏰
- **Function**: `get_muhurta_timing`
- **Query**: "What's the best time for marriage?"
- **Sources**: Indian astrology sources
- **Real-time**: Fetches auspicious timing information

## **How It Works:**

1. **User asks a question** (e.g., "What's today's horoscope for Aries?")
2. **AI decides** if it needs real-time data
3. **Tool is called** to fetch live information
4. **Data is scraped** from Indian astrology websites
5. **AI generates response** using the real-time data
6. **User gets current, accurate information** instead of static data

## **Example Queries to Test:**

```
"Get today's horoscope for Leo"
"What are the current planetary transits for Saturn?"
"Tell me about Rohini Nakshatra"
"What's the best time for starting a business?"
"Show me Cancer's daily horoscope"
"Current transit information for Mars"
```

## **Benefits:**

✅ **Real-time data** from live websites
✅ **Multiple sources** for redundancy
✅ **Current information** instead of outdated data
✅ **Authentic Indian astrology** sources
✅ **Fallback responses** if websites are unavailable
✅ **Timestamp tracking** for data freshness

## **Technical Details:**

- **Function Calling**: OpenAI's latest function calling API
- **Web Scraping**: Cheerio for HTML parsing
- **Multiple Sources**: Redundancy across different websites
- **Error Handling**: Graceful fallbacks if scraping fails
- **User Agents**: Proper headers to avoid blocking

## **Start Testing:**

1. **Start the server**: `npm run dev`
2. **Ask questions** that require real-time data
3. **Watch the AI** automatically call the right tools
4. **See live results** from Indian astrology websites!

Your AI astrologer is now **supercharged** with real-time capabilities! 🌟✨
