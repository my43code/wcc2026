import { createClient } from '@supabase/supabase-js'

// The website's Supabase project. Both values are public: every visitor's
// browser receives them. VITE_ build variables (for example in the hosting
// panel) may override them, but only when they are well-formed. createClient
// throws on an invalid URL, which would stop the whole site from loading, so a
// mistyped hosting variable must never get through.
const defaultUrl = 'https://qemfloodlswcorxwqrzw.supabase.co'
const defaultPublishableKey = 'sb_publishable_Xmm8LIgsyMdb955wNXr2Nw_niGPjvUN'

function isSupabaseUrl(value:string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const envKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim()
const supabaseUrl = isSupabaseUrl(envUrl) ? envUrl : defaultUrl
const supabasePublishableKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(envKey) ? envKey : defaultPublishableKey

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/**
 * Finish every Supabase email-link format before a page tries to use the session.
 * Supabase may return a PKCE code, a token hash, or (for older templates) tokens
 * in the URL fragment. Mobile mail browsers are especially prone to reaching the
 * page before detectSessionInUrl has persisted the session.
 */
export async function completeAuthRedirect() {
  const url = new URL(window.location.href)
  const errorDescription = url.searchParams.get('error_description')
    || new URLSearchParams(url.hash.replace(/^#/, '')).get('error_description')
  if (errorDescription) throw new Error(errorDescription)

  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ''))

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error && !/code verifier|already been used/i.test(error.message)) throw error
  } else if (tokenHash && (type === 'invite' || type === 'recovery')) {
    const { error } = await supabase.auth.verifyOtp({ token_hash:tokenHash, type })
    if (error) throw error
  } else if (fragment.get('access_token') && fragment.get('refresh_token')) {
    const { error } = await supabase.auth.setSession({
      access_token:fragment.get('access_token')!,
      refresh_token:fragment.get('refresh_token')!,
    })
    if (error) throw error
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  if (data.session) window.history.replaceState({}, '', url.pathname)
  return data.session
}
