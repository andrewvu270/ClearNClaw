/**
 * Validates task description before sending to AI agent.
 * Filters out trash input to save API costs.
 */
export function validateTaskDescription(text: string): { valid: boolean; reason?: string } {
  const trimmed = text.trim()

  // Length checks
  if (trimmed.length < 3) {
    return { valid: false, reason: 'Task description is too short' }
  }
  if (trimmed.length > 300) {
    return { valid: false, reason: 'Task description is too long (max 300 chars)' }
  }

  // All same character repeated (e.g., "aaaaaaa", ".........")
  if (/^(.)\1+$/.test(trimmed)) {
    return { valid: false, reason: 'Please enter a real task' }
  }

  // No letters at all (just numbers/symbols)
  if (!/[a-zA-Z]/.test(trimmed)) {
    return { valid: false, reason: 'Task needs some words' }
  }

  // Keyboard mash detection - too many consonants in a row
  if (/[bcdfghjklmnpqrstvwxyz]{6,}/i.test(trimmed)) {
    return { valid: false, reason: 'Please enter a real task' }
  }

  // Repeated word spam: "test test test"
  const words = trimmed.toLowerCase().split(/\s+/)
  if (words.length >= 3) {
    const uniqueWords = new Set(words)
    if (uniqueWords.size === 1) {
      return { valid: false, reason: 'Please enter a real task' }
    }
  }

  // URL detection
  if (/https?:\/\/|www\./i.test(trimmed)) {
    return { valid: false, reason: 'Please describe the task, not paste a link' }
  }

  // Emoji-only (more than 50% emojis compared to letters)
  const emojiCount = (trimmed.match(/\p{Emoji}/gu) || []).length
  const letterCount = (trimmed.match(/[a-zA-Z]/g) || []).length
  if (emojiCount > letterCount && emojiCount > 3) {
    return { valid: false, reason: 'Please add some words to describe the task' }
  }

  // Too many newlines (pasted content)
  if ((trimmed.match(/\n/g) || []).length > 3) {
    return { valid: false, reason: 'Please enter a single task description' }
  }

  return { valid: true }
}

/**
 * Simple boolean check for backward compatibility.
 * Use validateTaskDescription() for detailed error messages.
 */
export function isValidTaskDescription(input: string): boolean {
  return validateTaskDescription(input).valid
}
