import { useEffect } from 'react'

// Calls `handler` when a pointer event occurs outside `ref`'s element,
// but only while `active` is true — so callers can pass their own
// open/closed state and this only listens while actually open.
export function useClickOutside(ref, handler, active = true) {
  useEffect(() => {
    if (!active) return

    function handlePointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        handler()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [ref, handler, active])
}
