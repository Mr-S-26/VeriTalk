'use client'

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePathname } from 'next/navigation'
import { Bell, X, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NotificationContextType {
  unreadCount: number
  clearNotifications: () => void
  soundEnabled: boolean
  toggleSound: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [showAudioBanner, setShowAudioBanner] = useState(false)
  const [notificationToast, setNotificationToast] = useState<{ sender: string, text: string } | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  
  // Lazy init from localStorage
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('staffsync_sound_enabled')
        return saved !== null ? saved === 'true' : true
    }
    return true
  })

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const pathname = usePathname()
  const supabase = createClient()

  // 1. Tab Title Management
  useEffect(() => {
    const originalTitle = document.title
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) StaffSync`
    } else {
      document.title = 'StaffSync' // Or revert to originalTitle if stored
    }
    return () => { document.title = 'StaffSync' }
  }, [unreadCount])

  // 2. Play Sound Helper
  const playNotificationSound = useCallback(() => {
    if (!soundEnabled || !audioRef.current) return
    
    const playPromise = audioRef.current.play()
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          // Playback started
          setShowAudioBanner(false)
        })
        .catch((error) => {
          console.warn("Autoplay blocked:", error)
          setShowAudioBanner(true)
        })
    }
  }, [soundEnabled])

  // 3. Toggle Sound Preference
  const toggleSound = () => {
      const newState = !soundEnabled
      setSoundEnabled(newState)
      localStorage.setItem('staffsync_sound_enabled', String(newState))
      if (!newState) setShowAudioBanner(false)
  }

  // 4. Setup Auth & Subscription
  useEffect(() => {
    const init = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) setUserId(user.id)
    }
    init()

    // Realtime Listener
    const channel = supabase
      .channel('global-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages' },
        async (payload) => {
          const newMsg = payload.new as { receiver_id: string, sender_id: string, content: string }
          
          if (!userId || newMsg.receiver_id !== userId) return

          // If we are NOT currently looking at this chat
          const isChattingWithSender = pathname.includes(`/messages/${newMsg.sender_id}`) // Check your route pattern
          
          if (!isChattingWithSender) {
              setUnreadCount((prev) => prev + 1)
              playNotificationSound()
              
              // Fetch sender name for the toast
              const { data } = await supabase.from('profiles').select('full_name').eq('id', newMsg.sender_id).single()
              
              // Trigger Toast
              setNotificationToast({
                sender: data?.full_name || 'Someone',
                text: newMsg.content
              })

              // Clear toast after 4 seconds
              setTimeout(() => setNotificationToast(null), 4000)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, pathname, supabase, playNotificationSound])

  const clearNotifications = () => setUnreadCount(0)

  // 5. Unlock Audio Overlay
  const unlockAudio = () => {
    if (audioRef.current) {
        audioRef.current.play().then(() => {
            audioRef.current?.pause()
            audioRef.current!.currentTime = 0
            setShowAudioBanner(false)
        })
    }
  }

  return (
    <NotificationContext.Provider value={{ unreadCount, clearNotifications, soundEnabled, toggleSound }}>
      <audio ref={audioRef} src="/sounds/notification.mp3" preload="auto" />

      {/* A. Browser Autoplay Blocker Warning */}
      {showAudioBanner && soundEnabled && (
        <div className="fixed top-0 left-0 w-full bg-indigo-600 text-white z-[60] px-4 py-2 flex items-center justify-center gap-4 text-sm font-medium shadow-lg animate-in slide-in-from-top">
            <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 animate-pulse" />
                <span>Enable notification sounds?</span>
            </div>
            <button onClick={unlockAudio} className="bg-white text-indigo-700 px-3 py-1 rounded-full text-xs font-bold hover:bg-indigo-50 transition-colors">
                Enable
            </button>
            <button onClick={() => setShowAudioBanner(false)} className="opacity-70 hover:opacity-100">
                <X className="w-4 h-4" />
            </button>
        </div>
      )}

      {/* B. Custom Notification Toast */}
      {notificationToast && (
        <div className="fixed top-4 right-4 z-[60] max-w-sm w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
           <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-full text-indigo-600 dark:text-indigo-400">
             <MessageCircle className="w-5 h-5" />
           </div>
           <div className="flex-1 overflow-hidden">
             <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{notificationToast.sender}</h4>
             <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate">{notificationToast.text}</p>
           </div>
           <button onClick={() => setNotificationToast(null)} className="text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100">
             <X className="w-4 h-4" />
           </button>
        </div>
      )}
      
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotification() {
  const context = useContext(NotificationContext)
  if (context === undefined) throw new Error('useNotification must be used within a NotificationProvider')
  return context
}