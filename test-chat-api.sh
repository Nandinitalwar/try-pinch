#!/bin/bash

# Test script for chat API - generates logs you can see at http://localhost:3001/logs

echo "🧪 Testing Chat API - Watch logs at http://localhost:3001/logs"
echo ""

# Test 1: Simple message
echo "Test 1: Sending a simple message..."
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "hi there!",
    "history": []
  }' | jq -r '.response'

echo ""
echo "---"
echo ""

# Test 2: Message with user profile
echo "Test 2: Sending message with user profile..."
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "what is my horoscope for today?",
    "history": [],
    "userProfile": {
      "name": "Test User",
      "dateOfBirth": "1990-01-15",
      "timeOfBirth": "3:30 PM",
      "placeOfBirth": "New York, NY",
      "starSign": "Capricorn"
    }
  }' | jq -r '.response'

echo ""
echo ""
echo "✅ Tests complete! Check http://localhost:3001/logs to see all the logs"

