'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image' // <--- NEW IMPORT
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useNotification } from '@/components/providers/notification-provider'
import { 
  Hash, Shield, Clock, Calendar, LogOut, Users, 
  CheckSquare, FileBarChart, MessageSquare, Video, 
  Settings, Layers, type LucideIcon 
} from 'lucide-react'
import { cn } from '@/lib/utils'

// --- Types ---
interface Workspace {
  id: string
  name: string
  owner_id: string
}

interface Channel {
  id: string
  name: string
}

// --- Sub-components ---

const NotificationBadge = ({ count }: { count: number }) => {
  if (count === 0) return null
  return (
    <span className="ml-auto bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm min-w-[18px] text-center">
      {count > 9 ? '9+' : count}
    </span>
  )
}

const SidebarItem = ({ 
  icon: Icon, 
  label, 
  href, 
  isActive, 
  badgeCount 
}: { 
  icon: LucideIcon, 
  label: string, 
  href: string, 
  isActive?: boolean,
  badgeCount?: number
}) => (
  <Link 
    href={href} 
    className={cn(
      "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 mx-2",
      isActive 
        ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50" 
        : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-200"
    )}
  >
    <Icon className={cn("w-4 h-4 mr-3 shrink-0 transition-colors", isActive ? "text-indigo-600 dark:text-indigo-400" : "text-neutral-400 group-hover:text-neutral-500")} />
    <span className="truncate flex-1">{label}</span>
    {badgeCount !== undefined && <NotificationBadge count={badgeCount} />}
  </Link>
)

const SectionHeader = ({ label }: { label: string }) => (
  <div className="px-5 mt-6 mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
    {label}
  </div>
)

const SidebarSkeleton = () => (
  <div className="space-y-4 px-4 mt-4 animate-pulse">
    <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-1/2 mb-6"></div>
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="h-8 bg-neutral-100 dark:bg-neutral-800/50 rounded-md w-full"></div>
    ))}
  </div>
)

// --- Main Component ---

export default function AppSidebar() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [isClient, setIsClient] = useState<boolean>(false) 
  const [isLoading, setIsLoading] = useState(true)
  const [userEmail, setUserEmail] = useState<string>('')

  const { unreadCount } = useNotification()
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const initData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setIsLoading(false)
          return
        }
        setUserEmail(user.email || '')

        // 1. Fetch Workspaces
        const { data: workspaceData, error } = await supabase
          .from('workspaces')
          .select(`id, name, owner_id, workspace_members!inner(user_id)`)
          .eq('workspace_members.user_id', user.id)
        
        if (error) throw error

        if (workspaceData && workspaceData.length > 0) {
          setWorkspaces(workspaceData as unknown as Workspace[]) 
          
          const firstWorkspace = workspaceData[0]
          const userIsOwner = workspaceData.some(ws => ws.owner_id === user.id)
          setIsClient(userIsOwner)

          // 2. Fetch Channels
          const { data: channelData } = await supabase
            .from('channels')
            .select('id, name')
            .eq('workspace_id', firstWorkspace.id)
          
          if (channelData) setChannels(channelData)
        }
      } catch (error) {
        console.error('Sidebar Data Fetch Error:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initData()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-64 shrink-0 h-full bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col z-20">
      
      {/* Brand Header */}
      <div className="h-14 flex items-center px-5 border-b border-neutral-100 dark:border-neutral-800">
        <Link href="" className="flex items-center gap-3">
          {/* LOGO IMAGE */}
          <div className="relative w-12 h-12 shrink-0">
             <Image 
               src="/veritalk.png" // Ensure 'logo.png' exists in your /public folder
               alt="VeriTalk Logo" 
               fill
               className="object-contain"
               priority
             />
          </div>
          <span className="text-indigo-600 dark:text-indigo-400 font-bold text-lg tracking-tight">
            VeriTalk
          </span>
        </Link>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto py-4 custom-scrollbar">
        {isLoading ? (
          <SidebarSkeleton />
        ) : (
          <>
            {/* Workspaces */}
            <SectionHeader label="Workspaces" />
            <div className="space-y-0.5">
              {workspaces.map((ws) => (
                <button 
                  key={ws.id} 
                  className="w-full text-left mx-2 px-3 py-2 rounded-md text-sm text-neutral-600 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-800/50 flex items-center transition-colors max-w-[calc(100%-1rem)]"
                >
                  <Layers className="w-4 h-4 mr-3 text-neutral-400" />
                  <span className="truncate">{ws.name}</span>
                </button>
              ))}
            </div>

            {/* Channels */}
            {channels.length > 0 && (
              <>
                <SectionHeader label="Team Chat" />
                <div className="space-y-0.5">
                  {channels.map((channel) => (
                    <SidebarItem
                      key={channel.id}
                      label={channel.name}
                      href={`/channels/${channel.id}`}
                      icon={Hash}
                      isActive={pathname === `/channels/${channel.id}`}
                    />
                  ))}
                </div>
                
                <SectionHeader label="Voice & Video" />
                <SidebarItem 
                  label="General Room" 
                  href="/meeting" 
                  icon={Video} 
                  isActive={pathname === '/meeting'}
                />
              </>
            )}

            {/* Main Navigation Menu */}
            <SectionHeader label="Menu" />
            <div className="space-y-0.5">
              {isClient ? (
                <>
                  <SidebarItem label="Manage Employees" href="/manage-employees" icon={Users} isActive={pathname === '/manage-employees'} />
                  <SidebarItem label="Team Reports" href="/team-reports" icon={FileBarChart} isActive={pathname === '/team-reports'} />
                  <SidebarItem label="Messages" href="/messages" icon={MessageSquare} isActive={pathname === '/messages'} badgeCount={unreadCount} />
                  <SidebarItem label="Team Overview" href="/team-overview" icon={Shield} isActive={pathname === '/team-overview'} />
                </>
              ) : (
                <>
                  <SidebarItem label="My Tasks" href="/my-tasks" icon={CheckSquare} isActive={pathname === '/my-tasks'} />
                  <SidebarItem label="Messages" href="/messages" icon={MessageSquare} isActive={pathname === '/messages'} badgeCount={unreadCount} />
                  <SidebarItem label="Time Tracker" href="/timer" icon={Clock} isActive={pathname === '/timer'} />
                  <SidebarItem label="My Timesheets" href="/reports" icon={Calendar} isActive={pathname === '/reports'} />
                </>
              )}
            </div>

            {/* System */}
            <SectionHeader label="System" />
            <div className="space-y-0.5">
              <SidebarItem label="Settings" href="/settings" icon={Settings} isActive={pathname === '/settings'} />
            </div>
          </>
        )}
      </div>

      {/* Footer / User Profile */}
      <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors group cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs">
            {userEmail.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-200 truncate">
              {userEmail.split('@')[0]}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-500 truncate">
              {isClient ? 'Owner' : 'Team Member'}
            </p>
          </div>
          <button 
            onClick={handleLogout}
            title="Log out"
            className="text-neutral-400 hover:text-rose-500 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}