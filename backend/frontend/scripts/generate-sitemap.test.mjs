import test from 'node:test'
import assert from 'node:assert/strict'
import { generateSitemap, previousLearningPages, readPublicConfig, renderSitemap, siteOrigin } from './generate-sitemap.mjs'

test('renders only valid published learning pages, deduplicated with the latest date', () => {
  const xml = renderSitemap([
    { slug:'fode/grade-10-upgrading', published:true, updated_at:'2026-11-15T10:30:00Z' },
    { slug:'fode/grade-10-upgrading', published:true, updated_at:'2026-11-16T00:00:00Z' },
    { slug:'fode/grade-12-upgrading', published:false },
    { slug:'fode/<script>', published:true },
    { slug:'../admin', published:true },
    { slug:'other-pathway', published:true },
  ])
  assert.equal((xml.match(/\/learning\/fode\/grade-10-upgrading/g) || []).length, 1)
  assert.match(xml, /<lastmod>2026-11-16<\/lastmod>/)
  assert.ok(!xml.includes('grade-12-upgrading'))
  assert.ok(!xml.includes('<script>'))
  assert.ok(!xml.includes(`${siteOrigin}/admin</loc>`))
  assert.ok(!xml.includes(`${siteOrigin}/admin/`))
  assert.ok(xml.includes(`${siteOrigin}/forms-resources`))
  assert.ok(xml.includes(`${siteOrigin}/sitemap`))
  assert.ok(!xml.includes('https://www.'))
})

test('queries only published pages with a public key and removes old unpublished URLs', async () => {
  const previousXml = renderSitemap([{ slug:'fode/old-page', published:true }])
  const calls = []
  const xml = await generateSitemap({ env:{}, previousXml, fetchImpl:async (url, options) => {
    calls.push({ url, options })
    return { ok:true, json:async () => [] }
  } })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url.searchParams.get('published'), 'eq.true')
  assert.match(calls[0].options.headers.apikey, /^sb_publishable_/)
  assert.ok(!xml.includes('/learning/fode/old-page'))
})

test('offline fallback keeps only safe learning URLs from the saved sitemap', async () => {
  const previousXml = '<urlset>'
    + '<url><loc>https://www.waiganichristiancollege.edu.pg/learning/fode/grade-12-upgrading</loc><lastmod>2026-11-15</lastmod></url>'
    + '<url><loc>https://evil.example/learning/fode/attack</loc></url>'
    + '<url><loc>https://waiganichristiancollege.edu.pg/admin</loc></url>'
    + '<url><loc>https://waiganichristiancollege.edu.pg/learning/fode/%2fadmin</loc></url>'
    + '</urlset>'
  const warnings = []
  const xml = await generateSitemap({ env:{}, previousXml, fetchImpl:async () => { throw new Error('offline') }, warn:message => warnings.push(message) })
  assert.equal(warnings.length, 1)
  assert.ok(xml.includes(`${siteOrigin}/learning/fode/grade-12-upgrading`))
  assert.match(xml, /<lastmod>2026-11-15<\/lastmod>/)
  assert.ok(!xml.includes('evil.example'))
  assert.ok(!xml.includes(`${siteOrigin}/admin</loc>`))
  assert.ok(!xml.includes(`${siteOrigin}/admin/`))
  assert.equal(previousLearningPages(previousXml).length, 1)
})

test('uses hosting public configuration and never accepts a secret key', () => {
  assert.deepEqual(readPublicConfig({ VITE_SUPABASE_URL:'https://project.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_example' }), {
    apiUrl:'https://project.supabase.co', publishableKey:'sb_publishable_example',
  })
  const config = readPublicConfig({ VITE_SUPABASE_PUBLISHABLE_KEY:'sb_secret_should_not_be_used' }, 'VITE_SUPABASE_URL="https://file.supabase.co"\n')
  assert.equal(config.apiUrl, 'https://file.supabase.co')
  assert.match(config.publishableKey, /^sb_publishable_/)
  assert.ok(!config.publishableKey.includes('secret'))
})

test('reads the next API batch rather than truncating larger page lists', async () => {
  const offsets = []
  const xml = await generateSitemap({ env:{}, fetchImpl:async url => {
    const offset = url.searchParams.get('offset')
    offsets.push(offset)
    return { ok:true, json:async () => offset === '0'
      ? Array.from({ length:1000 }, () => ({ slug:'fode', published:true }))
      : [{ slug:'fode/additional-page', published:true }] }
  } })
  assert.deepEqual(offsets, ['0', '1000'])
  assert.ok(xml.includes(`${siteOrigin}/learning/fode/additional-page`))
})
