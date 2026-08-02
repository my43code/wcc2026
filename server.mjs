import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { createAdminClient } from '@supabase/server/core'
import { config } from 'dotenv'
import { Hono } from 'hono'

config()
config({ path: 'backend/.env.local' })

const app = new Hono()
const port = Number(process.env.PORT || 3000)
const adminUsername = process.env.WCC_ADMIN_USERNAME || 'admin'
const adminPassword = process.env.WCC_ADMIN_PASSWORD || 'ChangeMe123!'
const signingSecret = process.env.WCC_SECRET_KEY || 'development-secret-change-before-production'
const tokenTtl = 8 * 60 * 60
const mediaBucket = 'post-media'
let database

function db() { database ||= createAdminClient(); return database }
function safeEqual(left, right) { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b) }
function createToken(username) { const payload = Buffer.from(JSON.stringify({ sub: username, exp: Math.floor(Date.now() / 1000) + tokenTtl })).toString('base64url'); const signature = createHmac('sha256', signingSecret).update(payload).digest('hex'); return `${payload}.${signature}` }
function validToken(token) { try { const [payload, signature] = token.split('.', 2); const expected = createHmac('sha256', signingSecret).update(payload).digest('hex'); if (!safeEqual(signature, expected)) return false; const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()); return decoded.sub === adminUsername && decoded.exp >= Math.floor(Date.now() / 1000) } catch { return false } }
async function requireAdmin(c, next) { const authorization = c.req.header('Authorization') || ''; if (!authorization.startsWith('Bearer ') || !validToken(authorization.slice(7))) return c.json({ detail: 'Session expired or invalid' }, 401); await next() }
function fail(c, error, fallback = 'Database request failed') { console.error(error); return c.json({ detail: error?.message || fallback }, 500) }

app.get('/api/health', async (c) => { const { error } = await db().from('posts').select('id').limit(1); return error ? fail(c, error, 'Database connection unavailable') : c.json({ status: 'healthy', database: 'supabase', access: 'admin' }) })
app.post('/api/auth/login', async (c) => { const body = await c.req.json().catch(() => ({})); if (!safeEqual(String(body.username || ''), adminUsername) || !safeEqual(String(body.password || ''), adminPassword)) return c.json({ detail: 'Incorrect username or password' }, 401); return c.json({ access_token: createToken(adminUsername), token_type: 'bearer', expires_in: tokenTtl }) })
app.get('/api/admin/me', requireAdmin, (c) => c.json({ username: adminUsername, role: 'Administrator' }))

app.get('/api/posts', async (c) => { const admin = c.req.query('admin') === 'true'; if (admin) { const denied = await requireAdmin(c, async () => {}); if (denied) return denied } let query = db().from('posts').select('*'); if (!admin) query = query.eq('published', true); if (c.req.query('category')) query = query.eq('category', c.req.query('category')); const { data, error } = await query.order('promoted', { ascending: false }).order('created_at', { ascending: false }); return error ? fail(c, error) : c.json(data) })
app.post('/api/posts', requireAdmin, async (c) => { const { data, error } = await db().from('posts').insert(await c.req.json()).select().single(); return error ? fail(c, error) : c.json(data, 201) })
app.put('/api/posts/:id', requireAdmin, async (c) => { const { data, error } = await db().from('posts').update(await c.req.json()).eq('id', c.req.param('id')).select().single(); return error ? fail(c, error) : c.json(data) })
app.delete('/api/posts/:id', requireAdmin, async (c) => { const { data: current } = await db().from('posts').select('media_path').eq('id', c.req.param('id')).maybeSingle(); const { error } = await db().from('posts').delete().eq('id', c.req.param('id')); if (error) return fail(c, error); if (current?.media_path) await db().storage.from(mediaBucket).remove([current.media_path]); return c.body(null, 204) })

app.post('/api/enquiries', async (c) => { const body = await c.req.json(); const { error } = await db().from('enquiries').insert({ ...body, status: 'new' }); return error ? fail(c, error) : c.json({ status: 'received' }, 201) })
app.get('/api/enquiries', requireAdmin, async (c) => { const { data, error } = await db().from('enquiries').select('*').order('created_at', { ascending: false }); return error ? fail(c, error) : c.json(data) })
app.patch('/api/enquiries/:id', requireAdmin, async (c) => { const { status } = await c.req.json(); const { data, error } = await db().from('enquiries').update({ status }).eq('id', c.req.param('id')).select().single(); return error ? fail(c, error) : c.json({ id: data.id, status: data.status }) })
app.delete('/api/enquiries/:id', requireAdmin, async (c) => { const { error } = await db().from('enquiries').delete().eq('id', c.req.param('id')); return error ? fail(c, error) : c.body(null, 204) })

app.get('/api/staff', async (c) => { const admin = c.req.query('admin') === 'true'; if (admin) { const denied = await requireAdmin(c, async () => {}); if (denied) return denied } let query = db().from('staff_profiles').select('*'); if (!admin) query = query.eq('published', true); const { data, error } = await query.order('sort_order').order('name'); return error ? fail(c, error) : c.json(data) })
app.post('/api/staff', requireAdmin, async (c) => { const { data, error } = await db().from('staff_profiles').insert(await c.req.json()).select().single(); return error ? fail(c, error) : c.json(data, 201) })
app.put('/api/staff/:id', requireAdmin, async (c) => { const { data, error } = await db().from('staff_profiles').update(await c.req.json()).eq('id', c.req.param('id')).select().single(); return error ? fail(c, error) : c.json(data) })
app.delete('/api/staff/:id', requireAdmin, async (c) => { const { data: current } = await db().from('staff_profiles').select('photo_path').eq('id', c.req.param('id')).maybeSingle(); const { error } = await db().from('staff_profiles').delete().eq('id', c.req.param('id')); if (error) return fail(c, error); if (current?.photo_path) await db().storage.from(mediaBucket).remove([current.photo_path]); return c.body(null, 204) })

app.get('/api/careers', async (c) => { const admin = c.req.query('admin') === 'true'; if (admin) { const denied = await requireAdmin(c, async () => {}); if (denied) return denied } let query = db().from('career_opportunities').select('*'); if (!admin) query = query.eq('published', true); const { data, error } = await query.order('closing_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }); return error ? fail(c, error) : c.json(data) })
app.post('/api/careers', requireAdmin, async (c) => { const { data, error } = await db().from('career_opportunities').insert(await c.req.json()).select().single(); return error ? fail(c, error) : c.json(data, 201) })
app.put('/api/careers/:id', requireAdmin, async (c) => { const { data, error } = await db().from('career_opportunities').update(await c.req.json()).eq('id', c.req.param('id')).select().single(); return error ? fail(c, error) : c.json(data) })
app.delete('/api/careers/:id', requireAdmin, async (c) => { const { error } = await db().from('career_opportunities').delete().eq('id', c.req.param('id')); return error ? fail(c, error) : c.body(null, 204) })

app.post('/api/media', requireAdmin, async (c) => { const body = await c.req.parseBody(); const file = body.file; if (!(file instanceof File)) return c.json({ detail: 'Choose a file to upload' }, 400); const types = { 'image/jpeg': ['image', '.jpg'], 'image/png': ['image', '.png'], 'image/webp': ['image', '.webp'], 'image/gif': ['image', '.gif'], 'video/mp4': ['video', '.mp4'], 'video/webm': ['video', '.webm'], 'video/quicktime': ['video', '.mov'] }; const config = types[file.type]; if (!config) return c.json({ detail: 'Unsupported media type' }, 415); const mediaPath = `posts/${randomUUID().replaceAll('-', '')}${config[1]}`; const { error } = await db().storage.from(mediaBucket).upload(mediaPath, await file.arrayBuffer(), { contentType: file.type, upsert: false }); if (error) return fail(c, error, 'Unable to upload media'); return c.json({ media_url: db().storage.from(mediaBucket).getPublicUrl(mediaPath).data.publicUrl, media_type: config[0], media_path: mediaPath }, 201) })

app.use('/*', serveStatic({ root: './backend/frontend/dist' }))
app.get('*', async (c) => c.html(await readFile('./backend/frontend/dist/index.html', 'utf8')))
app.onError((error, c) => fail(c, error, 'Internal server error'))
serve({ fetch: app.fetch, port }, (info) => console.log(`WCC web app listening on port ${info.port}`))
