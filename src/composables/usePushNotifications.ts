import { ref } from 'vue'

const permission = ref<NotificationPermission>(
  typeof Notification !== 'undefined' ? Notification.permission : 'denied',
)

export function usePushNotifications() {
  const supported =
    typeof Notification !== 'undefined' && 'serviceWorker' in navigator

  async function requestPermission(): Promise<boolean> {
    if (!supported) return false
    const result = await Notification.requestPermission()
    permission.value = result
    return result === 'granted'
  }

  async function notify(
    title: string,
    body: string,
    tag?: string,
  ): Promise<void> {
    if (!supported || permission.value !== 'granted') return
    try {
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: tag ?? `trade-${Date.now()}`,
        vibrate: [150, 80, 150],
        requireInteraction: false,
      } as NotificationOptions)
    } catch (e) {
      console.warn('Push notification failed:', e)
    }
  }

  return { supported, permission, requestPermission, notify }
}
