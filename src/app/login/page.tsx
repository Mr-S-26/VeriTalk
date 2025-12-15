'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { 
  Loader2, Command, ArrowRight, Check, 
  Eye, EyeOff, Github, AlertCircle 
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  const router = useRouter()
  const supabase = createClient()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    if (isSignUp) {
      // --- Handle Sign Up ---
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: email.split('@')[0],
            avatar_url: '',
            // Role empty -> Onboarding
          },
        },
      })
      
      if (error) {
        setMessage({ type: 'error', text: error.message })
      } else {
        setMessage({ type: 'success', text: 'Check your email for the confirmation link!' })
      }
      setLoading(false)

    } else {
      // --- Handle Sign In ---
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setMessage({ type: 'error', text: error.message })
        setLoading(false)
      } else {
        // Login Successful -> Check Role
        if (data.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single()

          // Redirect Logic
          if (!profile || !profile.role) {
            router.push('/onboarding')
          } else if (profile.role === 'client') {
            router.push('/team-overview') 
          } else {
            router.push('/timer')
          }
          
          router.refresh()
        }
      }
    }
  }

  return (
    <div className="min-h-screen w-full flex bg-white dark:bg-neutral-950">
      
      {/* Left Panel (Branding) - Hidden on mobile */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-neutral-900 border-r border-neutral-800 p-12 relative overflow-hidden">
         {/* Background pattern */}
         <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-indigo-900/20 via-neutral-900 to-neutral-900 pointer-events-none" />
         
         <div className="relative z-10 flex items-center gap-2 text-white font-bold text-xl tracking-tight">
             <Command className="w-6 h-6 text-indigo-500" />
             StaffSync
         </div>

         <div className="relative z-10 max-w-lg">
             <blockquote className="space-y-6">
                <p className="text-2xl font-medium text-neutral-200 leading-relaxed">
                   &quot;This platform completely transformed how we manage our remote developers. The time tracking and automated reporting saved us 20 hours a week.&quot;
                </p>
                <footer className="flex items-center gap-4">
                   <div className="h-10 w-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                      JD
                   </div>
                   <div>
                      <div className="font-semibold text-white">John Doe</div>
                      <div className="text-sm text-neutral-500">CTO at TechCorp</div>
                   </div>
                </footer>
             </blockquote>
         </div>

         <div className="relative z-10 text-xs text-neutral-500 flex items-center gap-4">
            <span>© 2024 StaffSync Inc.</span>
            <a href="#" className="hover:text-neutral-300 transition-colors">Privacy</a>
            <a href="#" className="hover:text-neutral-300 transition-colors">Terms</a>
         </div>
      </div>

      {/* Right Panel (Form) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
         <div className="w-full max-w-sm space-y-8">
            
            <div className="space-y-2 text-center lg:text-left">
               <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                  {isSignUp ? "Create an account" : "Welcome back"}
               </h1>
               <p className="text-neutral-500 dark:text-neutral-400">
                  {isSignUp ? "Enter your email below to create your account" : "Enter your email to sign in to your account"}
               </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-5">
               
               {/* Email Input */}
               <div className="space-y-1.5">
                  <label className="text-sm font-medium leading-none text-neutral-700 dark:text-neutral-300">
                     Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    className="flex h-10 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-neutral-900 dark:text-neutral-100"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
               </div>

               {/* Password Input */}
               <div className="space-y-1.5">
                  <label className="text-sm font-medium leading-none text-neutral-700 dark:text-neutral-300 flex justify-between items-center">
                     Password
                     {!isSignUp && (
                        <a href="#" className="text-xs text-indigo-600 hover:text-indigo-500 font-medium">Forgot password?</a>
                     )}
                  </label>
                  <div className="relative">
                    <input
                        type={showPassword ? "text" : "password"}
                        required
                        className="flex h-10 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-neutral-900 dark:text-neutral-100 pr-10"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                    >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
               </div>

               {/* Feedback Message */}
               {message && (
                  <div className={cn(
                     "p-3 rounded-md text-sm flex items-start gap-2",
                     message.type === 'error' 
                        ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400" 
                        : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                  )}>
                     {message.type === 'error' ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <Check className="w-4 h-4 mt-0.5 shrink-0" />}
                     {message.text}
                  </div>
               )}

               {/* Submit Button */}
               <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
               >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSignUp ? 'Sign Up with Email' : 'Sign In'}
               </button>

            </form>

            <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-neutral-200 dark:border-neutral-800" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-neutral-950 px-2 text-neutral-500">Or continue with</span></div>
            </div>

            {/* Social / Toggle */}
            <div className="grid grid-cols-2 gap-4">
                <button type="button" className="flex items-center justify-center gap-2 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                    <Github className="w-4 h-4" /> Github
                </button>
                <button type="button" className="flex items-center justify-center gap-2 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                     Google
                </button>
            </div>

            <div className="text-center text-sm">
                <span className="text-neutral-500 dark:text-neutral-400">
                    {isSignUp ? "Already have an account? " : "Don't have an account? "}
                </span>
                <button
                    onClick={() => {
                        setIsSignUp(!isSignUp)
                        setMessage(null)
                    }}
                    className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                    {isSignUp ? "Sign In" : "Sign Up"}
                </button>
            </div>

         </div>
      </div>
    </div>
  )
}