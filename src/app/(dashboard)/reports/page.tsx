'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Clock, Calendar, Download, TrendingUp, 
  History, FileText, ArrowRight, type LucideIcon 
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// --- Interfaces ---

interface TimeLog {
  id: string
  start_time: string
  end_time: string
  duration_seconds: number
  created_at: string
}

// --- Components ---

// FIX: Replaced 'any' with 'LucideIcon'
const StatCard = ({ label, value, icon: Icon, subtext }: { label: string, value: string, icon: LucideIcon, subtext?: string }) => (
  <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 rounded-xl shadow-sm flex items-start justify-between">
    <div>
      <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">{label}</p>
      <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">{value}</h3>
      {subtext && <p className="text-xs text-neutral-400 mt-2">{subtext}</p>}
    </div>
    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
      <Icon className="w-5 h-5" />
    </div>
  </div>
)

const ReportsSkeleton = () => (
  <div className="space-y-8 animate-pulse">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-32 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800" />
      ))}
    </div>
    <div className="h-96 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800" />
  </div>
)

// --- Helper: Format Seconds ---
const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    
    if (h > 0) return `${h}h ${m}m`
    return `${m}m ${seconds % 60}s`
}

// --- Helper: Format Date Smartly ---
const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === now.toDateString()) return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

// --- Main Page ---

export default function ReportsPage() {
  const [logs, setLogs] = useState<TimeLog[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchLogs = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('time_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: false }) // Sort by start time

      if (error) {
        console.error('Error fetching logs:', error)
      } else if (data) {
        setLogs(data as unknown as TimeLog[])
      }
      setLoading(false)
    }

    fetchLogs()
  }, [supabase])

  // --- Derived Statistics ---
  const stats = useMemo(() => {
    const totalSeconds = logs.reduce((acc, log) => acc + log.duration_seconds, 0)
    const totalSessions = logs.length
    const avgSeconds = totalSessions > 0 ? totalSeconds / totalSessions : 0

    return {
        totalTime: formatDuration(totalSeconds),
        count: totalSessions,
        avgSession: formatDuration(Math.round(avgSeconds))
    }
  }, [logs])

  const handleExport = () => {
    alert("Export feature would generate a CSV here.")
  }

  if (loading) {
    return <div className="p-8 max-w-6xl mx-auto"><ReportsSkeleton /></div>
  }

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto w-full space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">My Timesheets</h1>
          <p className="text-neutral-500 dark:text-neutral-400">Track your productivity and work history.</p>
        </div>
        <button 
          onClick={handleExport}
          className="flex items-center gap-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
            label="Total Hours Tracked" 
            value={stats.totalTime} 
            icon={History} 
            subtext="All time aggregate"
        />
        <StatCard 
            label="Total Sessions" 
            value={stats.count.toString()} 
            icon={FileText} 
        />
        <StatCard 
            label="Avg. Session Length" 
            value={stats.avgSession} 
            icon={TrendingUp} 
            subtext="Based on completed logs"
        />
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden">
        
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
             <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-4">
                <Clock className="w-8 h-8 text-neutral-400" />
             </div>
             <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">No logs found</h3>
             <p className="text-neutral-500 max-w-sm mt-1 mb-6">
               It looks like you haven&apos;t tracked any time yet. Start the timer to generate your first report.
             </p>
             <Link href="/timer" className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium">
                Go to Time Tracker <ArrowRight className="w-4 h-4" />
             </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-neutral-50/50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
                  <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Time Window</th>
                  <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {logs.map((log) => (
                  <tr key={log.id} className="group hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                           <Calendar className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {formatDate(log.start_time)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-neutral-600 dark:text-neutral-400 flex flex-col">
                         <span>
                            {new Date(log.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            <span className="mx-1.5 text-neutral-300">-</span>
                            {new Date(log.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                         </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                        {formatDuration(log.duration_seconds)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                       <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Logged
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