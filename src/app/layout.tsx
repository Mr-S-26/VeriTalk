import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { TimerProvider } from '@/components/providers/timer-context'
import { NotificationProvider } from '@/components/providers/notification-provider' // <--- IMPORT
import { CallProvider } from '@/components/providers/call-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'VeriTalk',
  description: 'Workforce Management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <TimerProvider>
          {/* NEST NOTIFICATION PROVIDER HERE */}
          <NotificationProvider>
            <CallProvider>
            {children}
            </CallProvider>
          </NotificationProvider>
        </TimerProvider>
      </body>
    </html>
  )
}