import type { ChatMessage, StoredChatSession } from '../types/assistant'

/**
 * Maximum number of messages to store in chat history
 */
export const MAX_STORED_MESSAGES = 50

/**
 * Get the localStorage key for a user's chat session
 */
function getChatStorageKey(userId: string): string {
  return `assistant_chat_${userId}`
}

/**
 * Save a message to chat history in localStorage.
 * Maintains a maximum of 50 messages, removing oldest when exceeded.
 * 
 * @param userId - The user's ID
 * @param message - The message to save
 */
export function saveMessage(userId: string, message: ChatMessage): void {
  const key = getChatStorageKey(userId)
  const existingData = localStorage.getItem(key)
  
  let session: StoredChatSession
  
  if (existingData) {
    try {
      session = JSON.parse(existingData) as StoredChatSession
    } catch {
      // If parsing fails, start fresh
      session = {
        userId,
        messages: [],
        lastReferencedTaskId: null,
        lastReferencedSubtaskId: null,
        lastUpdated: new Date().toISOString(),
      }
    }
  } else {
    session = {
      userId,
      messages: [],
      lastReferencedTaskId: null,
      lastReferencedSubtaskId: null,
      lastUpdated: new Date().toISOString(),
    }
  }
  
  // Add the new message
  session.messages.push(message)
  
  // Enforce the 50 message limit by removing oldest messages
  if (session.messages.length > MAX_STORED_MESSAGES) {
    session.messages = session.messages.slice(-MAX_STORED_MESSAGES)
  }
  
  session.lastUpdated = new Date().toISOString()
  
  localStorage.setItem(key, JSON.stringify(session))
}

/**
 * Load messages from chat history in localStorage.
 * Returns up to 50 most recent messages.
 * 
 * @param userId - The user's ID
 * @returns Array of chat messages, or empty array if none found
 */
export function loadMessages(userId: string): ChatMessage[] {
  const key = getChatStorageKey(userId)
  const data = localStorage.getItem(key)
  
  if (!data) {
    return []
  }
  
  try {
    const session = JSON.parse(data) as StoredChatSession
    
    // Convert timestamp strings back to Date objects
    return session.messages.map((msg) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }))
  } catch {
    return []
  }
}

/**
 * Clear all messages from chat history in localStorage.
 * 
 * @param userId - The user's ID
 */
export function clearMessages(userId: string): void {
  const key = getChatStorageKey(userId)
  localStorage.removeItem(key)
}

/**
 * Get the full stored chat session including metadata.
 * 
 * @param userId - The user's ID
 * @returns The stored chat session, or null if none found
 */
export function getStoredSession(userId: string): StoredChatSession | null {
  const key = getChatStorageKey(userId)
  const data = localStorage.getItem(key)
  
  if (!data) {
    return null
  }
  
  try {
    return JSON.parse(data) as StoredChatSession
  } catch {
    return null
  }
}

/**
 * Update the last referenced task/subtask IDs in the stored session.
 * 
 * @param userId - The user's ID
 * @param taskId - The last referenced task ID (or null to clear)
 * @param subtaskId - The last referenced subtask ID (or null to clear)
 */
export function updateLastReferencedIds(
  userId: string,
  taskId: string | null,
  subtaskId: string | null
): void {
  const key = getChatStorageKey(userId)
  const data = localStorage.getItem(key)
  
  let session: StoredChatSession
  
  if (data) {
    try {
      session = JSON.parse(data) as StoredChatSession
    } catch {
      session = {
        userId,
        messages: [],
        lastReferencedTaskId: null,
        lastReferencedSubtaskId: null,
        lastUpdated: new Date().toISOString(),
      }
    }
  } else {
    session = {
      userId,
      messages: [],
      lastReferencedTaskId: null,
      lastReferencedSubtaskId: null,
      lastUpdated: new Date().toISOString(),
    }
  }
  
  session.lastReferencedTaskId = taskId
  session.lastReferencedSubtaskId = subtaskId
  session.lastUpdated = new Date().toISOString()
  
  localStorage.setItem(key, JSON.stringify(session))
}
