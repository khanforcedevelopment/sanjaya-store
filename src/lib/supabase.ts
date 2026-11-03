import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { env } from './env'

export type DB = SupabaseClient<Database>

/**
 * Browser Supabase client, using the public anon/publishable key only. All data
 * access is protected by Row Level Security. Privileged work (payments, webhooks,
 * KYC) runs in Supabase Edge Functions, never here.
 *
 * null until the backend is configured, so the site still builds and renders.
 */
export const supabase: DB | null =
  env.supabaseUrl && env.supabaseAnonKey
    ? createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null

export function requireSupabase(): DB {
  if (!supabase) throw new Error('The store backend is not connected yet.')
  return supabase
}

/** Turns Supabase/PostgREST errors into a message fit for customers. */
export function friendlyError(err: unknown): string {
  const msg = (err as { message?: string } | null)?.message ?? String(err)
  if (/JWT|not authenticated|Please sign in/i.test(msg)) return 'Please sign in to continue.'
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'Network problem. Please check your connection and try again.'
  if (/duplicate key/i.test(msg)) return 'This already exists.'
  if (/permission denied|row-level security|Not allowed/i.test(msg)) return 'You do not have permission to do that.'
  return msg
}
