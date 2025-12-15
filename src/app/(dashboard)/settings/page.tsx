'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNotification } from '@/components/providers/notification-provider'
import { 
  User, Camera, Bell, Save, Loader2, 
  Volume2, VolumeX, Check, Briefcase, Mail 
} from 'lucide-react'
import { cn } from '@/lib/utils' // Ensure you have this utility from the previous step

export default function SettingsPage() {
  const supabase = createClient()
  const { soundEnabled, toggleSound } = useNotification()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  // Profile State
  const [userId, setUserId] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('') // Added email for display context
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // 1. Fetch Profile
  useEffect(() => {
    const getProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        setUserId(user.id)
        setEmail(user.email || '')

        const { data } = await supabase
          .from('profiles')
          .select('full_name, avatar_url, role')
          .eq('id', user.id)
          .single()
        
        if (data) {
          setFullName(data.full_name || '')
          setRole(data.role || '')
          setAvatarUrl(data.avatar_url)
        }
      } catch (err) {
        console.error('Error loading profile', err)
      } finally {
        setLoading(false)
      }
    }
    getProfile()
  }, [supabase])

  // 2. Handle Image Upload
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) return
      
      setUploading(true)
      const file = event.target.files[0]
      const fileExt = file.name.split('.').pop()
      const filePath = `${userId}-${Math.random()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId)

      if (updateError) throw updateError

      setAvatarUrl(publicUrl)
      setMessage({ type: 'success', text: 'Avatar updated successfully!' })
      
    } catch (error) {
      console.error('Error uploading avatar:', error)
      setMessage({ type: 'error', text: 'Error uploading avatar.' })
    } finally {
      setUploading(false)
    }
  }

  // 3. Save Profile Info
  const handleSaveProfile = async () => {
    if (!userId) return
    setSaving(true)
    setMessage(null)

    const { error } = await supabase
      .from('profiles')
      .update({ 
          full_name: fullName,
          role: role
      })
      .eq('id', userId)

    if (error) {
        setMessage({ type: 'error', text: 'Failed to update profile.' })
    } else {
        setMessage({ type: 'success', text: 'Profile updated successfully!' })
        // Clear success message after 3 seconds
        setTimeout(() => setMessage(null), 3000)
    }
    setSaving(false)
  }

  // --- SKELETON LOADER ---
  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-neutral-200 dark:bg-neutral-800 rounded mb-8" />
        <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 h-40 border border-neutral-200 dark:border-neutral-800" />
        <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 h-64 border border-neutral-200 dark:border-neutral-800" />
      </div>
    )
  }

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto w-full">
      <div className="flex flex-col gap-1 mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
          Account Settings
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400">
          Manage your profile information and system preferences.
        </p>
      </div>

      {message && (
        <div className={cn(
          "mb-6 p-4 rounded-lg flex items-center gap-3 text-sm font-medium border animate-in fade-in slide-in-from-top-2",
          message.type === 'error' 
            ? "bg-red-50 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/50" 
            : "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/50"
        )}>
            {message.type === 'error' ? null : <Check className="w-4 h-4" />}
            {message.text}
        </div>
      )}

      <div className="space-y-6">
        
        {/* SECTION 1: Avatar */}
        <section className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-6">
              <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50 mb-1 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-indigo-500" />
                  Profile Picture
              </h2>
              <p className="text-sm text-neutral-500 mb-6">This will be displayed on your profile and in chat messages.</p>
              
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                  <div className="relative group shrink-0">
                      <div className="h-24 w-24 rounded-full overflow-hidden bg-neutral-100 dark:bg-neutral-800 border-4 border-white dark:border-neutral-800 shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-700">
                          {avatarUrl ? (
                              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                          ) : (
                              <div className="h-full w-full flex items-center justify-center text-neutral-400">
                                  <User className="w-10 h-10" />
                              </div>
                          )}
                      </div>
                      <button 
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="absolute inset-0 bg-neutral-900/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer backdrop-blur-sm"
                      >
                          {uploading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
                      </button>
                  </div>
                  
                  <div className="flex-1 text-center sm:text-left">
                      <div className="flex flex-col gap-2">
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center justify-center px-4 py-2 border border-neutral-300 dark:border-neutral-700 shadow-sm text-sm font-medium rounded-md text-neutral-700 dark:text-neutral-200 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Change Image
                        </button>
                        <p className="text-xs text-neutral-500 dark:text-neutral-500">
                            JPG, GIF or PNG. 2MB max.
                        </p>
                      </div>
                      <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleAvatarUpload} 
                          accept="image/*" 
                          className="hidden" 
                      />
                  </div>
              </div>
            </div>
        </section>

        {/* SECTION 2: Personal Info */}
        <section className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
              <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50 mb-1 flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-500" />
                  Personal Information
              </h2>
              <p className="text-sm text-neutral-500">Update your personal details here.</p>
            </div>
            
            <div className="p-6 space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Full Name */}
                  <div className="space-y-2">
                      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-neutral-700 dark:text-neutral-300">
                        Full Name
                      </label>
                      <input 
                          type="text" 
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="flex h-10 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 text-neutral-900 dark:text-neutral-100"
                          placeholder="John Doe"
                      />
                  </div>

                  {/* Role */}
                  <div className="space-y-2">
                      <label className="text-sm font-medium leading-none text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                          Job Title
                      </label>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                        <input 
                            type="text" 
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent pl-9 pr-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-900 text-neutral-900 dark:text-neutral-100"
                            placeholder="e.g. Senior Product Designer"
                        />
                      </div>
                  </div>
                </div>

                {/* Email (Read Only) */}
                <div className="space-y-2">
                    <label className="text-sm font-medium leading-none text-neutral-700 dark:text-neutral-300">
                        Email Address
                    </label>
                    <div className="relative opacity-60">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                      <input 
                          type="text" 
                          value={email}
                          disabled
                          className="flex h-10 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 pl-9 pr-3 py-2 text-sm cursor-not-allowed text-neutral-500 dark:text-neutral-400"
                      />
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button 
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-indigo-600 text-white hover:bg-indigo-700 h-10 px-4 py-2"
                  >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      Save Changes
                  </button>
                </div>
            </div>
        </section>

        {/* SECTION 3: Preferences */}
        <section className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
              <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50 mb-1 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-indigo-500" />
                  Preferences
              </h2>
              <p className="text-sm text-neutral-500">Customize your notification experience.</p>
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                      <div className="font-medium text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                          Notification Sound
                          {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-500" /> : <VolumeX className="w-4 h-4 text-neutral-400" />}
                      </div>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">
                          Play a sound when you receive a new direct message.
                      </p>
                  </div>
                  
                  <button 
                      onClick={toggleSound}
                      className={cn(
                        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-950",
                        soundEnabled ? "bg-indigo-600" : "bg-neutral-200 dark:bg-neutral-700"
                      )}
                  >
                      <span className={cn(
                        "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
                        soundEnabled ? "translate-x-5" : "translate-x-0"
                      )} />
                  </button>
              </div>
            </div>
        </section>

      </div>
    </div>
  )
}