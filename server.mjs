// Waigani Christian College web server.
//
// The site talks to Supabase directly from the browser (public pages use the
// publishable key, the admin dashboard uses Supabase Auth + row level
// security). This server therefore only needs to serve the built Vite app and
// needs no secrets, so a missing environment variable can never crash it or
// open an unprotected admin API.
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'

const here = dirname(fileURLToPath(import.meta.url))
const distDir = join(here, 'backend', 'frontend', 'dist')
const indexFile = join(distDir, 'index.html')
const port = Number(process.env.PORT || 3000)

if (!existsSync(indexFile)) {
  console.error(`Missing ${indexFile}. Run "npm run build" before "npm start".`)
}

const app = new Hono()

app.get('/api/health', (c) => c.json({ status: 'healthy' }))
app.all('/api/*', (c) => c.json({ detail: 'Not found' }, 404))

// Fingerprinted Vite assets never change, so browsers may cache them for a
// year. HTML must always be revalidated so a new deploy is picked up at once.
app.use('*', async (c, next) => {
  await next()
  if (c.res.status !== 200) return
  if (c.req.path.startsWith('/assets/')) c.res.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  else if (c.res.headers.get('Content-Type')?.startsWith('text/html')) c.res.headers.set('Cache-Control', 'no-cache')
})
app.use('/*', serveStatic({ root: relative(process.cwd(), distDir) || '.' }))

// A missing file (e.g. an old build's script requested after a redeploy) must
// be a real 404, not index.html, or the browser shows a blank page.
app.get('*', async (c) => {
  if (c.req.path.startsWith('/assets/') || /\.[a-z0-9]+$/i.test(c.req.path)) return c.text('Not found', 404)
  return c.html(await readFile(indexFile, 'utf8'))
})

app.onError((error, c) => {
  console.error(error)
  return c.text('Internal server error', 500)
})

serve({ fetch: app.fetch, port }, (info) => console.log(`WCC web app listening on port ${info.port}`))
