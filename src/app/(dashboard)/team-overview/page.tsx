'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { 
  Monitor, Coffee, Phone, UserX, MessageSquare, 
  Video, MoreHorizontal, Search, Filter 
} from 'lucide-react'
import { cn } from '@/lib/utils'

// --- Types ---

type UserStatus = 'online' | 'working' | 'idle' | 'in-call' | 'offline'

interface Member {
  id: string
  full_name: string
  avatar_url: string | null
  current_status: UserStatus
  role?: string // Placeholder if you add roles later
}

// --- Components ---

const StatusBadge = ({ status }: { status: UserStatus }) => {
  const styles = {
    working: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
    idle: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
    'in-call': "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20",
    offline: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700",
    online: "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400 border-sky-200 dark:border-sky-500/20"
  }

  const icons = {
    working: Monitor,
    idle: Coffee,
    'in-call': Phone,
    offline: UserX,
    online: Monitor
  }

  const Icon = icons[status] || UserX

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
      styles[status] || styles.offline
    )}>
      <Icon className="w-3 h-3" />
      <span className="capitalize">{status.replace('-', ' ')}</span>
    </span>
  )
}

const OverviewSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-pulse">
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <div key={i} className="h-40 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-neutral-200 dark:bg-neutral-800" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-1/2 bg-neutral-200 dark:bg-neutral-800 rounded" />
            <div className="h-3 w-1/3 bg-neutral-200 dark:bg-neutral-800 rounded" />
          </div>
        </div>
        <div className="h-8 w-full bg-neutral-100 dark:bg-neutral-800 rounded mt-4" />
      </div>
    ))}
  </div>
)

// --- Main Page ---

export default function TeamOverviewPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  
  const supabase = createClient()
  const router = useRouter()

  // 1. Computed Stats
  const stats = useMemo(() => {
    return {
      total: members.length,
      working: members.filter(m => m.current_status === 'working').length,
      idle: members.filter(m => m.current_status === 'idle').length,
      inCall: members.filter(m => m.current_status === 'in-call').length
    }
  }, [members])

  // 2. Data Fetching
  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // A. Get Workspace
      let workspaceId: string | undefined

      const { data: ownedWorkspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()
      
      workspaceId = ownedWorkspace?.id

      if (!workspaceId) {
         const { data: memberWorkspace } = await supabase
           .from('workspace_members')
           .select('workspace_id')
           .eq('user_id', user.id)
           .maybeSingle()
         workspaceId = memberWorkspace?.workspace_id
      }

      if (!workspaceId) {
        setLoading(false)
        return
      }

      // B. Fetch Members
      const { data: memberData } = await supabase
        .from('workspace_members')
        .select(`
          user_id,
          profiles:user_id ( id, full_name, avatar_url, current_status )
        `)
        .eq('workspace_id', workspaceId)

      if (memberData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const formatted: Member[] = (memberData as any[]).map((m) => ({
          id: m.user_id,
          full_name: m.profiles?.full_name || 'Unknown User',
          avatar_url: m.profiles?.avatar_url || null,
          current_status: m.profiles?.current_status || 'offline'
        }))
        
        // Filter out myself from the view? Optional.
        // setMembers(formatted.filter(m => m.id !== user.id))
        setMembers(formatted)
      }
    } catch (error) {
      console.error('Error fetching team:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // 3. Realtime Subscription
  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel('team-overview-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          setMembers((current) =>
            current.map((member) =>
              member.id === payload.new.id
                ? { 
                    ...member, 
                    current_status: payload.new.current_status,
                    avatar_url: payload.new.avatar_url || member.avatar_url,
                    full_name: payload.new.full_name || member.full_name
                  }
                : member
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchData, supabase])

  // 4. Filtering
  const filteredMembers = members.filter(m => 
    m.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
      
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
            Team Overview
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Real-time insights into your team&apos;s activity.
          </p>
        </div>

        {/* Quick Stats Cards */}
        <div className="flex gap-3">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-4 py-2 rounded-lg shadow-sm">
             <span className="block text-xs text-neutral-500 uppercase font-bold tracking-wider">Active</span>
             <span className="text-lg font-bold text-emerald-600">{stats.working}</span>
          </div>
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-4 py-2 rounded-lg shadow-sm">
             <span className="block text-xs text-neutral-500 uppercase font-bold tracking-wider">Idle</span>
             <span className="text-lg font-bold text-amber-500">{stats.idle}</span>
          </div>
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-4 py-2 rounded-lg shadow-sm">
             <span className="block text-xs text-neutral-500 uppercase font-bold tracking-wider">Total</span>
             <span className="text-lg font-bold text-neutral-900 dark:text-neutral-50">{stats.total}</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
           <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
           <input 
             type="text" 
             placeholder="Search team members..." 
             className="w-full pl-9 pr-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
           />
        </div>
        <button className="p-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-500 hover:text-indigo-600 transition-colors">
           <Filter className="w-4 h-4" />
        </button>
      </div>

      {/* Grid Content */}
      {loading ? (
        <OverviewSkeleton />
      ) : filteredMembers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
           <UserX className="w-12 h-12 mb-4 opacity-50" />
           <p>No team members found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredMembers.map((member) => (
            <div 
              key={member.id} 
              onClick={() => router.push(`/messages/${member.id}`)}
              className="group relative bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 hover:shadow-md hover:border-indigo-500/30 transition-all duration-300 cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                   {/* Avatar */}
                   <div className="relative">
                      <div className="h-12 w-12 rounded-full overflow-hidden bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                        {member.avatar_url ? (
                            <img src={member.avatar_url} alt={member.full_name} className="h-full w-full object-cover" />
                        ) : (
                            <div className="h-full w-full flex items-center justify-center font-bold text-neutral-400 bg-neutral-100 dark:bg-neutral-800">
                                {member.full_name.charAt(0).toUpperCase()}
                            </div>
                        )}
                      </div>
                      {/* Status Dot (Absolute) */}
                      <span className={cn(
                        "absolute bottom-0 right-0 block h-3.5 w-3.5 rounded-full ring-2 ring-white dark:ring-neutral-900",
                        member.current_status === 'working' ? 'bg-emerald-500' :
                        member.current_status === 'idle' ? 'bg-amber-500' :
                        member.current_status === 'in-call' ? 'bg-indigo-500' : 'bg-neutral-300 dark:bg-neutral-600'
                      )} />
                   </div>
                   
                   <div>
                     <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-indigo-600 transition-colors">
                       {member.full_name}
                     </h3>
                     <p className="text-xs text-neutral-500 dark:text-neutral-400">Full Stack Developer</p>
                   </div>
                </div>

                <button className="text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors">
                   <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>

              {/* Status Pill */}
              <div className="mb-6">
                <StatusBadge status={member.current_status} />
              </div>

              {/* Actions Footer */}
              <div className="flex items-center gap-2 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                 <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 transition-colors">
                    <MessageSquare className="w-4 h-4" /> Message
                 </button>
                 <button className="flex items-center justify-center p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 transition-colors">
                    <Video className="w-4 h-4" />
                 </button>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  )
}