'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Filter, User, Calendar, Download, Clock, 
  BarChart3, RefreshCcw, Search, type LucideIcon 
} from 'lucide-react'
import { cn } from '@/lib/utils'

// --- Interfaces ---

interface Profile {
  full_name: string
  avatar_url: string | null
}

interface TimeLog {
  id: string
  start_time: string
  end_time: string
  duration_seconds: number
  user_id: string
  profiles: Profile | null
}

interface Member {
  user_id: string
  profiles: Profile | null
}

// --- Components ---

const ReportsSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-28 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800" />
      ))}
    </div>
    <div className="h-96 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800" />
  </div>
)

// FIX 1: Use 'LucideIcon' type instead of 'any'
const StatCard = ({ label, value, subtext, icon: Icon, color }: { label: string, value: string, subtext?: string, icon: LucideIcon, color: string }) => (
  <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 rounded-xl shadow-sm flex items-start justify-between">
    <div>
      <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">{label}</p>
      <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">{value}</h3>
      {subtext && <p className="text-xs text-neutral-400 mt-1 truncate max-w-[150px]">{subtext}</p>}
    </div>
    <div className={cn("p-3 rounded-lg bg-opacity-10", color)}>
      <Icon className={cn("w-5 h-5", color.replace('bg-', 'text-'))} />
    </div>
  </div>
)

// --- Helper: Format Duration ---
const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
}

// --- Main Page ---

export default function TeamReportsPage() {
  const [logs, setLogs] = useState<TimeLog[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filters
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState('all')

  const supabase = createClient()

  // 1. Fetch Context (Members)
  useEffect(() => {
    const fetchMembers = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: ws } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()
      
      if (ws) {
        const { data } = await supabase
          .from('workspace_members')
          .select('user_id, profiles(full_name, avatar_url)')
          .eq('workspace_id', ws.id)
        
        if (data) setMembers(data as unknown as Member[])
      }
    }
    fetchMembers()
  }, [supabase])

  // FIX 2: Move logic INSIDE useEffect to prevent "Cascading Render" error
  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).maybeSingle()
        
        if (!ws) { 
            if (isMounted) setLoading(false)
            return 
        }

        let query = supabase
        .from('time_logs')
        .select(`*, profiles:user_id ( full_name, avatar_url )`)
        .eq('workspace_id', ws.id)
        .order('start_time', { ascending: false })

        if (selectedEmployee !== 'all') {
            query = query.eq('user_id', selectedEmployee)
        }
        if (dateFrom) {
            query = query.gte('start_time', new Date(dateFrom).toISOString())
        }
        if (dateTo) {
            const endDate = new Date(dateTo)
            endDate.setDate(endDate.getDate() + 1)
            query = query.lt('start_time', endDate.toISOString())
        }

        const { data, error } = await query
        
        if (isMounted) {
            if (error) console.error(error)
            if (data) setLogs(data as unknown as TimeLog[])
            setLoading(false)
        }
    }

    loadData()

    return () => { isMounted = false }
  }, [supabase, dateFrom, dateTo, selectedEmployee])

  // 3. Computed Stats
  const stats = useMemo(() => {
    const totalSeconds = logs.reduce((acc, log) => acc + log.duration_seconds, 0)
    const totalHours = (totalSeconds / 3600).toFixed(1)
    
    // Find top performer
    const userDurations: Record<string, number> = {}
    let topUser = { name: 'N/A', hours: 0 }
    
    logs.forEach(log => {
        const name = log.profiles?.full_name || 'Unknown'
        userDurations[name] = (userDurations[name] || 0) + log.duration_seconds
    })

    Object.entries(userDurations).forEach(([name, seconds]) => {
        const hours = seconds / 3600
        if (hours > topUser.hours) {
            topUser = { name, hours }
        }
    })

    return {
        totalHours,
        sessions: logs.length,
        topPerformer: topUser.hours > 0 ? topUser.name : 'No Data',
        topPerformerHours: topUser.hours > 0 ? `${topUser.hours.toFixed(1)} hrs` : ''
    }
  }, [logs])

  // --- Render ---

  if (loading && logs.length === 0) return <div className="p-8 max-w-7xl mx-auto"><ReportsSkeleton /></div>

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">Team Reports</h1>
          <p className="text-neutral-500 dark:text-neutral-400">Monitor employee hours and performance analytics.</p>
        </div>
        <button className="flex items-center gap-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
           <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
            label="Total Hours" 
            value={stats.totalHours} 
            icon={Clock} 
            color="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
            subtext="In selected period"
        />
        <StatCard 
            label="Top Performer" 
            value={stats.topPerformer} 
            subtext={stats.topPerformerHours}
            icon={BarChart3} 
            color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
        <StatCard 
            label="Total Sessions" 
            value={stats.sessions.toString()} 
            icon={Calendar} 
            color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
            subtext="Work blocks logged"
        />
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 flex flex-col md:flex-row gap-4 items-end md:items-center">
        
        {/* Date Range */}
        <div className="flex items-center gap-2 flex-1 w-full md:w-auto">
            <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-neutral-400"><Calendar className="w-4 h-4" /></span>
                <input 
                    type="date" 
                    className="w-full pl-9 pr-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-neutral-900 dark:text-neutral-100"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                />
            </div>
            <span className="text-neutral-400">-</span>
            <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-neutral-400"><Calendar className="w-4 h-4" /></span>
                <input 
                    type="date" 
                    className="w-full pl-9 pr-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-neutral-900 dark:text-neutral-100"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                />
            </div>
        </div>

        {/* User Select */}
        <div className="relative w-full md:w-64">
           <User className="absolute left-3 top-2.5 text-neutral-400 w-4 h-4" />
           <select 
              className="w-full pl-9 pr-8 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none text-neutral-900 dark:text-neutral-100 cursor-pointer"
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
           >
              <option value="all">All Employees</option>
              {members.map(m => (
                <option key={m.user_id} value={m.user_id}>
                  {m.profiles?.full_name || 'Unknown'}
                </option>
              ))}
           </select>
           <Search className="absolute right-3 top-2.5 text-neutral-400 w-4 h-4 pointer-events-none opacity-50" />
        </div>

        {/* Reset */}
        <button 
           onClick={() => { setDateFrom(''); setDateTo(''); setSelectedEmployee('all'); }}
           className="p-2 text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
           title="Reset Filters"
        >
           <RefreshCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden min-h-[400px]">
         {loading ? (
             <div className="p-12 text-center text-neutral-500">Updating records...</div>
         ) : logs.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-4">
                   <Filter className="w-8 h-8 text-neutral-400" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">No logs found</h3>
                <p className="text-neutral-500 max-w-sm mt-1">
                   Try adjusting your date range or selecting a different employee to see more results.
                </p>
             </div>
         ) : (
            <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="bg-neutral-50/50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
                        <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Employee</th>
                        <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Session</th>
                        <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-right">Duration</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                     {logs.map((log) => (
                        <tr key={log.id} className="group hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                           <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                 <div className="h-9 w-9 shrink-0">
                                    {log.profiles?.avatar_url ? (
                                       <img 
                                          src={log.profiles.avatar_url} 
                                          alt={log.profiles.full_name} 
                                          className="h-full w-full rounded-full object-cover border border-neutral-200 dark:border-neutral-700"
                                       />
                                    ) : (
                                       <div className="h-full w-full bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs border border-indigo-200 dark:border-indigo-800/50">
                                          {log.profiles?.full_name?.[0] || '?'}
                                       </div>
                                    )}
                                 </div>
                                 <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                    {log.profiles?.full_name || 'Unknown User'}
                                 </span>
                              </div>
                           </td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                              {new Date(log.start_time).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                           </td>
                           <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2 text-sm text-neutral-500 font-mono bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded w-fit">
                                 {new Date(log.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                 <span className="text-neutral-300">-</span>
                                 {new Date(log.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                           </td>
                           <td className="px-6 py-4 whitespace-nowrap text-right">
                              <span className={cn(
                                 "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold",
                                 log.duration_seconds > 14400 ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" : // >4h
                                 log.duration_seconds > 7200 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : // >2h
                                 "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                              )}>
                                 {formatDuration(log.duration_seconds)}
                              </span>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         )}
      </div>
    </div>
  )
}