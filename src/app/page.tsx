import { redirect } from 'next/navigation'

export default function Home() {
  // For MVP speed, we just force redirect to login.
  // The middleware (which we can add later) usually handles protection.
  // Once logged in, the login page redirects back here, so we redirect to dashboard.
  
  redirect('/team-overview')
}