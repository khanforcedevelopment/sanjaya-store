import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from './env'

/**
 * Browser Supabase client, using the anon (public) key only. All data access is
 * protected by Row Level Security in the database. Privileged work (payments,
 * webhooks, order approval, KYC) runs in Supabase Edge Functions, never here.
 *
 * Returns null until the backend is configured (Phase 2), so the site still
 * builds and renders without it.
 */
export const supabase: SupabaseClient | null =
  env.supabaseUrl && env.supabaseAnonKey
    ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null
