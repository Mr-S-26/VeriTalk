'use client'

import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import TeamMeeting from '@/components/meeting/team-meeting'
import { 
  Video, Lock, ShieldCheck, ArrowLeft, 
  Loader2, Copy, Check, type LucideIcon 
} from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'

// --- Components ---

const LoadingScreen = () => (
  <div className="h-screen w-full bg-neutral-950 flex flex-col items-center justify-center text-white space-y-6">
    <div className="relative">
      <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full animate-pulse" />
      <Loader2 className="w-12 h-12 text-indigo-500 animate-spin relative z-10" />
    </div>
    <div className="text-center space-y-2">
      <h2 className="text-xl font-semibold tracking-tight">Joining Room...</h2>
      <p className="text-neutral-500 text-sm">Establishing a secure connection.</p>
    </div>
  </div>
)

// FIX: Replaced 'any' with 'LucideIcon'
const HeaderBadge = ({ label, icon: Icon }: { label: string, icon: LucideIcon }) => (
  <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900 border border-neutral-800 text-xs font-medium text-neutral-400">
    <Icon className="w-3.5 h-3.5" />
    <span>{label}</span>
  </div>
)

// --- Main Logic ---

function MeetingContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const customRoom = searchParams.get('room')
  const mode = searchParams.get('mode') // 'video' or 'audio'

  const [user, setUser] = useState<{ name: string, id: string, email: string } | null>(null)
  const [roomName, setRoomName] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      // 1. Get User
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()
      
      setUser({
        name: profile?.full_name || 'Staff Member',
        id: user.id,
        email: user.email || 'user@example.com'
      })

      // 2. Determine Room Name
      if (customRoom) {
        // CASE A: Private 1:1 Call (passed via URL)
        setRoomName(customRoom)
      } else {
        // CASE B: General Meeting (Fetch Workspace ID)
        // We default to the first workspace they are a member of for the "General" room
        const { data: member } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', user.id)
          .maybeSingle()
        
        if (member) setRoomName(member.workspace_id)
      }
    }
    init()
  }, [supabase, customRoom, router])

  const copyRoomId = () => {
    if (roomName) {
        navigator.clipboard.writeText(window.location.href)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
    }
  }

  if (!user || !roomName) return <LoadingScreen />

  const isPrivate = !!customRoom

  return (
    <div className="flex flex-col h-screen w-full bg-neutral-950 overflow-hidden">
      
      {/* 1. Header Navigation */}
      <header className="flex items-center justify-between px-4 py-3 md:px-6 border-b border-neutral-800 shrink-0 bg-neutral-950 z-10">
        
        {/* Left: Back & Title */}
        <div className="flex items-center gap-4">
            <button 
                onClick={() => router.back()} 
                className="p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                title="Leave Call"
            >
                <ArrowLeft className="w-5 h-5" />
            </button>
            
            <div>
                <h1 className="text-base md:text-lg font-semibold text-white flex items-center gap-2">
                    {isPrivate ? (
                        <Lock className="w-4 h-4 text-amber-500" />
                    ) : (
                        <Video className="w-4 h-4 text-indigo-500" />
                    )}
                    {isPrivate ? 'Private Call' : 'General Team Room'}
                </h1>
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                   <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                   {isPrivate ? 'End-to-end Encrypted' : 'Live Voice & Video'}
                </div>
            </div>
        </div>

        {/* Center: (Optional) Room Info / Copy Link */}
        <div className="hidden md:flex items-center justify-center">
            <button 
                onClick={copyRoomId}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-neutral-900 text-neutral-500 hover:text-neutral-300 transition-colors text-xs"
            >
                {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                {isCopied ? 'Link Copied' : 'Copy Room Link'}
            </button>
        </div>

        {/* Right: Security Badge */}
        <div className="flex items-center gap-3">
            <HeaderBadge label="HD Audio" icon={Video} />
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Secure</span>
            </div>
        </div>
      </header>
      
      {/* 2. Main Video Area */}
      <main className="flex-1 relative bg-neutral-900/50 p-2 md:p-4">
        <div className="w-full h-full rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl relative bg-black">
            <TeamMeeting 
                roomName={roomName} 
                userName={user.name} 
                email={user.email} 
                startVideo={mode === 'video'} 
            />
        </div>
      </main>
    </div>
  )
}

export default function MeetingPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <MeetingContent />
    </Suspense>
  )
}