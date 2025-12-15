import AppSidebar from '@/components/sidebar/app-sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // 1. Use h-dvh for mobile address bar compatibility
    // 2. Use neutral background for visual depth (light/dark mode ready)
    <div className="flex h-dvh w-full bg-neutral-50 dark:bg-neutral-950">
      
      {/* Persistent Sidebar */}
      {/* Ensure your Sidebar handles its own z-index/width */}
      <AppSidebar />
      
      {/* Main Content Area */}
      <main className="
        flex-1 
        flex 
        flex-col 
        h-full 
        overflow-y-auto 
        relative
        transition-all 
        duration-300 
        ease-in-out
      ">
        {children}
      </main>
    </div>
  )
}