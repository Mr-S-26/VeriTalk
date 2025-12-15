'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Phone, Video, MoreVertical, Send, ArrowLeft, Loader2, User as UserIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCall } from '@/components/providers/call-provider'
import { cn } from '@/lib/utils'

// --- Types ---
interface Profile {
  id: string
  full_name: string
  avatar_url: string | null
  current_status: string // 'working', 'idle', 'offline'
}

interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
}

interface PageProps {
  params: Promise<{ id: string }>
}

// --- Components ---

const ChatSkeleton = () => (
  <div className="flex-1 p-6 space-y-6">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className={cn("flex w-full", i % 2 === 0 ? "justify-end" : "justify-start")}>
        <div className={cn("h-12 w-1/3 rounded-2xl animate-pulse", i % 2 === 0 ? "bg-indigo-100 dark:bg-indigo-900/30" : "bg-neutral-100 dark:bg-neutral-800")} />
      </div>
    ))}
  </div>
)

// --- Helper: Date Formatting ---
const formatMessageDate = (isoString: string) => {
  const date = new Date(isoString)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  
  return date.toLocaleTimeString([], { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true
  }) + (!isToday ? ` ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}` : '')
}

// --- Main Page ---

export default function DirectMessagePage({ params }: PageProps) {
  const router = useRouter()
  const { initiateCall } = useCall() 
  const supabase = createClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  
  const scrollRef = useRef<HTMLDivElement>(null)

  // 1. Initialization
  useEffect(() => {
    const init = async () => {
      // Resolve Next.js 15 Params
      const resolvedParams = await params
      setUserId(resolvedParams.id)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUser(user.id)
    }
    init()
  }, [params, supabase])

  // 2. Data Fetching & Realtime
  useEffect(() => {
    if (!userId || !currentUser) return

    const fetchData = async () => {
      setIsLoading(true)
      
      // A. Fetch Profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (profileData) setProfile(profileData as Profile)

      // B. Fetch History
      const { data: msgData } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUser})`)
        .order('created_at', { ascending: true })
      
      if (msgData) setMessages(msgData as Message[])
      setIsLoading(false)
    }

    fetchData()

    // C. Realtime Subscription
    const channel = supabase
      .channel(`dm-${userId}-${currentUser}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `sender_id=in.(${userId},${currentUser})`, 
        },
        (payload) => {
          const msg = payload.new as Message
          // Double check receiver to ensure it belongs to this conversation
          if (
            (msg.sender_id === userId && msg.receiver_id === currentUser) ||
            (msg.sender_id === currentUser && msg.receiver_id === userId)
          ) {
            setMessages((prev) => [...prev, msg])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, currentUser, supabase])

  // 3. Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading])

  // 4. Handlers
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !currentUser || !userId) return

    const text = newMessage
    setNewMessage('') 
    setIsSending(true)

    const { error } = await supabase.from('direct_messages').insert({
      sender_id: currentUser,
      receiver_id: userId,
      content: text
    })

    if (error) {
        console.error("Error sending message", error)
        setNewMessage(text) // Revert on error
    }
    setIsSending(false)
  }

  const handleCall = (type: 'audio' | 'video') => {
    if (!currentUser || !userId || !profile) return
    initiateCall(userId, profile.full_name, type === 'video')
    
  }

  // --- Render ---

  if (isLoading && !profile) {
     return <div className="h-full bg-white dark:bg-neutral-950 flex items-center justify-center"><Loader2 className="animate-spin text-neutral-400" /></div>
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-950 relative">
      
      {/* HEADER */}
      {profile && (
        <div className="h-16 px-4 md:px-6 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between shrink-0 z-10">
            <div className="flex items-center gap-3">
                <button 
                    onClick={() => router.back()} 
                    className="md:hidden text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 mr-1"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                
                <div className="relative">
                    <div className="h-10 w-10 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center overflow-hidden">
                        {profile.avatar_url ? (
                            <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                        ) : (
                            <span className="font-semibold text-neutral-500 text-sm">
                                {profile.full_name?.substring(0,2).toUpperCase()}
                            </span>
                        )}
                    </div>
                    {/* Status Dot */}
                    <div className={cn(
                        "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-neutral-900",
                        profile.current_status === 'working' ? "bg-emerald-500" : 
                        profile.current_status === 'idle' ? "bg-amber-500" : "bg-neutral-400"
                    )}>
                        {profile.current_status === 'working' && (
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                        )}
                    </div>
                </div>
                
                <div className="flex flex-col justify-center">
                    <h2 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 leading-none mb-1">
                        {profile.full_name}
                    </h2>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 capitalize flex items-center gap-1">
                        {profile.current_status === 'working' ? 'Focus Mode' : profile.current_status || 'Offline'}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-1 md:gap-2">
                <button 
                    onClick={() => handleCall('audio')} 
                    className="p-2.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-500 transition-colors"
                    title="Start Voice Call"
                >
                    <Phone className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                <button 
                    onClick={() => handleCall('video')} 
                    className="p-2.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-500 transition-colors"
                    title="Start Video Call"
                >
                    <Video className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-800 mx-1 hidden md:block" />
                <button className="p-2.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 transition-colors">
                    <MoreVertical className="w-4 h-4 md:w-5 md:h-5" />
                </button>
            </div>
        </div>
      )}

      {/* MESSAGES AREA */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-neutral-950 custom-scrollbar p-4 md:p-6 space-y-2">
        {isLoading ? (
            <ChatSkeleton />
        ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-neutral-400 opacity-60">
                <UserIcon className="w-16 h-16 mb-4 stroke-1" />
                <p>No messages yet.</p>
                <p className="text-sm">Say hello to {profile?.full_name}!</p>
            </div>
        ) : (
            messages.map((msg, index) => {
                const isMe = msg.sender_id === currentUser
                // Check if previous message was from same user (for grouping)
                const isSequence = index > 0 && messages[index - 1].sender_id === msg.sender_id
                
                return (
                    <div key={msg.id} className={cn(
                        "flex w-full animate-in fade-in slide-in-from-bottom-1 duration-200", 
                        isMe ? "justify-end" : "justify-start",
                        isSequence ? "mt-0.5" : "mt-4"
                    )}>
                        <div className={cn(
                            "max-w-[85%] md:max-w-[70%] flex flex-col relative group", 
                            isMe ? "items-end" : "items-start"
                        )}>
                            <div className={cn(
                                "px-4 py-2.5 text-sm shadow-sm break-words",
                                isMe 
                                ? "bg-indigo-600 text-white rounded-2xl rounded-tr-sm" 
                                : "bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-2xl rounded-tl-sm"
                            )}>
                                {msg.content}
                            </div>
                            
                            {/* Timestamp (Reveals on Group Hover) */}
                            <span className={cn(
                                "text-[10px] text-neutral-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-4 min-w-[60px]",
                                isMe ? "right-0 text-right" : "left-0 text-left"
                            )}>
                                {formatMessageDate(msg.created_at)}
                            </span>
                        </div>
                    </div>
                )
            })
        )}
        <div ref={scrollRef} />
      </div>

      {/* INPUT AREA */}
      <div className="p-4 bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 shrink-0">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto relative flex items-center gap-2">
            <input 
                type="text" 
                placeholder={`Message ${profile?.full_name || '...'}`}
                className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 transition-all"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
            />
            <button 
                type="submit"
                disabled={!newMessage.trim() || isSending}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:scale-95 text-white p-3 rounded-xl transition-all shadow-sm"
            >
                {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
        </form>
      </div>
    </div>
  )
}