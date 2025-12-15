'use client'

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePathname } from 'next/navigation'
import { Bell, X, MessageCircle } from 'lucide-react'
import { useCall } from './call-provider' // IMPORT USE CALL HERE
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
  const [notificationToast, setNotificationToast] = useState<{ sender: string, text: string } | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  
  // Get unlock function from CallProvider
  const { unlockAudio } = useCall()

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
    // ... (logic remains the same)
    const originalTitle = document.title
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) StaffSync`
    } else {
      document.title = 'StaffSync' 
    }
    return () => { document.title = 'StaffSync' }
  }, [unreadCount])

  // 2. Play Sound Helper 
  const playNotificationSound = useCallback(() => {
    if (!soundEnabled || !audioRef.current) return
    
    const playPromise = audioRef.current.play()
    if (playPromise !== undefined) {
      playPromise
        .catch((error) => {
          console.warn("Notification sound blocked by browser after unlock attempt:", error)
        })
    }
  }, [soundEnabled])

  // 3. Toggle Sound Preference (FIXED: Calls unlockAudio when turning ON)
  const toggleSound = () => {
      const newState = !soundEnabled
      setSoundEnabled(newState)
      localStorage.setItem('staffsync_sound_enabled', String(newState))
      
      // CRITICAL FIX: If turning sound ON, trigger the browser's audio unlock
      if (newState) {
          unlockAudio()
      }
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

          const isChattingWithSender = pathname.includes(`/messages/${newMsg.sender_id}`) 
          
          if (!isChattingWithSender) {
              setUnreadCount((prev) => prev + 1)
              playNotificationSound()
              
              // Fetch sender name for the toast
              const { data } = await supabase.from('profiles').select('full_name').eq('id', newMsg.sender_id).single()
              
              setNotificationToast({
                sender: data?.full_name || 'Someone',
                text: newMsg.content
              })

              setTimeout(() => setNotificationToast(null), 4000)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, pathname, supabase, playNotificationSound])

  const clearNotifications = () => setUnreadCount(0)


  return (
    <NotificationContext.Provider value={{ unreadCount, clearNotifications, soundEnabled, toggleSound }}>
      <audio ref={audioRef} src="/sounds/notification.mp3" preload="auto" />

      {/* B. Custom Notification Toast (Keep this) */}
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