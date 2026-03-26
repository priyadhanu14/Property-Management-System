import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

/** True when Supabase env vars are configured */
export const isAuthEnabled = !!(supabaseUrl && supabaseAnonKey)

// Only create a real client when credentials exist; otherwise leave null.
export const supabase: SupabaseClient | null = isAuthEnabled
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
