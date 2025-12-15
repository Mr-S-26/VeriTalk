'use client'

import { useTimer } from '@/components/providers/timer-context'
import { Play, Square, Briefcase, Coffee, History } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function TimerPage() {
  const { isWorking, time, toggleTimer, formatTime } = useTimer()

  return (
    <div className="flex flex-col h-full w-full bg-neutral-50 dark:bg-neutral-950 relative overflow-hidden">
      
      {/* Background Decor (Subtle Gradients) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative z-10">
        
        {/* Header */}
        <div className="text-center space-y-2 mb-12">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
            Focus Timer
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">
            {isWorking ? "Stay focused. You're doing great." : "Ready to start your next session?"}
          </p>
        </div>

        {/* The Clock Card */}
        <div className={cn(
          "relative mb-12 p-10 md:p-16 rounded-3xl transition-all duration-500",
          isWorking 
            ? "bg-white dark:bg-neutral-900 shadow-2xl shadow-indigo-500/20 border border-indigo-100 dark:border-indigo-500/30 scale-105" 
            : "bg-white dark:bg-neutral-900 shadow-xl border border-neutral-200 dark:border-neutral-800"
        )}>
          {/* Pulse Ring (Active State) */}
          {isWorking && (
             <div className="absolute inset-0 rounded-3xl border-2 border-indigo-500/20 animate-pulse" />
          )}

          <div className={cn(
            "text-7xl md:text-9xl font-mono font-bold tracking-tighter tabular-nums transition-colors duration-300 select-none",
            isWorking ? "text-indigo-600 dark:text-indigo-400" : "text-neutral-300 dark:text-neutral-700"
          )}>
            {formatTime(time)}
          </div>
          
          {/* Label under clock */}
          <div className="absolute bottom-6 left-0 right-0 text-center">
             <span className={cn(
                "text-xs font-medium uppercase tracking-widest transition-colors duration-300",
                isWorking ? "text-indigo-400/80" : "text-neutral-300 dark:text-neutral-700"
             )}>
                {isWorking ? 'Recording Time' : 'Paused'}
             </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-8">
          <button
            onClick={toggleTimer}
            className={cn(
              "group relative flex items-center justify-center h-20 w-20 md:h-24 md:w-24 rounded-full shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-offset-2 dark:focus:ring-offset-neutral-950",
              isWorking 
                ? "bg-white dark:bg-neutral-800 border-4 border-rose-100 dark:border-rose-900/30 focus:ring-rose-500/50" 
                : "bg-indigo-600 hover:bg-indigo-500 border-4 border-indigo-200 dark:border-indigo-900/30 focus:ring-indigo-500/50"
            )}
          >
            {isWorking ? (
              <>
                <span className="absolute inset-0 rounded-full bg-rose-50 dark:bg-rose-900/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                <Square className="w-8 h-8 text-rose-500 fill-current relative z-10" />
              </>
            ) : (
              <Play className="w-10 h-10 text-white fill-current ml-1 relative z-10" />
            )}
          </button>

          {/* Status Indicator */}
          <div className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-500",
            isWorking 
              ? "bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/50" 
              : "bg-neutral-100 text-neutral-500 border border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700"
          )}>
            {isWorking ? (
               <>
                 <span className="relative flex h-2.5 w-2.5 mr-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                 </span>
                 Currently Working
               </>
            ) : (
               <>
                 <Coffee className="w-4 h-4" />
                 Ready to clock in
               </>
            )}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-6 text-center text-xs text-neutral-400 dark:text-neutral-600">
         <p>Don&apos;t forget to submit your timesheet at the end of the week.</p>
      </div>
    </div>
  )
}