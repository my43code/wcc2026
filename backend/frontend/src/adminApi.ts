import { supabase } from './supabase'

function parseBody(options:RequestInit) {
  return typeof options.body === 'string' ? JSON.parse(options.body) : options.body
}

function check<T>({ data, error }:{ data:T; error:{ message:string }|null }):T {
  if (error) throw new Error(error.message)
  return data
}

async function requireAdmin() {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    await supabase.auth.signOut()
    throw new Error('Admin sign-in required')
  }
  return data.user
}

export async function adminApi(path:string, options:RequestInit = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const url = new URL(path, window.location.origin)

  if (path === '/api/auth/login' && method === 'POST') {
    const credentials = parseBody(options) as { username:string; password:string }
    const { data, error } = await supabase.auth.signInWithPassword({ email:credentials.username.trim(), password:credentials.password })
    if (error || !data.user) {
      await supabase.auth.signOut()
      throw new Error(error?.message || 'Incorrect email or password')
    }
    return { access_token:data.session.access_token, token_type:'bearer', expires_in:data.session.expires_in }
  }

  if (path === '/api/admin/me') {
    const user = await requireAdmin()
    return { username:user.email, role:'Administrator' }
  }

  await requireAdmin()
  const body = parseBody(options)
  const id = path.match(/\/(\d+)$/)?.[1]

  if (url.pathname === '/api/media' && method === 'POST') {
    const file = (options.body as FormData).get('file') as File | null
    if (!file) throw new Error('Choose a file to upload')
    const mediaType = file.type.startsWith('video/') ? 'video' : 'image'
    const extension = file.name.includes('.') ? `.${file.name.split('.').pop()}` : ''
    const mediaPath = `posts/${crypto.randomUUID().replaceAll('-', '')}${extension}`
    check(await supabase.storage.from('post-media').upload(mediaPath, file, { contentType:file.type, upsert:false }))
    return { media_url:supabase.storage.from('post-media').getPublicUrl(mediaPath).data.publicUrl, media_type:mediaType, media_path:mediaPath }
  }

  if (url.pathname.startsWith('/api/posts')) {
    if (method === 'GET') return check(await supabase.from('posts').select('*').order('promoted', { ascending:false }).order('created_at', { ascending:false }))
    if (method === 'POST') return check(await supabase.from('posts').insert(body).select().single())
    if (method === 'PUT') return check(await supabase.from('posts').update(body).eq('id', id).select().single())
    if (method === 'DELETE') { check(await supabase.from('posts').delete().eq('id', id)); return null }
  }

  if (url.pathname.startsWith('/api/enquiries')) {
    if (method === 'GET') return check(await supabase.from('enquiries').select('*').order('created_at', { ascending:false }))
    if (method === 'PATCH') return check(await supabase.from('enquiries').update(body).eq('id', id).select().single())
    if (method === 'DELETE') { check(await supabase.from('enquiries').delete().eq('id', id)); return null }
  }

  if (url.pathname.startsWith('/api/staff')) {
    if (method === 'GET') return check(await supabase.from('staff_profiles').select('*').order('sort_order').order('name'))
    if (method === 'POST') return check(await supabase.from('staff_profiles').insert(body).select().single())
    if (method === 'PUT') return check(await supabase.from('staff_profiles').update(body).eq('id', id).select().single())
    if (method === 'DELETE') { check(await supabase.from('staff_profiles').delete().eq('id', id)); return null }
  }

  if (url.pathname.startsWith('/api/careers')) {
    if (method === 'GET') return check(await supabase.from('career_opportunities').select('*').order('closing_date', { ascending:true, nullsFirst:false }).order('created_at', { ascending:false }))
    if (method === 'POST') return check(await supabase.from('career_opportunities').insert(body).select().single())
    if (method === 'PUT') return check(await supabase.from('career_opportunities').update(body).eq('id', id).select().single())
    if (method === 'DELETE') { check(await supabase.from('career_opportunities').delete().eq('id', id)); return null }
  }

  throw new Error(`Unsupported admin request: ${method} ${url.pathname}`)
}

export async function adminSignOut() {
  await supabase.auth.signOut()
}
