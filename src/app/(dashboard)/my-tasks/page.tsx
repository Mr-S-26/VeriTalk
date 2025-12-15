'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  CheckCircle, Clock, FileText, Send, AlertCircle, 
  RefreshCw, Check, Briefcase, ExternalLink, X, Play
} from 'lucide-react'
import { cn } from '@/lib/utils'

// --- Interfaces ---

interface Task {
  id: string
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'submitted' | 'approved' | 'rejected'
  priority: 'low' | 'medium' | 'high'
  proof_link?: string
  client_feedback?: string
  created_at: string
}

// --- Components ---

const TaskSkeleton = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="h-48 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col justify-between">
        <div className="space-y-3">
          <div className="h-4 w-1/4 bg-neutral-200 dark:bg-neutral-800 rounded" />
          <div className="h-6 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded" />
        </div>
        <div className="h-10 w-full bg-neutral-100 dark:bg-neutral-800 rounded mt-4" />
      </div>
    ))}
  </div>
)

const StatusBadge = ({ status }: { status: string }) => {
    const styles = {
        todo: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700",
        in_progress: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
        submitted: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
        approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
        rejected: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800"
    }

    const icons = {
        todo: Briefcase,
        in_progress: Clock,
        submitted: Send,
        approved: Check,
        rejected: AlertCircle
    }

    // @ts-expect-error - dynamic key
    const Icon = icons[status] || Briefcase
    
    return (
        <span className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border",
            // @ts-expect-error - dynamic key
            styles[status] || styles.todo
        )}>
            <Icon className="w-3 h-3" />
            <span>{status.replace('_', ' ')}</span>
        </span>
    )
}

// --- Main Page ---

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [submittingId, setSubmittingId] = useState<string | null>(null) 
  const [proofLink, setProofLink] = useState('')
  
  const supabase = createClient()

  // FIX 1: Separated data fetching (pure async) from state setting
  // This satisfies the "setState in Effect" rule by not passing a state-setter function as a dependency
  const getTasksFromSupabase = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', user.id)
      .order('created_at', { ascending: false })
    
    return (data as Task[]) || []
  }, [supabase])

  // FIX 2: Effect now handles the state update locally
  useEffect(() => {
    let isMounted = true
    
    const init = async () => {
        const data = await getTasksFromSupabase()
        if (isMounted) {
            setTasks(data)
            setLoading(false)
        }
    }
    init()
    
    return () => { isMounted = false }
  }, [getTasksFromSupabase])

  // Helper for manual refreshes (buttons)
  const refreshTasks = async () => {
      const data = await getTasksFromSupabase()
      setTasks(data)
  }

  // --- Actions ---

  const handleStart = async (taskId: string) => {
    await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', taskId)
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'in_progress' } : t))
  }

  const handleSubmit = async (taskId: string) => {
    if (!proofLink.trim()) return

    await supabase
      .from('tasks')
      .update({ 
        status: 'submitted',
        proof_link: proofLink 
      })
      .eq('id', taskId)
    
    setProofLink('')
    setSubmittingId(null)
    refreshTasks() // Use the new helper
  }

  // --- Render ---

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto w-full space-y-8">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">My Tasks</h1>
        <p className="text-neutral-500 dark:text-neutral-400">Manage your assignments and submit deliverables.</p>
      </div>

      {loading ? (
        <TaskSkeleton />
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="w-16 h-16 bg-white dark:bg-neutral-800 rounded-full flex items-center justify-center shadow-sm mb-4">
             <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">All caught up!</h3>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm max-w-xs text-center mt-1">
            You have no pending tasks. Enjoy your free time or ask your manager for more work.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {tasks.map((task) => {
             const isRejected = task.status === 'rejected'
             const isSubmitting = submittingId === task.id

             return (
                <div 
                    key={task.id} 
                    className={cn(
                        "bg-white dark:bg-neutral-900 rounded-xl border shadow-sm transition-all duration-300 flex flex-col",
                        isRejected 
                            ? "border-rose-200 dark:border-rose-900/50 ring-1 ring-rose-100 dark:ring-rose-900/20" 
                            : task.status === 'in_progress'
                            ? "border-indigo-200 dark:border-indigo-900/50"
                            : "border-neutral-200 dark:border-neutral-800"
                    )}
                >
                  
                  {/* Card Content */}
                  <div className="p-5 flex-1 space-y-4">
                    
                    {/* Top Row: Priority & Status */}
                    <div className="flex items-center justify-between">
                        <span className={cn(
                            "text-[10px] uppercase font-bold px-2 py-0.5 rounded border",
                            task.priority === 'high' ? "text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-900/50" :
                            task.priority === 'medium' ? "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/50" :
                            "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/50"
                        )}>
                            {task.priority} Priority
                        </span>
                        <StatusBadge status={task.status} />
                    </div>

                    {/* Title */}
                    <div>
                        <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
                            {task.title}
                        </h3>
                        <p className="text-xs text-neutral-400 mt-1">
                            Assigned {new Date(task.created_at).toLocaleDateString()}
                        </p>
                    </div>

                    {/* Feedback Alert (Only if Rejected) */}
                    {isRejected && task.client_feedback && (
                        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 rounded-lg p-3 flex gap-3 text-sm">
                            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                            <div className="space-y-1">
                                <p className="font-bold text-rose-700 dark:text-rose-300">Correction Required</p>
                                {/* FIX 3: Escaped quotes below to &quot; */}
                                <p className="text-rose-600 dark:text-rose-400 text-xs leading-relaxed">
                                    &quot;{task.client_feedback}&quot;
                                </p>
                            </div>
                        </div>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="p-4 bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-100 dark:border-neutral-800 rounded-b-xl">
                     
                     {/* CASE 1: Start Button */}
                     {task.status === 'todo' && (
                        <button 
                            onClick={() => handleStart(task.id)}
                            className="w-full flex items-center justify-center gap-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-indigo-300 dark:hover:border-indigo-700 text-neutral-700 dark:text-neutral-200 py-2.5 rounded-lg text-sm font-medium transition-all group"
                        >
                            <Play className="w-4 h-4 text-neutral-400 group-hover:text-indigo-500 transition-colors" />
                            Start Working
                        </button>
                     )}

                     {/* CASE 2: Submit / Resubmit Form */}
                     {(task.status === 'in_progress' || isRejected) && (
                        !isSubmitting ? (
                            <button 
                                onClick={() => setSubmittingId(task.id)}
                                className={cn(
                                    "w-full flex items-center justify-center gap-2 text-white py-2.5 rounded-lg text-sm font-bold shadow-sm transition-all hover:scale-[1.02]",
                                    isRejected ? "bg-rose-600 hover:bg-rose-700" : "bg-indigo-600 hover:bg-indigo-700"
                                )}
                            >
                                {isRejected ? <RefreshCw className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                                {isRejected ? "Submit Fix" : "Submit Work"}
                            </button>
                        ) : (
                            <div className="flex gap-2 animate-in fade-in slide-in-from-bottom-2">
                                <input 
                                    type="text" 
                                    autoFocus
                                    placeholder="Paste work link (Google Docs, Figma...)" 
                                    className="flex-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    value={proofLink}
                                    onChange={(e) => setProofLink(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit(task.id)}
                                />
                                <button 
                                    onClick={() => handleSubmit(task.id)}
                                    disabled={!proofLink}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Check className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => { setSubmittingId(null); setProofLink('') }}
                                    className="bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 text-neutral-600 dark:text-neutral-300 px-3 rounded-lg"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )
                     )}

                     {/* CASE 3: View Submission (Read Only) */}
                     {(task.status === 'submitted' || task.status === 'approved') && task.proof_link && (
                        <a 
                            href={task.proof_link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline py-2"
                        >
                            <ExternalLink className="w-4 h-4" />
                            View Submitted Work
                        </a>
                     )}

                  </div>
                </div>
             )
          })}
        </div>
      )}
    </div>
  )
}