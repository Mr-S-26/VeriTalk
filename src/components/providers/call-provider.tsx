'use client'

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Phone, Video, X, PhoneIncoming, PhoneOff, Check, Mic, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// --- Types ---
type SignalType = 'offer' | 'answer' | 'reject' | 'cancel'

interface SignalPayload {
  type: SignalType
  callerId: string
  callerName?: string
  receiverId: string
  receiverName?: string
  roomId?: string
  isVideo?: boolean
}

type CallStatus = 'idle' | 'outgoing' | 'incoming' | 'connected'

interface CallContextType {
  initiateCall: (receiverId: string, receiverName: string, isVideo: boolean) => void
}

const CallContext = createContext<CallContextType | undefined>(undefined)

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<CallStatus>('idle')
  const [caller, setCaller] = useState<{ id: string; name: string } | null>(null)
  const [receiver, setReceiver] = useState<{ id: string; name: string } | null>(null)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [isVideoCall, setIsVideoCall] = useState(false)
  
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)

  const ringtoneRef = useRef<HTMLAudioElement | null>(null)
  const supabase = createClient()
  const router = useRouter()

  // --- Audio Helpers ---
  const playRing = useCallback(() => {
    if (ringtoneRef.current) {
        ringtoneRef.current.currentTime = 0
        ringtoneRef.current.play().catch(e => console.error("Ringtone error:", e))
    }
  }, [])

  const stopRing = useCallback(() => {
    if (ringtoneRef.current) {
        ringtoneRef.current.pause()
        ringtoneRef.current.currentTime = 0
    }
  }, [])

  // 1. Setup User
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      if (profile) setUserName(profile.full_name)
    }
    init()
  }, [supabase])

  // 2. Realtime Signaling
  useEffect(() => {
    if (!userId) return

    const channel = supabase.channel('app-signaling')

    channel
      .on('broadcast', { event: 'call-signal' }, (event) => {
        const payload = event.payload as SignalPayload

        // Filter: Must involve me
        if (payload.receiverId !== userId && payload.callerId !== userId) return

        // A. Incoming Call
        if (payload.receiverId === userId && payload.type === 'offer') {
            if (status !== 'idle') {
                // TODO: Auto-reject if busy?
                return 
            }
            
            setCaller({ id: payload.callerId, name: payload.callerName || 'Unknown' })
            setRoomId(payload.roomId || null)
            setIsVideoCall(!!payload.isVideo)
            setStatus('incoming')
            playRing()
        }

        // B. Call Accepted
        if (payload.callerId === userId && payload.type === 'answer') {
            stopRing()
            setStatus('connected')
            router.push(`/meeting?room=${payload.roomId}&mode=${payload.isVideo ? 'video' : 'audio'}`)
            
            // Clear UI after a moment so the user sees "Connected" briefly
            setTimeout(() => {
                setStatus('idle')
                setReceiver(null)
            }, 1000)
        }

        // C. Call Rejected
        if (payload.callerId === userId && payload.type === 'reject') {
            stopRing()
            setStatus('idle')
            setReceiver(null)
            // Optional: Show toast "Call declined"
        }

        // D. Cancelled by Caller
        if (payload.receiverId === userId && payload.type === 'cancel') {
            stopRing()
            setStatus('idle')
            setCaller(null)
        }
      })
      .subscribe()

    return () => {
      stopRing()
      supabase.removeChannel(channel)
    }
  }, [userId, status, supabase, router, playRing, stopRing])

  // --- Actions ---

  const initiateCall = async (receiverId: string, receiverName: string, isVideo: boolean) => {
      if (!userId || !userName) return

      const newRoomId = [userId, receiverId].sort().join('-')
      setRoomId(newRoomId)
      setReceiver({ id: receiverId, name: receiverName })
      setIsVideoCall(isVideo)
      setStatus('outgoing')
      playRing() // Optional: Play ringback tone

      await supabase.channel('app-signaling').send({
          type: 'broadcast',
          event: 'call-signal',
          payload: {
              type: 'offer',
              callerId: userId,
              callerName: userName,
              receiverId: receiverId,
              roomId: newRoomId,
              isVideo
          } as SignalPayload
      })
  }

  const acceptCall = async () => {
      if (!caller || !roomId || !userId) return
      stopRing()
      setStatus('connected')

      await supabase.channel('app-signaling').send({
          type: 'broadcast',
          event: 'call-signal',
          payload: {
              type: 'answer',
              callerId: caller.id,
              receiverId: userId, 
              roomId: roomId,
              isVideo: isVideoCall
          } as SignalPayload
      })

      router.push(`/meeting?room=${roomId}&mode=${isVideoCall ? 'video' : 'audio'}`)
      
      setTimeout(() => {
        setStatus('idle')
        setCaller(null)
      }, 1000)
  }

  const rejectCall = async () => {
      if (!caller || !userId) return
      stopRing()
      setStatus('idle')
      setCaller(null)

      await supabase.channel('app-signaling').send({
          type: 'broadcast',
          event: 'call-signal',
          payload: {
              type: 'reject',
              callerId: caller.id,
              receiverId: userId,
              receiverName: userName
          } as SignalPayload
      })
  }

  const cancelCall = async () => {
      if (!receiver || !userId) return
      stopRing()
      setStatus('idle')
      setReceiver(null)

      await supabase.channel('app-signaling').send({
          type: 'broadcast',
          event: 'call-signal',
          payload: {
              type: 'cancel',
              callerId: userId,
              receiverId: receiver.id
          } as SignalPayload
      })
  }

  return (
    <CallContext.Provider value={{ initiateCall }}>
      {children}
      <audio ref={ringtoneRef} src="/sounds/ringtone.mp3" loop />

      {/* OVERLAY: Only render if active */}
      {(status === 'incoming' || status === 'outgoing' || status === 'connected') && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            
            {/* Backdrop Blur */}
            <div className="absolute inset-0 bg-neutral-950/60 backdrop-blur-md animate-in fade-in duration-300" />
            
            {/* Card */}
            <div className="relative bg-neutral-900 border border-neutral-800 p-8 md:p-12 rounded-3xl shadow-2xl flex flex-col items-center w-full max-w-sm animate-in zoom-in-95 duration-300">
                
                {/* Avatar with Pulse */}
                <div className="relative mb-8">
                    {/* Pulsing Rings */}
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-500/20 opacity-75 duration-1000"></span>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-500/10 opacity-75 duration-2000 delay-150"></span>
                    
                    <div className="h-32 w-32 bg-neutral-800 rounded-full flex items-center justify-center relative z-10 border-4 border-neutral-900 shadow-xl overflow-hidden">
                        {/* Placeholder for actual User Image if you have it */}
                        {isVideoCall ? <Video className="w-12 h-12 text-indigo-400" /> : <Phone className="w-12 h-12 text-indigo-400" />}
                    </div>
                </div>

                {/* Text Info */}
                <div className="text-center mb-10 space-y-2">
                    <h3 className="text-2xl font-bold text-white tracking-tight">
                        {status === 'incoming' ? caller?.name : receiver?.name}
                    </h3>
                    <p className="text-indigo-400 font-medium flex items-center justify-center gap-2">
                        {status === 'connected' ? (
                            <span className="text-emerald-400">Connecting...</span>
                        ) : status === 'outgoing' ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" /> Calling...
                            </>
                        ) : (
                            <span className="animate-pulse">Incoming {isVideoCall ? 'Video' : 'Audio'} Call...</span>
                        )}
                    </p>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-10">
                    {/* Reject / Cancel */}
                    <div className="flex flex-col items-center gap-3 group">
                        <button 
                            onClick={status === 'incoming' ? rejectCall : cancelCall}
                            className="w-16 h-16 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 border border-red-500/20 hover:border-transparent hover:shadow-lg hover:shadow-red-500/40"
                        >
                            {status === 'incoming' ? <PhoneOff className="w-7 h-7" /> : <X className="w-7 h-7" />}
                        </button>
                        <span className="text-xs text-neutral-500 font-medium group-hover:text-red-400 transition-colors">
                            {status === 'incoming' ? 'Decline' : 'Cancel'}
                        </span>
                    </div>

                    {/* Accept (Only for Incoming) */}
                    {status === 'incoming' && (
                        <div className="flex flex-col items-center gap-3 group">
                            <button 
                                onClick={acceptCall}
                                className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 animate-bounce"
                                style={{ animationDuration: '2s' }}
                            >
                                <PhoneIncoming className="w-7 h-7" />
                            </button>
                            <span className="text-xs text-neutral-500 font-medium group-hover:text-emerald-400 transition-colors">Accept</span>
                        </div>
                    )}
                </div>

            </div>
         </div>
      )}
    </CallContext.Provider>
  )
}

export function useCall() {
  const context = useContext(CallContext)
  if (context === undefined) throw new Error('useCall must be used within a CallProvider')
  return context
}