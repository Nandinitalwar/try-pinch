#!/bin/bash

# Test script for SendBlue webhook
# This simulates an incoming iMessage to test your integration

echo "🧪 Testing SendBlue Webhook Integration"
echo "========================================"
echo ""

# Configuration
WEBHOOK_URL="${1:-http://localhost:3000/api/webhook/sendblue}"
TEST_PHONE="${2:-+15551234567}"
TEST_MESSAGE="${3:-Hey Pinch, should I take a sick day tomorrow?}"

echo "📍 Webhook URL: $WEBHOOK_URL"
echo "📱 Test Phone: $TEST_PHONE"
echo "💬 Test Message: $TEST_MESSAGE"
echo ""

# Create the JSON payload that SendBlue sends
PAYLOAD=$(cat <<EOF
{
  "accountEmail": "test@example.com",
  "content": "$TEST_MESSAGE",
  "is_outbound": false,
  "status": "RECEIVED",
  "error_code": null,
  "error_message": null,
  "error_reason": null,
  "error_detail": null,
  "message_handle": "test-msg-$(date +%s)",
  "date_sent": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "date_updated": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "from_number": "$TEST_PHONE",
  "number": "$TEST_PHONE",
  "to_number": "+18889211387",
  "was_downgraded": false,
  "plan": "blue",
  "media_url": "",
  "message_type": "message",
  "group_id": "",
  "participants": [],
  "send_style": "invisible",
  "opted_out": false,
  "sendblue_number": null,
  "service": "iMessage",
  "group_display_name": null
}
EOF
)

echo "📤 Sending test webhook..."
echo ""

# Send the request
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

# Extract status code and body
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "📥 Response:"
echo "Status Code: $HTTP_CODE"
echo "Body: $BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Test successful!"
  echo ""
  echo "Next steps:"
  echo "1. Check your terminal logs for processing details"
  echo "2. Check Braintrust dashboard for logged conversation"
  echo "3. If SendBlue is configured, check if response was sent"
else
  echo "❌ Test failed with status code: $HTTP_CODE"
  echo ""
  echo "Troubleshooting:"
  echo "1. Make sure your dev server is running (npm run dev)"
  echo "2. Check the error message above"
  echo "3. Verify your environment variables are set"
fi

