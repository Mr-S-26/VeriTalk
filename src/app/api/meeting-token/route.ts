import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import jwt from 'jsonwebtoken'

// Define expected body shape
interface MeetingRequestBody {
  roomName: string
  userName: string
  email: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // 1. Check Auth (Security Gate)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: You must be logged in to join.' }, 
        { status: 401 }
      )
    }

    // 2. Parse & Validate Request Body
    const body: MeetingRequestBody = await request.json()
    const { userName, email } = body 

    if (!userName || !email) {
      return NextResponse.json(
        { error: 'Missing user details' }, 
        { status: 400 }
      )
    }

    // 3. JaaS Credentials
    const JAAS_APP_ID = process.env.JITSI_APP_ID
    const JAAS_KEY_ID = process.env.JITSI_KEY_ID
    const RAW_PRIVATE_KEY = process.env.JITSI_PRIVATE_KEY

    if (!JAAS_APP_ID || !JAAS_KEY_ID || !RAW_PRIVATE_KEY) {
      console.error('SERVER ERROR: Missing JaaS Environment Variables')
      return NextResponse.json(
        { error: 'Server misconfiguration: Video services unavailable.' }, 
        { status: 500 }
      )
    }
    
    // 4. Key Formatting (Crucial for Vercel/Env vars)
    const JAAS_PRIVATE_KEY = RAW_PRIVATE_KEY
      .replace(/\\n/g, '\n') // Convert literal "\n" string to newlines
      .replace(/"/g, '')     // Remove surrounding quotes if present
      .trim()
    
    // Quick Sanity Check
    if (!JAAS_PRIVATE_KEY.startsWith('-----BEGIN PRIVATE KEY-----')) {
      console.error('CRITICAL: Malformed Private Key.')
      throw new Error('Private key is malformed')
    }

    // 5. JWT Payload Construction
    const now = new Date()
    const exp = new Date(now.getTime() + 7200 * 1000) // 2 hours expiration
    const nbf = new Date(now.getTime() - 10 * 1000)   // 10 seconds leeway

    const payload = {
      context: {
        user: {
          id: user.id,
          name: userName,
          email: email,
          avatar: "", 
          moderator: true 
        },
        features: {
          livestreaming: true,
          recording: true,
          transcription: true,
          "outbound-call": false 
        }
      },
      aud: "jitsi",
      iss: "chat",
      sub: JAAS_APP_ID,
      room: "*", 
      exp: Math.round(exp.getTime() / 1000),
      nbf: Math.round(nbf.getTime() / 1000)
    }

    // 6. Sign Token
    const token = jwt.sign(payload, JAAS_PRIVATE_KEY, {
      algorithm: 'RS256',
      header: { 
        kid: JAAS_KEY_ID,
        typ: 'JWT',
        alg: 'RS256' // <--- FIX: Added this to satisfy TypeScript
      }
    })

    return NextResponse.json({ token })
    
  } catch (error) {
    console.error('Token Generation Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate secure meeting token' }, 
      { status: 500 }
    )
  }
}