# 🌟 AstroWorld - AI Astrologer

A beautiful, ChatGPT-like web interface for an AI-powered astrologer that uses OpenAI's GPT models to provide cosmic guidance and astrological insights.

## ✨ Features

- **ChatGPT-like Interface**: Clean, modern chat UI with cosmic theming
- **AI-Powered Astrology**: Powered by OpenAI's GPT-4 (or GPT-3.5-turbo)
- **Responsive Design**: Works perfectly on desktop and mobile devices
- **Dark/Light Theme**: Toggle between cosmic themes
- **Real-time Chat**: Smooth, responsive chat experience
- **Context Awareness**: Maintains conversation history for better responses
- **Beautiful Animations**: Cosmic-themed animations and effects

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd astroworld
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env.local
   ```
   
   Edit `.env.local` and add your OpenAI API key:
   ```env
   OPENAI_API_KEY=your_actual_api_key_here
   ```

4. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔑 OpenAI API Setup

1. **Get an API Key**
   - Visit [OpenAI Platform](https://platform.openai.com/api-keys)
   - Sign up or log in to your account
   - Create a new API key

2. **Add to Environment**
   - Copy your API key
   - Paste it in the `.env.local` file
   - Restart your development server

3. **API Usage**
   - The app uses GPT-4 by default
   - You can change to GPT-3.5-turbo in `app/api/chat/route.ts` if needed
   - Monitor your usage in the OpenAI dashboard

## 🎨 Customization

### Changing the AI Model
Edit `app/api/chat/route.ts`:
```typescript
model: 'gpt-3.5-turbo', // Change from 'gpt-4' if needed
```

### Modifying the Astrologer Personality
Edit the `systemPrompt` in `app/api/chat/route.ts` to change how the AI responds.

### Styling
- Colors and themes are in `tailwind.config.js`
- Custom CSS in `app/globals.css`
- Component styles use Tailwind CSS classes

## 🏗️ Project Structure

```
astroworld/
├── app/                    # Next.js 13+ app directory
│   ├── api/               # API routes
│   │   └── chat/         # Chat endpoint
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Main page
├── lib/                   # Utility functions
│   └── utils.ts          # Helper functions
├── public/                # Static assets
├── tailwind.config.js     # Tailwind configuration
├── package.json           # Dependencies
└── README.md             # This file
```

## 🚀 Deployment

### Vercel (Recommended)
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Other Platforms
- **Netlify**: Use `npm run build` and deploy the `out` directory
- **Railway**: Connect your GitHub repo and add environment variables
- **Heroku**: Use the Node.js buildpack

## 💡 Usage Examples

Here are some example questions you can ask AstroWorld:

- "What's my zodiac sign and what does it mean?"
- "How do the current planetary transits affect me?"
- "What crystals should I work with for healing?"
- "Tell me about my birth chart elements"
- "What's the spiritual meaning of the full moon?"
- "How can I align with cosmic energy today?"

## 🔧 Troubleshooting

### Common Issues

1. **"OpenAI API error"**
   - Check your API key is correct
   - Ensure you have sufficient API credits
   - Verify the API key is in `.env.local`

2. **"Module not found" errors**
   - Run `npm install` again
   - Clear `.next` folder and restart

3. **Styling issues**
   - Ensure Tailwind CSS is properly configured
   - Check that `globals.css` is imported

### Getting Help

- Check the console for error messages
- Verify your environment variables
- Ensure all dependencies are installed

## 📱 Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- OpenAI for providing the AI capabilities
- Next.js team for the amazing framework
- Tailwind CSS for the beautiful styling system
- The cosmic universe for inspiration ✨

---
**May the stars guide your journey! 🌟** 
