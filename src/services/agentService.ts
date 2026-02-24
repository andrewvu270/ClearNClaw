export interface AgentResponse {
  emoji: string
  subTasks: string[]
}

const AGENT_TIMEOUT_MS = 10_000

/**
 * Sends a Big Task description to the DigitalOcean Agent
 * and returns an emoji + list of sub-tasks.
 * Aborts after 10 seconds.
 */
export async function breakDownTask(description: string): Promise<AgentResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS)

  try {
    const response = await fetch(
      import.meta.env.VITE_AGENT_ENDPOINT as string,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
        signal: controller.signal,
      }
    )

    if (!response.ok) {
      throw new Error(`Agent responded with status ${response.status}`)
    }

    const data = await response.json()

    if (!data.emoji || !Array.isArray(data.subTasks)) {
      throw new Error('Malformed agent response')
    }

    return { emoji: data.emoji, subTasks: data.subTasks }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Agent request timed out. Please try again.')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
