'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// --- Types ---
interface TimerContextType {
  isWorking: boolean
  time: number
  toggleTimer: () => Promise<void>
  formatTime: (seconds: number) => string
}

const TimerContext = createContext<TimerContextType | undefined>(undefined)

// --- Constants ---
const STORAGE_KEY_START = 'staffsync_timer_start'
const STORAGE_KEY_IS_WORKING = 'staffsync_is_working'

export function TimerProvider({ children }: { children: ReactNode }) {
  const [isWorking, setIsWorking] = useState(false)
  const [time, setTime] = useState(0)
  const [startTime, setStartTime] = useState<number | null>(null)
  
  const supabase = createClient()
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // 1. REHYDRATE TIMER (Handle Page Refresh)
  useEffect(() => {
    const savedIsWorking = localStorage.getItem(STORAGE_KEY_IS_WORKING) === 'true'
    const savedStartTime = localStorage.getItem(STORAGE_KEY_START)

    if (savedIsWorking && savedStartTime) {
      const start = parseInt(savedStartTime, 10)
      const now = Date.now()
      const elapsed = Math.floor((now - start) / 1000)

      setStartTime(start)
      setTime(elapsed > 0 ? elapsed : 0)
      setIsWorking(true)
    }
  }, [])

  // 2. THE TICKER (Drift-Free)
  useEffect(() => {
    let interval: NodeJS.Timeout
    
    // Helper to update document title
    const updateTitle = (seconds: number) => {
        const formatted = formatTime(seconds)
        document.title = isWorking ? `(${formatted}) StaffSync` : 'StaffSync'
    }

    if (isWorking && startTime) {
      interval = setInterval(() => {
        const now = Date.now()
        const seconds = Math.floor((now - startTime) / 1000)
        setTime(seconds)
        updateTitle(seconds)
      }, 1000)
    } else {
      document.title = 'StaffSync'
    }

    return () => {
      clearInterval(interval)
      document.title = 'StaffSync' // Cleanup
    }
  }, [isWorking, startTime])

  // 3. ACTIONS
  const toggleTimer = async () => {
    // Play Click Sound
    if (audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play().catch(() => {})
    }

    if (!isWorking) {
      // --- START ---
      const now = Date.now()
      setStartTime(now)
      setIsWorking(true)
      
      // Persistence
      localStorage.setItem(STORAGE_KEY_START, now.toString())
      localStorage.setItem(STORAGE_KEY_IS_WORKING, 'true')

      // DB Status Update (Optimistic)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('profiles').update({ current_status: 'working' }).eq('id', user.id)
      }

    } else {
      // --- STOP ---
      if (!startTime) return

      const endTimeIso = new Date().toISOString()
      const startTimeIso = new Date(startTime).toISOString()
      const finalDuration = time

      // Reset State Immediately (Optimistic UI)
      setIsWorking(false)
      setTime(0)
      setStartTime(null)
      
      // Clear Persistence
      localStorage.removeItem(STORAGE_KEY_START)
      localStorage.removeItem(STORAGE_KEY_IS_WORKING)

      // Async DB Operations
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
            // A. Update Status
            await supabase.from('profiles').update({ current_status: 'online' }).eq('id', user.id)

            // B. Find Workspace
            const { data: memberData } = await supabase
                .from('workspace_members')
                .select('workspace_id')
                .eq('user_id', user.id)
                .maybeSingle()
            
            if (memberData) {
                // C. Log Time
                const { error } = await supabase.from('time_logs').insert({
                    user_id: user.id,
                    workspace_id: memberData.workspace_id,
                    start_time: startTimeIso,
                    end_time: endTimeIso,
                    duration_seconds: finalDuration
                })
                if (error) throw error
            } else {
                console.warn("User has no workspace, time log saved locally but not synced.")
                // Optional: You could save to a 'pending_logs' local storage here
            }
        }
      } catch (err) {
        console.error('Error saving time log:', err)
        alert('Failed to save time log. Please check your connection.')
      }
    }
  }

  // Helper
  const formatTime = useCallback((seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }, [])

  return (
    <TimerContext.Provider value={{ isWorking, time, toggleTimer, formatTime }}>
      {/* Optional: Simple beep sound for feedback */}
      <audio ref={audioRef} src="/sounds/click.mp3" preload="auto" />
      {children}
    </TimerContext.Provider>
  )
}

export function useTimer() {
  const context = useContext(TimerContext)
  if (context === undefined) {
    throw new Error('useTimer must be used within a TimerProvider')
  }
  return context
}