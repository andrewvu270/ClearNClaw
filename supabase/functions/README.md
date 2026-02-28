# Supabase Edge Functions

This folder contains Edge Functions that handle sensitive API calls server-side.

## Setup

1. Install Supabase CLI if you haven't:
   ```bash
   npm install -g supabase
   ```

2. Link to your project:
   ```bash
   supabase link --project-ref fynhhstvakofhbecwbdi
   ```

3. Set the secrets (these stay server-side, never exposed to browser):
   ```bash
   supabase secrets set DO_AGENT_ENDPOINT=your_do_endpoint
   supabase secrets set DO_AGENT_ACCESS_KEY=your_do_access_key
   supabase secrets set GROQ_API_KEY=your_groq_api_key
   supabase secrets set VAPI_PRIVATE_KEY=your_vapi_private_key
   ```

4. Deploy the functions:
   ```bash
   supabase functions deploy ai-proxy
   ```

## Functions

### ai-proxy

Handles all AI-related API calls:

- `action: 'breakdown'` - Calls DigitalOcean Agent for task breakdown
- `action: 'chat'` - Calls Groq for chat completions with function calling

All requests require a valid Supabase auth token.
