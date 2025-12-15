'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Plus, Trash2, UserPlus, Copy, Check, X, 
  ExternalLink, User, MoreHorizontal, Filter, Search,
  Briefcase
} from 'lucide-react'
import { cn } from '@/lib/utils'

// --- Interfaces ---
interface Task {
  id: string
  title: string
  status: string // 'todo', 'in_progress', 'submitted', 'approved', 'rejected'
  priority: 'low' | 'medium' | 'high'
  assigned_to: string | null
  created_at: string
  workspace_id: string
  proof_link?: string 
  client_feedback?: string
}

interface Profile {
  full_name: string
  avatar_url: string | null
  role: string | null
}

interface WorkspaceMemberDB {
  user_id: string
  profiles: Profile | null 
}

interface Employee {
  user_id: string
  full_name: string
  avatar_url: string | null
  role: string
  tasks: Task[]
}

// --- Helper Components ---
const PriorityBadge = ({ priority, onChange }: { priority: string, onChange: (val: string) => void }) => {
    const colors = {
        high: "text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-900/50",
        medium: "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/50",
        low: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/50"
    }

    return (
        <select 
            value={priority}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
                "text-[10px] uppercase font-bold px-2 py-0.5 rounded border outline-none cursor-pointer transition-colors appearance-none text-center min-w-[60px]",
                // @ts-expect-error - dynamic key access
                colors[priority] || colors.low
            )}
        >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
        </select>
    )
}

const EmptyState = () => (
    <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50/50 dark:bg-neutral-900/50">
        <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mb-4">
            <UserPlus className="w-6 h-6 text-indigo-500" />
        </div>
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">No employees found</h3>
        <p className="text-sm text-neutral-500 max-w-xs mt-1">
            Invite your team members to this workspace to start assigning tasks.
        </p>
    </div>
)

// --- Main Page ---

export default function ManageEmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [newTask, setNewTask] = useState<{ [key: string]: string }>({}) 
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [copied, setCopied] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const supabase = createClient()

  // --- Fetch Data ---
  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 1. Get Workspace Context
      const { data: workspaceData } = await supabase
        .from('workspaces')
        .select('id, invite_code')
        .eq('owner_id', user.id)
        .maybeSingle()
      
      let wsId = workspaceData?.id
      const code = workspaceData?.invite_code

      // Fallback: If not owner, check membership (unlikely for this page, but safe)
      if (!workspaceData) {
          const { data: memberData } = await supabase
              .from('workspace_members')
              .select('workspace_id')
              .eq('user_id', user.id)
              .maybeSingle()
          
          if (memberData) wsId = memberData.workspace_id
      } else {
         setInviteCode(code || null)
      }
      
      if (!wsId) {
        setLoading(false)
        return
      }

      // 2. Fetch Members & Profiles
      const { data: membersData } = await supabase
        .from('workspace_members')
        .select(`
            user_id, 
            profiles:user_id ( full_name, avatar_url, role )
        `)
        .eq('workspace_id', wsId)

      const members = membersData as unknown as WorkspaceMemberDB[]

      if (members) {
        // 3. Fetch Tasks
        const { data: tasksData } = await supabase
          .from('tasks')
          .select('*')
          .eq('workspace_id', wsId)
          .order('created_at', { ascending: false })

        const tasks = (tasksData || []) as Task[]

        const formatted: Employee[] = members.map((m) => ({
          user_id: m.user_id,
          full_name: m.profiles?.full_name || 'Unknown User',
          avatar_url: m.profiles?.avatar_url || null,
          role: m.profiles?.role || 'Team Member', // Fallback role
          tasks: tasks.filter((t) => t.assigned_to === m.user_id)
        }))

        // Optional: Filter out myself (the owner) from the "Employee" list if desired
        // setEmployees(formatted.filter(e => e.user_id !== user.id))
        setEmployees(formatted)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // --- Handlers ---
  const handleAddTask = async (userId: string) => {
    const title = newTask[userId]
    if (!title?.trim()) return

    const { data: { user } } = await supabase.auth.getUser()
    const { data: ws } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user?.id).single()

    if (ws) {
      await supabase.from('tasks').insert({
        workspace_id: ws.workspace_id,
        assigned_to: userId,
        created_by: user?.id,
        title: title,
        priority: 'medium',
        status: 'todo'
      })
      setNewTask({ ...newTask, [userId]: '' })
      fetchData()
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (confirm('Delete this task?')) {
      await supabase.from('tasks').delete().eq('id', taskId)
      fetchData()
    }
  }

  const handlePriority = async (taskId: string, newPriority: string) => {
    await supabase.from('tasks').update({ priority: newPriority }).eq('id', taskId)
    fetchData()
  }

  const handleReview = async (taskId: string, status: 'approved' | 'rejected') => {
    let feedback = null
    if (status === 'rejected') {
        feedback = prompt("Reason for rejection? (Optional)")
    }

    await supabase
        .from('tasks')
        .update({ status, client_feedback: feedback })
        .eq('id', taskId)
    
    fetchData()
  }

  const copyCode = () => {
    if (inviteCode) {
        navigator.clipboard.writeText(inviteCode)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }
  }

  // --- Filtering ---
  const filteredEmployees = employees.filter(e => 
    e.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    e.role.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
      return (
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse max-w-7xl mx-auto">
              {[1,2,3].map(i => <div key={i} className="h-96 bg-neutral-100 dark:bg-neutral-800 rounded-xl" />)}
          </div>
      )
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">Manage Employees</h1>
          <p className="text-neutral-500 dark:text-neutral-400">Assign tasks and track performance.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
             {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
                <input 
                    type="text" 
                    placeholder="Search staff..." 
                    className="pl-9 pr-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full sm:w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Invite Button / Popover */}
            <div className="relative">
                {!showInvite ? (
                    <button 
                        onClick={() => setShowInvite(true)}
                        className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition shadow-sm text-sm font-medium w-full sm:w-auto"
                    >
                        <UserPlus className="w-4 h-4" />
                        Invite Staff
                    </button>
                ) : (
                    <div className="flex items-center gap-2 bg-white dark:bg-neutral-800 border border-indigo-200 dark:border-indigo-900 p-1.5 pl-3 rounded-lg shadow-lg animate-in fade-in slide-in-from-top-2 absolute right-0 top-0 z-10 w-full sm:w-auto min-w-[280px]">
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Code:</span>
                        <code className="text-base font-mono font-bold text-neutral-800 dark:text-neutral-200 tracking-widest flex-1 text-center">
                            {inviteCode || '...'}
                        </code>
                        <div className="flex border-l border-neutral-200 dark:border-neutral-700 pl-1">
                            <button onClick={copyCode} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-neutral-500 transition-colors" title="Copy Code">
                                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                            </button>
                            <button onClick={() => setShowInvite(false)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-neutral-400 hover:text-red-500 transition-colors" title="Close">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Grid Content */}
      {filteredEmployees.length === 0 ? (
          <EmptyState />
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEmployees.map((emp) => (
              <div key={emp.user_id} className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col h-[500px] shadow-sm hover:shadow-md transition-shadow">
                
                {/* Employee Header */}
                <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0">
                        {emp.avatar_url ? (
                            <img src={emp.avatar_url} alt={emp.full_name} className="h-full w-full rounded-full object-cover shadow-sm" />
                        ) : (
                            <div className="h-full w-full bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-800/50">
                                {emp.full_name.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm leading-tight">{emp.full_name}</h3>
                      <div className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                          <Briefcase className="w-3 h-3" />
                          <span>{emp.role}</span>
                      </div>
                    </div>
                  </div>
                  <button className="text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>

                {/* Tasks List (Scrollable) */}
                <div className="flex-1 p-4 space-y-3 overflow-y-auto custom-scrollbar bg-neutral-50/30 dark:bg-neutral-900">
                  {emp.tasks.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-neutral-400 space-y-2 opacity-60">
                        <Check className="w-8 h-8 stroke-1" />
                        <span className="text-xs">All caught up!</span>
                    </div>
                  ) : (
                    emp.tasks.map(task => (
                      <div key={task.id} className={cn(
                          "group bg-white dark:bg-neutral-800 border rounded-lg p-3 shadow-sm transition-all",
                          task.status === 'submitted' 
                            ? "border-amber-200 ring-1 ring-amber-100 dark:border-amber-900/50 dark:ring-amber-900/20" 
                            : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600"
                      )}>
                        
                        {/* Title & Actions */}
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200 leading-snug line-clamp-2">
                              {task.title}
                          </span>
                          <button onClick={() => handleDeleteTask(task.id)} className="text-neutral-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        
                        {/* Controls Row */}
                        <div className="flex items-center justify-between mt-3">
                          <PriorityBadge priority={task.priority} onChange={(val) => handlePriority(task.id, val)} />
                          
                          <span className={cn(
                              "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border",
                              task.status === 'approved' ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/50" :
                              task.status === 'rejected' ? "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-900/50" :
                              task.status === 'submitted' ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/50" :
                              "bg-neutral-100 text-neutral-500 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700"
                          )}>
                            {task.status.replace('_', ' ')}
                          </span>
                        </div>

                        {/* Review Actions (Only if submitted or has link) */}
                        {(task.proof_link || task.status === 'submitted') && (
                            <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-700/50">
                                {task.proof_link && (
                                    <a href={task.proof_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline mb-3">
                                        <ExternalLink className="w-3 h-3" /> 
                                        <span className="truncate max-w-[150px]">View Submission</span>
                                    </a>
                                )}
                                
                                {task.status === 'submitted' && (
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleReview(task.id, 'approved')}
                                            className="flex-1 bg-emerald-600 text-white text-xs font-medium py-1.5 rounded hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1"
                                        >
                                            <Check className="w-3 h-3" /> Approve
                                        </button>
                                        <button 
                                            onClick={() => handleReview(task.id, 'rejected')}
                                            className="flex-1 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-medium py-1.5 rounded hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors flex items-center justify-center gap-1"
                                        >
                                            <X className="w-3 h-3" /> Reject
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Footer Input */}
                <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                  <div className="flex gap-2 relative">
                    <input
                      type="text"
                      placeholder="Assign new task..."
                      className="flex-1 text-sm pl-3 pr-8 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400"
                      value={newTask[emp.user_id] || ''}
                      onChange={(e) => setNewTask({ ...newTask, [emp.user_id]: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTask(emp.user_id)}
                    />
                    <button 
                        onClick={() => handleAddTask(emp.user_id)} 
                        disabled={!newTask[emp.user_id]} 
                        className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
      )}
    </div>
  )
}