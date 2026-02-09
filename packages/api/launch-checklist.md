# Pinch - 100 User Launch Checklist

## ✅ Technical Setup
- [x] Production deployment on Vercel
- [x] Twilio number configured (+1 888 921 1387)
- [x] SMS webhook configured
- [x] Environment variables set (Gemini, Twilio, Supabase, Exa)
- [x] Database schema deployed
- [ ] Test SMS from 5 different phones
- [ ] Set up monitoring/error alerts
- [ ] Set up Twilio usage alerts (budget protection)

## 💰 Cost Planning (100 users)
### SMS-Only (Immediate Launch)
- **Per user**: ~20 messages/month average
- **Total messages**: 100 users × 20 = 2,000 msgs/month
- **SMS cost**: 2,000 × $0.0079 = ~$16/month
- **Gemini cost**: 2,000 × ~$0.002 = ~$4/month
- **Exa searches**: ~500 searches × $0.001 = ~$0.50/month
- **Total**: ~$20-25/month for 100 users

### WhatsApp (After Approval)
- **WhatsApp cost**: $0.005/msg (user-initiated) or FREE (24hr window)
- **Total**: ~$10-15/month (50% cheaper)

## 🛡️ Safety Measures
- [ ] Set Twilio spending limit ($50/month recommended)
- [ ] Enable Vercel usage alerts
- [ ] Monitor Supabase database size
- [ ] Set up error tracking (Sentry/similar)

## 📣 User Acquisition
- [ ] Create landing page with "Text +1 888 921 1387 to start"
- [ ] Prepare intro message (what to text first)
- [ ] Write user guide (how to share birth data)
- [ ] Test user onboarding flow

## 🐛 Testing
- [ ] Test with users in different timezones
- [ ] Test birth data parsing (various formats)
- [ ] Test conversation memory
- [ ] Test rate limiting/spam protection
- [ ] Test error handling (API failures)

## 📈 Monitoring
- [ ] Track active users (daily/weekly)
- [ ] Track message volume
- [ ] Track API costs
- [ ] Track user retention
- [ ] Collect feedback

## 🚨 Known Limitations
- No rate limiting implemented yet
- No spam protection
- No user blocking mechanism
- Memory is per-serverless-instance (can be lost)
- No analytics dashboard

## Next Steps
1. Decision: SMS now or wait for WhatsApp?
2. Set spending limits on Twilio
3. Create simple landing page
4. Recruit first 10 beta testers
5. Get feedback and iterate
6. Scale to 100 users
