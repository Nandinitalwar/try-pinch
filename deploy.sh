#!/bin/bash

# 🚀 AstroWorld Production Deployment Script
# This script automates the deployment process

set -e

echo "🌟 Starting AstroWorld Production Deployment..."

# Check if required environment variables are set
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ Error: OPENAI_API_KEY environment variable is not set"
    exit 1
fi

# Build the application
echo "🔨 Building the application..."
npm run build

# Test the production build
echo "🧪 Testing production build..."
npm start &
SERVER_PID=$!

# Wait for server to start
sleep 10

# Test if server is responding
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Production build test successful"
else
    echo "❌ Production build test failed"
    kill $SERVER_PID
    exit 1
fi

# Stop test server
kill $SERVER_PID

echo "🐳 Building Docker image..."
docker build -t astroworld:latest .

echo "🧹 Cleaning up old containers..."
docker-compose down --remove-orphans

echo "🚀 Starting production services..."
docker-compose up -d

echo "⏳ Waiting for services to be ready..."
sleep 15

# Health check
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ AstroWorld is running successfully!"
    echo "🌐 Application URL: http://localhost:3000"
    echo "📊 Health check: http://localhost:3000/api/health"
else
    echo "❌ Deployment failed - application not responding"
    docker-compose logs astroworld
    exit 1
fi

echo "🎉 Deployment completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Set up your domain and SSL certificates"
echo "2. Configure your production environment variables"
echo "3. Set up monitoring and logging"
echo "4. Configure your CDN for global distribution"
echo ""
echo "📚 See PRODUCTION_DEPLOYMENT.md for detailed instructions"
