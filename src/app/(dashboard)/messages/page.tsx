'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { MessageSquare, User, Search, Clock, Users, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// --- Interfaces ---

interface Contact {
  id: string
  full_name: string
  avatar_url: string | null
  role: string
  last_msg_time: string | null
  status?: 'online' | 'offline' // Optional if you add presence later
}

interface ProfileDB {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: string | null
}

interface WorkspaceMemberDB {
  user_id: string
  profiles: ProfileDB | null
}

// --- Components ---

const ContactSkeleton = () => (
  <div className="space-y-4">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900/50">
        <div className="w-12 h-12 rounded-full bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
        <div className="flex-1 space-y-2">
           <div className="h-4 w-1/3 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
           <div className="h-3 w-1/4 bg-neutral-100 dark:bg-neutral-800/50 rounded animate-pulse" />
        </div>
      </div>
    ))}
  </div>
)

// --- Helper: Time Formatter ---
const formatTime = (isoString: string | null) => {
    if (!isoString) return ''
    const date = new Date(isoString)
    const now = new Date()
    
    // If today
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
    }
    // If this week (simple check)
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24))
    if (diffDays < 7) {
        return date.toLocaleDateString(undefined, { weekday: 'short' })
    }
    // Else date
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// --- Main Page ---

export default function MessagesPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  
  const router = useRouter()
  const supabase = createClient()

  const fetchContacts = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 1. Get Workspace
      const { data: member } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!member) {
          setLoading(false)
          return
      }

      // 2. Get Workspace Members
      const { data: membersData } = await supabase
        .from('workspace_members')
        .select(`
          user_id,
          profiles:user_id ( id, full_name, avatar_url, role )
        `)
        .eq('workspace_id', member.workspace_id)
      
      if (membersData) {
        const rawMembers = membersData as unknown as WorkspaceMemberDB[]

        // 3. Fetch Last Message Time (Parallel)
        const contactsWithTime = await Promise.all(
          rawMembers
            .filter(m => m.user_id !== user.id)
            .map(async (m) => {
              const { data: lastMsg } = await supabase
                .from('direct_messages')
                .select('created_at')
                .or(`and(sender_id.eq.${user.id},receiver_id.eq.${m.user_id}),and(sender_id.eq.${m.user_id},receiver_id.eq.${user.id})`)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

              return {
                 id: m.user_id,
                 full_name: m.profiles?.full_name || 'Unknown',
                 avatar_url: m.profiles?.avatar_url || null,
                 role: m.profiles?.role || 'Team Member',
                 last_msg_time: lastMsg?.created_at || null
              }
            })
        )

        // Sort: Recent messages first, then alphabetical
        const sorted = contactsWithTime.sort((a, b) => {
            if (a.last_msg_time && b.last_msg_time) {
                return new Date(b.last_msg_time).getTime() - new Date(a.last_msg_time).getTime()
            }
            if (a.last_msg_time) return -1
            if (b.last_msg_time) return 1
            return a.full_name.localeCompare(b.full_name)
        })

        setContacts(sorted)
      }
    } catch (err) {
        console.error("Error loading contacts:", err)
    } finally {
        setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  // Filtering
  const filteredContacts = contacts.filter(c => 
    c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.role.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto w-full space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">Messages</h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Chat with your team members directly.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-72">
           <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
           <input 
             type="text" 
             placeholder="Search people..." 
             className="w-full pl-9 pr-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
           />
        </div>
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden min-h-[400px]">
        
        {/* List Header */}
        <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 flex items-center justify-between">
            <h2 className="font-semibold text-sm text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Team Members
                <span className="ml-1 px-2 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-700 text-[10px] text-neutral-600 dark:text-neutral-300">
                    {filteredContacts.length}
                </span>
            </h2>
        </div>

        {loading ? (
            <div className="p-6">
                <ContactSkeleton />
            </div>
        ) : filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-80 text-center p-8">
                <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-4">
                    <User className="w-8 h-8 text-neutral-400" />
                </div>
                <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">No contacts found</h3>
                <p className="text-neutral-500 max-w-xs mt-1">
                    {searchQuery ? "Try adjusting your search terms." : "Invite team members to start chatting."}
                </p>
            </div>
        ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filteredContacts.map(contact => (
                    <div 
                        key={contact.id}
                        onClick={() => router.push(`/messages/${contact.id}`)}
                        className="group p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer transition-all duration-200 flex items-center justify-between"
                    >
                        <div className="flex items-center gap-4">
                            
                            {/* Avatar */}
                            <div className="relative">
                                <div className="h-12 w-12 rounded-full overflow-hidden bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm">
                                    {contact.avatar_url ? (
                                        <img 
                                            src={contact.avatar_url} 
                                            alt={contact.full_name} 
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center text-neutral-400 font-bold bg-neutral-100 dark:bg-neutral-800">
                                            {contact.full_name.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                {/* Online Status Dot (Optional placeholder logic) */}
                                {/* <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-neutral-900 rounded-full"></div> */}
                            </div>

                            <div className="flex flex-col">
                                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-indigo-600 transition-colors">
                                    {contact.full_name}
                                </h3>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                                        {contact.role}
                                    </span>
                                    
                                    {contact.last_msg_time && (
                                        <span className="text-xs text-neutral-400 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {formatTime(contact.last_msg_time)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center text-neutral-300 dark:text-neutral-600 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-1 transition-all">
                            <ChevronRight className="w-5 h-5" />
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  )
}