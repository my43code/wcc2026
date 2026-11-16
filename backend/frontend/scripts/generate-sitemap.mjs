import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const siteOrigin = 'https://waiganichristiancollege.edu.pg'
const defaultApiUrl = 'https://qemfloodlswcorxwqrzw.supabase.co'
const defaultPublishableKey = 'sb_publishable_Xmm8LIgsyMdb955wNXr2Nw_niGPjvUN'
const learningSlug = /^(early-learning|primary-school|secondary-school|fode)(\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/
const staticPaths = [
  '/', '/about-us', '/our-school', '/learning', '/student-life', '/news-events',
  '/administration-staff', '/career-opportunities', '/forms-resources', '/sitemap',
]

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;',
  })[character])
}

function modifiedDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10)
}

function validSlug(value) {
  return typeof value === 'string' && value.length <= 160 && learningSlug.test(value)
}

export function readPublicConfig(env = process.env, envText = '') {
  const fromFile = Object.fromEntries(envText.split(/\r?\n/).flatMap(line => {
    const match = line.match(/^\s*(VITE_SUPABASE_URL|VITE_SUPABASE_PUBLISHABLE_KEY)\s*=\s*(.*?)\s*$/)
    if (!match) return []
    return [[match[1], match[2].replace(/^(['"])(.*)\1$/, '$2')]]
  }))
  const requestedUrl = (env.VITE_SUPABASE_URL || fromFile.VITE_SUPABASE_URL || '').trim()
  const requestedKey = (env.VITE_SUPABASE_PUBLISHABLE_KEY || fromFile.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim()
  let apiUrl = defaultApiUrl
  try {
    const parsed = new URL(requestedUrl)
    if ((parsed.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(parsed.hostname))
      && !parsed.username && !parsed.password) apiUrl = parsed.origin
  } catch { /* Match the frontend's public defaults for invalid hosting settings. */ }
  // Accept only public publishable keys, never a server-side secret or service role key.
  const publishableKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(requestedKey)
    ? requestedKey : defaultPublishableKey
  return { apiUrl, publishableKey }
}

export function previousLearningPages(xml = '') {
  return Array.from(xml.matchAll(/<url>\s*([\s\S]*?)<\/url>/g)).flatMap(([, block]) => {
    const location = block.match(/<loc>([^<]+)<\/loc>/)?.[1]
    if (!location) return []
    try {
      const url = new URL(location.replaceAll('&amp;', '&'))
      if (url.protocol !== 'https:' || !['waiganichristiancollege.edu.pg', 'www.waiganichristiancollege.edu.pg'].includes(url.hostname)
        || url.port || url.search || url.hash || !url.pathname.startsWith('/learning/')) return []
      const slug = url.pathname.slice('/learning/'.length)
      if (!validSlug(slug)) return []
      return [{ slug, updated_at:block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1], published:true }]
    } catch { return [] }
  })
}

export function renderSitemap(pages = []) {
  const entries = new Map(staticPaths.map(path => [path, undefined]))
  for (const page of pages) {
    if (page.published !== true || !validSlug(page.slug)) continue
    const path = `/learning/${page.slug}`
    const lastmod = modifiedDate(page.updated_at)
    const previous = entries.get(path)
    entries.set(path, previous && (!lastmod || previous > lastmod) ? previous : lastmod)
  }
  const urls = Array.from(entries, ([path, lastmod]) =>
    `  <url><loc>${escapeXml(siteOrigin + path)}</loc>${lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : ''}</url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

export async function generateSitemap({ fetchImpl = globalThis.fetch, env = process.env, envText = '', previousXml = '', warn = console.warn } = {}) {
  const { apiUrl, publishableKey } = readPublicConfig(env, envText)
  const pages = []
  try {
    // Paginate instead of silently dropping pages beyond the Data API row limit.
    for (let offset = 0; ; offset += 1000) {
      const url = new URL('/rest/v1/learning_pages', apiUrl)
      url.search = new URLSearchParams({
        select:'slug,updated_at,published', published:'eq.true', order:'sort_order.asc,title.asc',
        limit:'1000', offset:String(offset),
      }).toString()
      const response = await fetchImpl(url, { headers:{ apikey:publishableKey }, signal:AbortSignal.timeout(10000) })
      if (!response.ok) throw new Error('Learning pages are unavailable')
      const batch = await response.json()
      if (!Array.isArray(batch)) throw new Error('Invalid learning page response')
      pages.push(...batch)
      if (batch.length < 1000) break
      if (offset >= 99000) throw new Error('Learning page response exceeded the sitemap limit')
    }
    return renderSitemap(pages)
  } catch {
    warn('Sitemap: published learning pages could not be loaded; using the last saved public page list.')
    return renderSitemap(previousLearningPages(previousXml))
  }
}

async function main() {
  const frontendDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const sitemapPath = resolve(frontendDirectory, 'public/sitemap.xml')
  const [envText, previousXml] = await Promise.all([
    readFile(resolve(frontendDirectory, '.env.production'), 'utf8').catch(() => ''),
    readFile(sitemapPath, 'utf8').catch(() => ''),
  ])
  const xml = await generateSitemap({ envText, previousXml })
  await writeFile(sitemapPath, xml)
  console.log(`Sitemap: wrote ${(xml.match(/<loc>/g) || []).length} public URLs.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`Sitemap generation failed: ${error.message}`); process.exitCode = 1 })
}
