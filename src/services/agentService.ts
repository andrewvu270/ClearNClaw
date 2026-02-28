import { supabase } from '../lib/supabase'
import type { EnergyTag } from '../utils/energyTag'
import { parseEnergyTag } from '../utils/energyTag'

export interface AgentResponse {
  emoji: string
  subTasks: { name: string; emoji: string }[]
  energyTag: EnergyTag
}

/**
 * Sends a Big Task description to the AI proxy Edge Function
 * which calls the DigitalOcean Agent for ADHD-friendly breakdown.
 */
export async function breakDownTask(description: string): Promise<AgentResponse> {
  const { data, error } = await supabase.functions.invoke('ai-proxy', {
    body: {
      action: 'breakdown',
      description,
    },
  })

  if (error) {
    throw new Error(error.message || 'Failed to break down task')
  }

  if (!data.emoji || !Array.isArray(data.subTasks)) {
    throw new Error('Malformed agent response')
  }

  return {
    emoji: data.emoji,
    subTasks: data.subTasks,
    energyTag: parseEnergyTag(data.energyTag),
  }
}
