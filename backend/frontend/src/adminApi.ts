import { supabase } from './supabase'
import { resourceBucket, validateResourceFile } from './resources'
import type { Resource, ResourceEditor } from './resources'

const mediaBucket = 'post-media'
const allowedMedia = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']

/** Delete a row and, if it referenced an uploaded file, remove that file too. */
async function deleteWithMedia(table:'posts'|'staff_profiles', pathColumn:'media_path'|'photo_path', id:string|undefined) {
  const { data } = await supabase.from(table).select(pathColumn).eq('id', id).maybeSingle()
  check(await supabase.from(table).delete().eq('id', id))
  const mediaPath = (data as Record<string, string|null> | null)?.[pathColumn]
  if (mediaPath) await supabase.storage.from(mediaBucket).remove([mediaPath])
  return null
}

function resourceFields(body:ResourceEditor):ResourceEditor {
  return {title:body.title.trim(),description:body.description.trim(),category:body.category,
    file_url:body.file_url || '',file_bucket:body.file_bucket,file_path:body.file_path,
    file_name:body.file_name,file_size:body.file_size,sort_order:body.sort_order,published:body.published}
}

async function removeResourceFile(bucket:string,path:string) {
  if (![resourceBucket,mediaBucket].includes(bucket) || !/^resources\/[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(path)) throw new Error('Invalid resource file address')
  const links = check(await supabase.from('resources').select('id').eq('file_bucket',bucket).eq('file_path',path).limit(1))
  if (links?.length) throw new Error('This file is still used by a resource.')
  check(await supabase.storage.from(bucket).remove([path]))
}

async function cleanUpResourceFile(resource:Pick<Resource,'file_bucket'|'file_path'>) {
  try { await removeResourceFile(resource.file_bucket,resource.file_path) }
  catch { console.warn('The resource was saved, but an unused file could not be removed.') }
}

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
  const { data:isAdmin, error:permissionError } = await supabase.rpc('is_wcc_admin')
  if (permissionError || !isAdmin) {
    await supabase.auth.signOut()
    throw new Error(permissionError?.message || 'This account does not have administrator access.')
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
    await requireAdmin()
    return { access_token:data.session.access_token, token_type:'bearer', expires_in:data.session.expires_in }
  }

  if (path === '/api/admin/me') {
    const user = await requireAdmin()
    return { username:user.email, role:'Administrator' }
  }

  await requireAdmin()
  const body = parseBody(options)
  const id = path.match(/\/(\d+)$/)?.[1]

  if (url.pathname.startsWith('/api/learning-pages')) {
    if (method === 'GET') return check(await supabase.from('learning_pages').select('*').order('sort_order').order('title'))
    if (method === 'POST') return check(await supabase.from('learning_pages').insert(body).select().single())
    if (method === 'PUT') return check(await supabase.from('learning_pages').update(body).eq('id', id).select().single())
    if (method === 'DELETE') { check(await supabase.from('learning_pages').delete().eq('id', id)); return null }
  }

  if (url.pathname === '/api/media' && method === 'POST') {
    const file = (options.body as FormData).get('file') as File | null
    if (!file) throw new Error('Choose a file to upload')
    if (!allowedMedia.includes(file.type)) throw new Error('Unsupported file type. Use JPG, PNG, WebP, GIF, MP4, WebM or MOV.')
    const mediaType = file.type.startsWith('video/') ? 'video' : 'image'
    const limit = mediaType === 'video' ? 50 : 10
    if (file.size > limit * 1024 * 1024) throw new Error(`${mediaType === 'video' ? 'Videos' : 'Images'} must be ${limit} MB or smaller.`)
    const extension = file.name.includes('.') ? `.${file.name.split('.').pop()!.toLowerCase()}` : ''
    const mediaPath = `posts/${crypto.randomUUID().replaceAll('-', '')}${extension}`
    check(await supabase.storage.from(mediaBucket).upload(mediaPath, file, { contentType:file.type, upsert:false }))
    return { media_url:supabase.storage.from(mediaBucket).getPublicUrl(mediaPath).data.publicUrl, media_type:mediaType, media_path:mediaPath }
  }

  if (url.pathname.startsWith('/api/posts')) {
    if (method === 'GET') return check(await supabase.from('posts').select('*').order('promoted', { ascending:false }).order('created_at', { ascending:false }))
    if (method === 'POST') return check(await supabase.from('posts').insert(body).select().single())
    if (method === 'PUT') return check(await supabase.from('posts').update(body).eq('id', id).select().single())
    if (method === 'DELETE') return deleteWithMedia('posts', 'media_path', id)
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
    if (method === 'DELETE') return deleteWithMedia('staff_profiles', 'photo_path', id)
  }

  if (url.pathname.startsWith('/api/careers')) {
    if (method === 'GET') return check(await supabase.from('career_opportunities').select('*').order('closing_date', { ascending:true, nullsFirst:false }).order('created_at', { ascending:false }))
    if (method === 'POST') return check(await supabase.from('career_opportunities').insert(body).select().single())
    if (method === 'PUT') return check(await supabase.from('career_opportunities').update(body).eq('id', id).select().single())
    if (method === 'DELETE') { check(await supabase.from('career_opportunities').delete().eq('id', id)); return null }
  }

  if (url.pathname === '/api/resource-upload' && method === 'POST') {
    const file = (options.body as FormData).get('file') as File | null
    if (!file) throw new Error('Choose a file to upload')
    const {extension,contentType} = validateResourceFile(file)
    const filePath = `resources/${crypto.randomUUID().replaceAll('-', '')}.${extension}`
    check(await supabase.storage.from(resourceBucket).upload(filePath, file, { contentType, upsert:false }))
    return { file_url:'',file_bucket:resourceBucket,file_path:filePath,file_name:file.name,file_size:file.size }
  }
  if (url.pathname === '/api/resource-upload' && method === 'DELETE') {
    const file = body as {file_bucket:string;file_path:string}
    await removeResourceFile(file.file_bucket,file.file_path)
    return null
  }

  if (url.pathname.startsWith('/api/resources')) {
    if (method === 'GET') return check(await supabase.from('resources').select('*').order('category').order('sort_order').order('title'))
    if (method === 'POST') return check(await supabase.from('resources').insert(resourceFields(body)).select().single())
    if (method === 'PUT') {
      const old = check(await supabase.from('resources').select('file_bucket,file_path').eq('id',id).single())
      if (!old) throw new Error('The resource no longer exists. Refresh the library and try again.')
      const saved = check(await supabase.from('resources').update(resourceFields(body)).eq('id',id).select().single())
      if (!saved) throw new Error('The resource could not be saved. Please try again.')
      if (old.file_path!==saved.file_path || old.file_bucket!==saved.file_bucket) await cleanUpResourceFile(old)
      return saved
    }
    if (method === 'DELETE') {
      const old = check(await supabase.from('resources').select('file_bucket,file_path').eq('id',id).single())
      if (!old) throw new Error('The resource no longer exists. Refresh the library and try again.')
      check(await supabase.from('resources').delete().eq('id',id))
      await cleanUpResourceFile(old)
      return null
    }
  }

  throw new Error(`Unsupported admin request: ${method} ${url.pathname}`)
}

export async function adminSignOut() {
  await supabase.auth.signOut()
}
