#!/bin/bash

# Test script to simulate a Twilio webhook locally
# This will help you see if logging is working correctly

echo "🧪 Testing Twilio Webhook Locally"
echo "=================================="
echo ""
echo "Make sure you have the logs page open: http://localhost:3001/logs"
echo ""
echo "Sending test webhook to local server..."
echo ""

# Simulate a Twilio WhatsApp webhook
curl -X POST http://localhost:3001/api/webhook/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+15551234567" \
  -d "To=whatsapp:+15559876543" \
  -d "Body=hey there!"

echo ""
echo ""
echo "✅ Test webhook sent!"
echo ""
echo "Check your terminal (where npm run dev is running) and the logs page."
echo "You should see:"
echo "  - 🔔 TWILIO WEBHOOK RECEIVED in terminal"
echo "  - 📱 INCOMING MESSAGE details"
echo "  - 🤖 AI Response"
echo "  - 📤 Sending response"
echo ""
echo "If you see these, the webhook is working!"
echo "If not, there might be an error - check the terminal output."

