#!/bin/bash

# Test script for Twilio webhook endpoint
# Usage: ./test-webhook.sh [local|production] [message]

ENV=${1:-local}
MESSAGE=${2:-"hello, what's my horoscope?"}

if [ "$ENV" = "local" ]; then
  URL="http://localhost:3000/api/webhook/twilio"
  echo "Testing LOCAL endpoint: $URL"
else
  URL="https://aiastrologer.vercel.app/api/webhook/twilio"
  echo "Testing PRODUCTION endpoint: $URL"
fi

echo "Message: $MESSAGE"
echo ""

curl -X POST "$URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=+15551234567" \
  -d "To=+1YOUR_TWILIO_NUMBER" \
  -d "Body=$MESSAGE" \
  -v

echo ""
echo "Done!"


