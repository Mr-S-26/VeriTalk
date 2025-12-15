'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { 
  Hash, Loader2, ArrowRight, ArrowLeft, 
  Command, ShieldCheck, AlertCircle 
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export default function JoinWorkspacePage() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      // Call secure Database Function
      const { data, error: rpcError } = await supabase
        .rpc('join_workspace', { code: code })

      if (rpcError) throw rpcError

      if (data && data.success) {
        // Success! Redirect to Employee Dashboard
        router.push('/timer')
      } else {
        // Logic error (e.g. Invalid Code)
        setError(data?.message || 'Invalid invite code.')
        setLoading(false)
      }
    } catch (err) {
        // FIX: Replaced 'any' with a safe type check
        const message = err instanceof Error ? err.message : 'Something went wrong.'
        setError(message)
        setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-950 relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Navigation (Back) */}
      <div className="absolute top-6 left-6 z-20">
        <Link 
            href="/onboarding"
            className="flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
        >
            <ArrowLeft className="w-4 h-4" /> Back to Role Selection
        </Link>
      </div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Brand/Logo */}
        <div className="flex justify-center mb-8">
            <div className="bg-white dark:bg-neutral-900 p-3 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800">
                <Command className="w-8 h-8 text-emerald-600 dark:text-emerald-500" />
            </div>
        </div>

        <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 mb-3">
                Join your Team
            </h1>
            <p className="text-neutral-500 dark:text-neutral-400">
                Enter the 6-character access code provided by your manager to enter the workspace.
            </p>
        </div>

        <form onSubmit={handleJoin} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
            
            {/* Input Field */}
            <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 ml-1">
                    Workspace Invite Code
                </label>
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Hash className="h-5 w-5 text-neutral-400 group-focus-within:text-emerald-500 transition-colors" />
                    </div>
                    <input
                        autoFocus
                        type="text"
                        placeholder="A1B2C3"
                        className="block w-full pl-11 pr-4 py-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-lg font-mono tracking-[0.2em] uppercase focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-neutral-300 dark:placeholder:text-neutral-700 text-neutral-900 dark:text-neutral-100"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        maxLength={6}
                    />
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-sm flex items-center gap-2 animate-in slide-in-from-top-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            {/* Submit Button */}
            <button
                type="submit"
                disabled={code.length < 6 || loading}
                className={cn(
                    "w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-semibold shadow-md transition-all",
                    loading 
                        ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-wait shadow-none" 
                        : "bg-emerald-600 hover:bg-emerald-700 hover:shadow-lg hover:-translate-y-0.5"
                )}
            >
                {loading ? (
                    <>
                       <Loader2 className="w-5 h-5 animate-spin" /> Verifying...
                    </>
                ) : (
                    <>
                       Access Workspace <ArrowRight className="w-5 h-5" />
                    </>
                )}
            </button>

            {/* Trust Indicator */}
            <div className="flex items-center justify-center gap-2 text-xs text-neutral-400 pt-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Secure Entry</span>
            </div>

        </form>
      </div>
    </div>
  )
}