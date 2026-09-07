import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchMyNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../lib/notifications'
import { useClickOutside } from '../hooks/useClickOutside'

export default function NotificationBell() {
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  useClickOutside(containerRef, () => setOpen(false), open)

  useEffect(() => {
    fetchUnreadCount().then(setUnreadCount).catch(() => {})
  }, [])

  function toggleOpen() {
    const next = !open
    setOpen(next)
    if (next) {
      setLoading(true)
      fetchMyNotifications()
        .then(setNotifications)
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }

  async function handleClickNotification(n) {
    if (!n.read) {
      await markNotificationRead(n.id).catch(() => {})
      setUnreadCount((c) => Math.max(0, c - 1))
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
    }
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  async function handleMarkAllRead() {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
    await markAllNotificationsRead(unreadIds).catch(() => {})
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={toggleOpen}
        className="p-2 rounded-btn hover:bg-gray-100 relative"
        aria-label="Notifications"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] max-h-96 overflow-y-auto bg-surface border border-border rounded-btn shadow-lg z-30">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-sm font-semibold text-heading">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-link hover:underline">
                Mark all read
              </button>
            )}
          </div>

          {loading && <p className="text-sm text-body/60 px-3 py-4">Loading…</p>}
          {!loading && notifications.length === 0 && (
            <p className="text-sm text-body/60 px-3 py-4">No notifications yet.</p>
          )}

          {!loading &&
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClickNotification(n)}
                className={`w-full text-left px-3 py-2.5 border-b border-border last:border-0 hover:bg-gray-50 ${
                  n.read ? '' : 'bg-info-bg/30'
                }`}
              >
                <p className="text-sm text-body break-words">{n.message}</p>
                <p className="text-xs text-body/40 mt-0.5">{new Date(n.created_at).toLocaleString()}</p>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
