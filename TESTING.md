# Testing the Multi-Agent System

## Local Testing

### 1. Start the development server

```bash
npm run dev
```

The server will start at `http://localhost:3000`

### 2. Test the webhook endpoint directly

Use `curl` to simulate a Twilio webhook:

```bash
curl -X POST http://localhost:3000/api/webhook/twilio \
  -d "From=+15551234567" \
  -d "To=+1YOUR_TWILIO_NUMBER" \
  -d "Body=hello, what's my horoscope?"
```

You should see:
- Console logs showing task decomposition
- Agent spawning and execution
- Response synthesis
- TwiML XML response

### 3. Check the console logs

Look for these log patterns:
```
[InteractionAgent] Processing message: ...
[InteractionAgent] Decomposed into X task(s): ...
[InteractionAgent] Spawned X execution agent(s)
[GeneralTaskAgent] Executing general task: ...
[InteractionAgent] All agents completed
[InteractionAgent] Response synthesized
```

## Production Testing (Vercel)

### 1. Deploy to Vercel

```bash
vercel --prod
```

### 2. Test with Twilio

1. **Configure Twilio Webhook:**
   - Go to Twilio Console → Phone Numbers → Your Number
   - Set "A message comes in" webhook URL:
     ```
     https://your-app.vercel.app/api/webhook/twilio
     ```
   - Method: POST

2. **Send a test SMS:**
   - Text your Twilio number from your phone
   - Example: "what's my horoscope for today?"

3. **Check Vercel Logs:**
   ```bash
   vercel logs <deployment-url>
   ```
   
   Or in Vercel Dashboard:
   - Go to your project → Deployments → Latest
   - Click "Functions" → `/api/webhook/twilio`
   - View "Logs" tab

### 3. Verify Multi-Agent Flow

In the logs, you should see:
1. **Task Decomposition:**
   ```
   [InteractionAgent] Decomposed into 1 task(s): [ 'general_query' ]
   ```

2. **Agent Spawning:**
   ```
   [InteractionAgent] Spawned 1 execution agent(s)
   Registered agent <uuid> for task type: general_query
   ```

3. **Agent Execution:**
   ```
   [GeneralTaskAgent] Agent GeneralTaskAgent initialized for task: ...
   [GeneralTaskAgent] Executing general task: ...
   [GeneralTaskAgent] Sending request to OpenRouter API ...
   [GeneralTaskAgent] Task completed successfully
   ```

4. **Response Synthesis:**
   ```
   [InteractionAgent] All agents completed
   [InteractionAgent] Response synthesized (X chars)
   ```

## Testing Different Scenarios

### Simple Query
```
Message: "hello"
Expected: Single general_query task, direct response
```

### Complex Query
```
Message: "what's my horoscope and remind me to call mom"
Expected: Multiple tasks decomposed, multiple agents spawned
```

### Error Handling
```
Message: (any message)
If OpenRouter fails: Should see error logs, fallback response
```

## Debugging

### Check Agent Registry
The `AgentRegistry` tracks all active agents. You can add logging:

```typescript
// In interactionAgent.ts, after spawning:
console.log('Active agents:', interactionAgent.getRegistry().getAllAgents().length)
```

### Check Task Decomposition
The `TaskDecomposer` uses AI to analyze requests. Check logs for:
- Decomposed tasks array
- Task types and priorities
- Any parsing errors

### Check Execution Results
Each agent returns an `ExecutionResult` with:
- `status`: 'success' | 'error' | 'partial'
- `output`: The agent's response
- `logs`: Array of action logs
- `metadata`: Additional info (duration, tokens, etc.)

## Common Issues

### 1. "OpenRouter API key not configured"
- Check `.env.local` has `OPENROUTER_API_KEY`
- For production, verify Vercel environment variables

### 2. "Task decomposition error"
- Check OpenRouter API key is valid
- Check network connectivity
- Fallback: Single general_query task should still work

### 3. No response from agent
- Check Vercel function logs
- Verify timeout settings (10s default)
- Check OpenRouter API status

## Performance Testing

### Measure Agent Execution Time
Logs include duration in metadata:
```
metadata: { duration: 1234, agentType: 'GeneralTaskAgent' }
```

### Test Parallel Execution
Send a message that decomposes into multiple tasks to verify parallel execution.

## Next Steps

Once basic testing works:
1. Add more specialized agents (reminder, email, etc.)
2. Test agent reuse optimization
3. Test result synthesis with multiple agents
4. Add agent memory persistence


