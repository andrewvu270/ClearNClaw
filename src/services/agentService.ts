export interface AgentResponse {
  emoji: string
  subTasks: { name: string; emoji: string }[]
}

const AGENT_TIMEOUT_MS = 10_000

/**
 * Sends a Big Task description to the DigitalOcean Agent
 * using the OpenAI chat completions format.
 * The agent already has ADHD-friendly breakdown instructions configured.
 * Aborts after 10 seconds.
 */
export async function breakDownTask(description: string): Promise<AgentResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS)

  const endpoint = (import.meta.env.VITE_AGENT_ENDPOINT as string).replace(/\/+$/, '')

  try {
    const response = await fetch(
      `${endpoint}/api/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_AGENT_ACCESS_KEY}`,
        },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: description },
          ],
          stream: false,
        }),
        signal: controller.signal,
      }
    )

    if (!response.ok) {
      throw new Error(`Agent responded with status ${response.status}`)
    }

    const data = await response.json()

    const content = data.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('No content in agent response')
    }

    // Extract JSON from response (agent may include extra text despite instructions)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Could not find JSON in agent response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Agent uses "subtasks" (lowercase), we normalize to "subTasks"
    const rawSubTasks = parsed.subtasks ?? parsed.subTasks
    if (!parsed.emoji || !Array.isArray(rawSubTasks)) {
      throw new Error('Malformed agent response')
    }

    // Normalize: agent may return strings or {name, emoji} objects
    const subTasks = rawSubTasks.map((st: string | { name: string; emoji: string }) => {
      if (typeof st === 'string') return { name: st, emoji: '▪️' }
      return { name: st.name, emoji: st.emoji || '▪️' }
    })

    return { emoji: parsed.emoji, subTasks }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Agent request timed out. Please try again.')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
