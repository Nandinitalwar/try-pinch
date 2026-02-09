#!/bin/bash
# Test the webhook with a sample message
# Usage: ./scripts/test-webhook.sh "your message here"

MESSAGE="${1:-give me recs for specific events in sf}"
PHONE="whatsapp:+15551234567"

echo "Testing webhook with message: $MESSAGE"
echo ""

curl -s -X POST http://localhost:3000/api/webhook/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=$PHONE&Body=$MESSAGE" | head -c 2000

echo ""
echo ""
echo "Done."
