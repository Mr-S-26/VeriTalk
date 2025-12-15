'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js' 
import { Send, Hash, Loader2, MoreVertical, Phone, Video } from 'lucide-react'
import { cn } from '@/lib/utils'

// --- Types ---

interface Profile {
  full_name: string
  avatar_url: string
}

interface Message {
  id: string
  content: string
  user_id: string
  created_at: string
  profiles: Profile | null 
}

interface RealtimeMessage {
  id: string
  content: string
  user_id: string
  created_at: string
  channel_id: string
}

// --- Components ---

const MessageSkeleton = () => (
  <div className="space-y-4 p-4">
    {[1, 2, 3].map((i) => (
      <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
        <div className={`h-10 w-1/3 rounded-2xl ${i % 2 === 0 ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'bg-neutral-100 dark:bg-neutral-800'}`} />
      </div>
    ))}
  </div>
)

const ChannelHeader = ({ name }: { name: string }) => (
  <div className="h-16 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between px-6 bg-white dark:bg-neutral-900 shrink-0 z-10">
    <div className="flex items-center gap-2 font-bold text-lg text-neutral-800 dark:text-neutral-100">
      <Hash className="w-5 h-5 text-neutral-400" />
      {name}
    </div>
    <div className="flex items-center gap-4 text-neutral-400">
        <button className="hover:text-indigo-600 transition-colors"><Phone className="w-5 h-5" /></button>
        <button className="hover:text-indigo-600 transition-colors"><Video className="w-5 h-5" /></button>
        <button className="hover:text-indigo-600 transition-colors"><MoreVertical className="w-5 h-5" /></button>
    </div>
  </div>
)

const EmptyState = ({ channelName }: { channelName: string }) => (
  <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 p-8 text-center">
    <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-4">
      <Hash className="w-8 h-8 text-neutral-300" />
    </div>
    <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-1">Welcome to #{channelName}!</h3>
    <p className="text-sm max-w-xs">This is the start of the <span className="font-semibold text-indigo-500">#{channelName}</span> channel. Send a message to start the conversation.</p>
  </div>
)

// --- Main Page ---

export default function ChannelPage() {
  const { channelId } = useParams()
  const supabase = createClient()
  
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [channelName, setChannelName] = useState('Loading...')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // 1. Initialize Data
  useEffect(() => {
    const initData = async () => {
      setIsLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      if (!channelId) return

      // Fetch Channel Details
      const { data: channelData } = await supabase
        .from('channels')
        .select('name')
        .eq('id', channelId)
        .single()
      
      if (channelData) setChannelName(channelData.name)

      // Fetch Messages
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id, content, user_id, created_at,
          profiles ( full_name, avatar_url )
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })

      if (error) console.error('Error fetching messages:', error)
      else if (data) setMessages(data as unknown as Message[])
      
      setIsLoading(false)
    }

    initData()
  }, [channelId, supabase])

  // 2. Realtime Subscription
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          const newRecord = payload.new as RealtimeMessage

          // Fetch sender profile immediately
          const { data: userData } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', newRecord.user_id)
            .single()

          const newMsg: Message = {
            id: newRecord.id,
            content: newRecord.content,
            user_id: newRecord.user_id,
            created_at: newRecord.created_at,
            profiles: userData ? (userData as Profile) : { full_name: 'Unknown', avatar_url: '' },
          }

          setMessages((current) => [...current, newMsg])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [channelId, supabase])

  // 3. Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !currentUser) return

    setIsSending(true)
    const messageToSend = newMessage
    setNewMessage('') // Optimistic clear

    const { error } = await supabase
      .from('messages')
      .insert({
        channel_id: channelId,
        user_id: currentUser.id,
        content: messageToSend
      })

    if (error) {
      console.error('Error sending message:', error)
      setNewMessage(messageToSend) // Restore if failed
    }
    setIsSending(false)
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-950 relative">
      
      {/* Header */}
      <ChannelHeader name={channelName} />

      {/* Messages Area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-white dark:bg-neutral-950 custom-scrollbar"
      >
        {isLoading ? (
          <MessageSkeleton />
        ) : messages.length === 0 ? (
          <EmptyState channelName={channelName} />
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.user_id === currentUser?.id
            const isSequence = index > 0 && messages[index - 1].user_id === msg.user_id
            
            return (
              <div 
                key={msg.id} 
                className={cn(
                  "flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
                  isMe ? "justify-end" : "justify-start"
                )}
              >
                <div className={cn(
                  "flex max-w-[85%] sm:max-w-[70%] gap-3",
                  isMe ? "flex-row-reverse" : "flex-row"
                )}>
                  
                  {/* Avatar (Only show for others, and only if not sequential) */}
                  {!isMe && (
                    <div className="w-8 h-8 shrink-0 flex flex-col justify-end">
                      {!isSequence ? (
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800">
                          {msg.profiles?.avatar_url ? (
                            <img src={msg.profiles.avatar_url} alt="User" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-neutral-500">
                                {msg.profiles?.full_name?.substring(0,2).toUpperCase() || "??"}
                            </div>
                          )}
                        </div>
                      ) : <div className="w-8" />}
                    </div>
                  )}

                  <div className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                    
                    {/* Name (Only if not me and not sequential) */}
                    {!isMe && !isSequence && (
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-1 mb-1">
                        {msg.profiles?.full_name || 'Unknown'}
                      </span>
                    )}

                    {/* Bubble */}
                    <div className={cn(
                      "px-4 py-2 shadow-sm text-sm break-words relative group",
                      isMe 
                        ? "bg-indigo-600 text-white rounded-2xl rounded-tr-sm" 
                        : "bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-2xl rounded-tl-sm"
                    )}>
                      {msg.content}
                      
                      {/* Timestamp tooltip on hover */}
                      <div className={cn(
                        "absolute -bottom-5 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-neutral-400 whitespace-nowrap",
                        isMe ? "right-0" : "left-0"
                      )}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 shrink-0">
        <form onSubmit={sendMessage} className="max-w-4xl mx-auto relative flex items-center gap-2">
          <input
            className="flex-1 p-3 pr-12 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            placeholder={`Message #${channelName}...`}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
          <button 
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className="absolute right-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-0 disabled:scale-90"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  )
}