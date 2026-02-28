import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BreakdownRequest {
  action: 'breakdown'
  description: string
}

interface ChatRequest {
  action: 'chat'
  messages: { role: string; content: string }[]
  functions?: unknown[]
}

type RequestBody = BreakdownRequest | ChatRequest

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization')
    console.log('Auth header present:', !!authHeader)
    
    if (!authHeader) {
      console.log('No auth header - returning 401')
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create Supabase client to verify the user
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    console.log('Supabase URL present:', !!supabaseUrl)
    console.log('Supabase Anon Key present:', !!supabaseAnonKey)
    
    const supabaseClient = createClient(
      supabaseUrl ?? '',
      supabaseAnonKey ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    console.log('Auth result - user:', !!user, 'error:', authError?.message)
    
    if (authError || !user) {
      console.log('Auth failed - returning 401')
      return new Response(JSON.stringify({ error: 'Unauthorized', details: authError?.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    console.log('Auth successful for user:', user.id)

    const body: RequestBody = await req.json()

    if (body.action === 'breakdown') {
      // Call DigitalOcean Agent for task breakdown
      const result = await callDOAgent(body.description)
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (body.action === 'chat') {
      // Call Groq for chat completions
      const result = await callGroq(body.messages, body.functions)
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})


/**
 * Call DigitalOcean Agent for ADHD task breakdown
 */
async function callDOAgent(description: string) {
  const endpoint = Deno.env.get('DO_AGENT_ENDPOINT')?.replace(/\/+$/, '')
  const accessKey = Deno.env.get('DO_AGENT_ACCESS_KEY')

  if (!endpoint || !accessKey) {
    throw new Error('DO Agent not configured')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(`${endpoint}/api/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessKey}`,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: description }],
        stream: false,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Agent responded with status ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No content in agent response')
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Could not find JSON in agent response')
    }

    const parsed = JSON.parse(jsonMatch[0])
    const rawSubTasks = parsed.subtasks ?? parsed.subTasks

    if (!parsed.emoji || !Array.isArray(rawSubTasks)) {
      throw new Error('Malformed agent response')
    }

    const subTasks = rawSubTasks.map((st: string | { name: string; emoji: string }) => {
      if (typeof st === 'string') return { name: st, emoji: '▪️' }
      return { name: st.name, emoji: st.emoji || '▪️' }
    })

    const energyTag = parsed.energyTag ?? parsed.energy_tag ?? 'medium'

    return { emoji: parsed.emoji, subTasks, energyTag }
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Call Groq for chat completions with function calling
 */
async function callGroq(
  messages: { role: string; content: string }[],
  functions?: unknown[]
) {
  const apiKey = Deno.env.get('GROQ_API_KEY')

  if (!apiKey) {
    throw new Error('Groq API key not configured')
  }

  const body: Record<string, unknown> = {
    model: 'llama-3.3-70b-versatile',
    messages,
    temperature: 0.7,
    max_tokens: 1024,
  }

  if (functions && functions.length > 0) {
    body.tools = functions.map((f) => ({ type: 'function', function: f }))
    body.tool_choice = 'auto'
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Groq API error: ${response.status} - ${errorText}`)
  }

  return await response.json()
}
