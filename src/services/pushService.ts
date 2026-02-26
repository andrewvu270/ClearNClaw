import { supabase } from '../lib/supabase'

/**
 * Checks if the browser supports push notifications via the Push API.
 */
export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/**
 * Subscribes the user to push notifications.
 * Requests notification permission, gets a PushSubscription from the service worker,
 * and stores it in Supabase.
 */
export async function subscribePush(userId: string): Promise<boolean> {
  if (!isPushSupported()) return false

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  const registration = await navigator.serviceWorker.ready
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
  if (!vapidPublicKey) {
    console.warn('VITE_VAPID_PUBLIC_KEY not configured')
    return false
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  })

  const json = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint!,
      p256dh: json.keys!.p256dh,
      auth: json.keys!.auth,
    },
    { onConflict: 'user_id,endpoint' }
  )

  if (error) {
    console.error('Failed to store push subscription:', error)
    return false
  }

  // Update profile push_enabled flag
  await supabase
    .from('profiles')
    .update({ push_enabled: true })
    .eq('id', userId)

  return true
}

/**
 * Unsubscribes the user from push notifications.
 * Removes the subscription from the browser and from Supabase.
 */
export async function unsubscribePush(userId: string): Promise<void> {
  if (isPushSupported()) {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
      }
    } catch (err) {
      console.warn('Failed to unsubscribe from browser push:', err)
    }
  }

  // Remove all subscriptions for this user from Supabase
  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)

  // Update profile push_enabled flag
  await supabase
    .from('profiles')
    .update({ push_enabled: false, push_frequency: null })
    .eq('id', userId)
}

/**
 * Updates the push notification frequency preference.
 */
export async function updatePushFrequency(
  userId: string,
  frequency: 'hourly' | '2hours' | '3daily' | 'daily'
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ push_frequency: frequency })
    .eq('id', userId)

  if (error) console.error('Failed to update push frequency:', error)
}

/**
 * Selects the best task to nudge the user about.
 * Returns the active Big Task with the fewest remaining incomplete sub-tasks.
 */
export function selectNotificationTask<
  T extends { subTasks: { completed: boolean }[]; completed: boolean }
>(tasks: T[]): T | null {
  const active = tasks.filter(
    (t) => !t.completed && t.subTasks.some((st) => !st.completed)
  )
  if (active.length === 0) return null

  return active.reduce((best, task) => {
    const remaining = task.subTasks.filter((st) => !st.completed).length
    const bestRemaining = best.subTasks.filter((st) => !st.completed).length
    return remaining < bestRemaining ? task : best
  })
}

/** Converts a URL-safe base64 string to a Uint8Array (for VAPID key). */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
