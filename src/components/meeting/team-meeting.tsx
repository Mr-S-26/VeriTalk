'use client'

import { JitsiMeeting } from '@jitsi/react-sdk'
import { Loader2, AlertTriangle, WifiOff, ShieldCheck } from 'lucide-react'
import { useState, useEffect } from 'react'

interface TeamMeetingProps {
  roomName: string
  userName: string
  email: string
  startVideo?: boolean
}

export default function TeamMeeting({ roomName, userName, email, startVideo = false }: TeamMeetingProps) {
  const [jwt, setJwt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch Token
  useEffect(() => {
    let isMounted = true

    const fetchToken = async () => {
      try {
        const res = await fetch('/api/meeting-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomName, userName, email })
        })
        
        if (!res.ok) throw new Error('Failed to generate secure token')
        
        const data = await res.json()
        if (isMounted) {
            setJwt(data.token)
            setLoading(false)
        }
      } catch (err) {
        console.error(err)
        if (isMounted) {
            setError('Could not establish a secure connection to the meeting server.')
            setLoading(false)
        }
      }
    }
    
    fetchToken()

    return () => { isMounted = false }
  }, [roomName, userName, email])

  // --- Error State ---
  if (error) return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-neutral-950 text-rose-500 gap-4 p-6 text-center">
        <div className="p-4 bg-rose-500/10 rounded-full">
            <WifiOff className="w-8 h-8" />
        </div>
        <div>
            <h3 className="text-lg font-bold text-neutral-200">Connection Failed</h3>
            <p className="text-sm text-neutral-500 mt-1 max-w-xs mx-auto">{error}</p>
        </div>
        <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-sm font-medium transition-colors"
        >
            Retry Connection
        </button>
    </div>
  )

  // --- Loading State ---
  if (loading || !jwt) return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-neutral-950 text-white space-y-6">
      <div className="relative">
          <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full animate-pulse" />
          <Loader2 className="w-12 h-12 animate-spin text-indigo-500 relative z-10" />
      </div>
      <div className="flex flex-col items-center gap-2">
          <span className="font-semibold text-lg tracking-tight">Authenticating</span>
          <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
             <ShieldCheck className="w-3 h-3" />
             <span>Generating End-to-End Keys...</span>
          </div>
      </div>
    </div>
  )

  // --- Meeting Interface ---
  return (
    <div className="h-full w-full relative bg-neutral-950 overflow-hidden">
      <JitsiMeeting
        domain="8x8.vc"
        roomName={`${process.env.NEXT_PUBLIC_JITSI_APP_ID}/${roomName}`}
        jwt={jwt}
        configOverwrite={{
          startWithAudioMuted: false,
          startWithVideoMuted: !startVideo,
          prejoinPageEnabled: false,
          disableDeepLinking: true,
          subject: "StaffSync Team Call", // Sets the meeting title in UI
          hideConferenceSubject: false,
          toolbarButtons: [
             'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
             'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
             'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
             'videoquality', 'filmstrip', 'tileview', 'videobackgroundblur'
          ]
        }}
        interfaceConfigOverwrite={{
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          DEFAULT_REMOTE_DISPLAY_NAME: userName,
          // Try to match branding colors where Jitsi allows (limited)
          brandWatermarkLink: '',
          app_name: 'StaffSync',
          NATIVE_APP_NAME: 'StaffSync',
          MOBILE_APP_PROMO: false
        }}
        userInfo={{
          displayName: userName,
          email: email
        }}
        getIFrameRef={(iframeRef) => {
          iframeRef.style.height = '100%'
          iframeRef.style.width = '100%'
          iframeRef.style.background = '#0a0a0a' // matches neutral-950
          iframeRef.style.border = 'none'
        }}
      />
    </div>
  )
}