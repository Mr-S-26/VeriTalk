'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { 
  Briefcase, User, CheckCircle2, 
  Loader2, ArrowRight, Command 
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function OnboardingPage() {
  const [loading, setLoading] = useState<string | null>(null) // 'client' | 'freelancer' | null
  const router = useRouter()
  const supabase = createClient()

  const handleSelect = async (selectedRole: 'client' | 'freelancer') => {
    setLoading(selectedRole)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // 1. Update Profile Role
        const { error } = await supabase
          .from('profiles')
          .update({ role: selectedRole })
          .eq('id', user.id)

        if (error) throw error

        // 2. Redirect based on role
        if (selectedRole === 'client') {
          router.push('/onboarding/create-workspace')
        } else {
          router.push('/onboarding/join-workspace')
        }
      }
    } catch (error) {
      console.error('Onboarding error:', error)
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-950 relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-3xl" />
          <div className="absolute top-[20%] -right-[10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      {/* Brand Header */}
      <div className="mb-12 text-center relative z-10 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex items-center justify-center gap-2 mb-6">
           <div className="bg-white dark:bg-neutral-900 p-2 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800">
              <Command className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
           </div>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 mb-3">
          Welcome to StaffSync
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
          To give you the best experience, we need to know how you plan to use the workspace.
        </p>
      </div>

      {/* Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
        
        {/* OPTION 1: CLIENT */}
        <button
          onClick={() => handleSelect('client')}
          disabled={!!loading}
          className={cn(
            "group relative flex flex-col items-start p-8 rounded-2xl border text-left transition-all duration-300",
            "bg-white dark:bg-neutral-900 hover:shadow-xl hover:-translate-y-1",
            loading === 'client' 
              ? "border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/10" 
              : "border-neutral-200 dark:border-neutral-800 hover:border-indigo-500/50 dark:hover:border-indigo-500/50"
          )}
        >
          <div className="mb-6 p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform duration-300">
            {loading === 'client' ? <Loader2 className="w-8 h-8 animate-spin" /> : <Briefcase className="w-8 h-8" />}
          </div>
          
          <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50 mb-2">
            Business Owner / Client
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-8 min-h-[40px]">
            I want to hire talent, manage projects, and track my team&apos;s performance.
          </p>

          <ul className="space-y-3 mb-8 w-full">
            {['Create Workspaces', 'Invite Employees', 'View Reports & Analytics'].map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
                <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-auto w-full flex items-center text-sm font-semibold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform">
             Select Client Profile <ArrowRight className="w-4 h-4 ml-2" />
          </div>
        </button>

        {/* OPTION 2: FREELANCER */}
        <button
          onClick={() => handleSelect('freelancer')}
          disabled={!!loading}
          className={cn(
            "group relative flex flex-col items-start p-8 rounded-2xl border text-left transition-all duration-300",
            "bg-white dark:bg-neutral-900 hover:shadow-xl hover:-translate-y-1",
            loading === 'freelancer' 
              ? "border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/10" 
              : "border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/50 dark:hover:border-emerald-500/50"
          )}
        >
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-300">
             {loading === 'freelancer' ? <Loader2 className="w-8 h-8 animate-spin" /> : <User className="w-8 h-8" />}
          </div>
          
          <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50 mb-2">
            Team Member / Employee
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-8 min-h-[40px]">
            I want to join an existing workspace, track my hours, and submit tasks.
          </p>

          <ul className="space-y-3 mb-8 w-full">
            {['Join via Invite Code', 'Track Time with Timer', 'Submit Daily Reports'].map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-auto w-full flex items-center text-sm font-semibold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform">
             Select Employee Profile <ArrowRight className="w-4 h-4 ml-2" />
          </div>
        </button>

      </div>
    </div>
  )
}