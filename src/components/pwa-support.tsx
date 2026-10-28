import { useEffect, useState } from 'react'

export function PwaSupport() {
  const [offline, setOffline] = useState(false)
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => undefined)
    }
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  // The room owns a detailed connection banner and recovery controls.
  const roomHasConnectionStatus = typeof window !== 'undefined' && window.location.pathname.startsWith('/room/')
  return offline && !roomHasConnectionStatus ? <div className="dg-offline-status" role="status">网络已断开，重新连接后即可继续游戏。</div> : null
}
