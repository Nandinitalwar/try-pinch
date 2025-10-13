#!/bin/bash

# This script helps you test WhatsApp/SMS locally by exposing localhost with ngrok

echo "🌐 Setting up local webhook testing with ngrok"
echo ""
echo "Step 1: Start ngrok (opens in background)"
echo "----------------------------------------"

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok is not installed."
    echo ""
    echo "Install it with:"
    echo "  brew install ngrok"
    echo "  or download from: https://ngrok.com/"
    exit 1
fi

# Start ngrok in background
echo "Starting ngrok on port 3001..."
ngrok http 3001 &
NGROK_PID=$!

echo "✅ ngrok started (PID: $NGROK_PID)"
echo ""
echo "⏳ Waiting 3 seconds for ngrok to initialize..."
sleep 3

echo ""
echo "Step 2: Get your ngrok URL"
echo "----------------------------------------"

# Get ngrok URL from API
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*' | grep -o 'https://[^"]*' | head -1)

if [ -z "$NGROK_URL" ]; then
    echo "❌ Could not get ngrok URL. Please check manually at: http://localhost:4040"
    exit 1
fi

echo "✅ Your ngrok URL: $NGROK_URL"
echo ""
echo "Step 3: Update Twilio Webhook"
echo "----------------------------------------"
echo "Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/active"
echo ""
echo "Set your webhook to:"
echo "  📎 ${NGROK_URL}/api/webhook/twilio"
echo ""
echo "Step 4: Test!"
echo "----------------------------------------"
echo "1. Open logs: http://localhost:3001/logs"
echo "2. Send a WhatsApp message to your Twilio number"
echo "3. Watch logs appear in real-time! 🎉"
echo ""
echo "To stop ngrok, press Ctrl+C"
echo ""
echo "Press Ctrl+C to stop..."

# Wait for user to stop
wait $NGROK_PID

