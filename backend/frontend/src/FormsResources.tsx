import { useMemo, useState } from 'react'
import type { Resource, ResourceCategory } from './resources'
import { formatResourceSize, getResourceDownloadUrl, resourceCategories } from './resources'
import './FormsResources.css'

type Props = {resources:Resource[]; loading:boolean; error:string; onRetry:()=>void; onEnquire:()=>void}
type Category = ResourceCategory|'all'

function initialCategory():Category {
  const value = new URLSearchParams(window.location.search).get('category')
  return value && Object.hasOwn(resourceCategories,value) ? value as ResourceCategory : 'all'
}

function ResourceCard({resource}:{resource:Resource}) {
  const [downloading,setDownloading] = useState(false)
  const [error,setError] = useState('')
  const extension = resource.file_name.includes('.') ? resource.file_name.split('.').pop()?.toUpperCase() : 'FILE'
  const timestamp = resource.updated_at || resource.created_at
  const date = timestamp && !Number.isNaN(Date.parse(timestamp)) ? new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'Australia/Sydney'}).format(new Date(timestamp)) : null

  async function download() {
    setDownloading(true); setError('')
    try {
      const url = await getResourceDownloadUrl(resource,{download:true})
      const link = document.createElement('a')
      link.href = url; link.download = resource.file_name; link.rel = 'noopener'
      document.body.appendChild(link); link.click(); link.remove()
    } catch(problem) {
      setError(problem instanceof Error ? problem.message : 'This download is unavailable. Please try again shortly.')
    } finally { setDownloading(false) }
  }

  return <article className="document-card">
    <div className="document-card-top"><span className="document-format" aria-label={`File format ${extension}`}>{extension}</span><span className="document-category">{resourceCategories[resource.category]}</span></div>
    <h3>{resource.title}</h3>{resource.description && <p className="document-description">{resource.description}</p>}
    <dl className="document-metadata"><div><dt>File size</dt><dd>{formatResourceSize(resource.file_size)}</dd></div>{date && <div><dt>Updated</dt><dd>{date}</dd></div>}</dl>
    <p className="document-filename" title={resource.file_name}>{resource.file_name}</p>
    {error && <p className="document-download-error" role="alert">{error}</p>}
    <button className="document-download" type="button" onClick={()=>void download()} disabled={downloading} aria-label={`${downloading?'Preparing':'Download'} ${resource.title}`} aria-busy={downloading}>{downloading?'Preparing download…':'Download document'}<span aria-hidden="true">↓</span></button>
  </article>
}

export default function FormsResources({resources,loading,error,onRetry,onEnquire}:Props) {
  const [category,setCategory] = useState<Category>(initialCategory)
  const [query,setQuery] = useState(()=>new URLSearchParams(window.location.search).get('q') || '')
  const [sort,setSort] = useState('recommended')
  const filtered = useMemo(()=>{
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
    const matches = resources.filter(resource=>(category==='all' || resource.category===category) && terms.every(term=>`${resource.title} ${resource.description} ${resource.file_name} ${resourceCategories[resource.category]}`.toLocaleLowerCase().includes(term)))
    if (sort==='title') matches.sort((a,b)=>a.title.localeCompare(b.title))
    if (sort==='latest') matches.sort((a,b)=>(Date.parse(b.updated_at || b.created_at || '') || 0)-(Date.parse(a.updated_at || a.created_at || '') || 0) || a.title.localeCompare(b.title))
    return matches
  },[resources,category,query,sort])

  function changeCategory(next:Category) {
    setCategory(next)
    const params = new URLSearchParams(window.location.search)
    if (next==='all') params.delete('category'); else params.set('category',next)
    window.history.replaceState({},'',`${window.location.pathname}${params.size?'?'+params.toString():''}`)
  }
  function clearFilters() {
    setCategory('all'); setQuery('')
    const params = new URLSearchParams(window.location.search)
    params.delete('category'); params.delete('q')
    window.history.replaceState({},'',`${window.location.pathname}${params.size?'?'+params.toString():''}`)
  }

  return <>
    <section className="document-hub-hero section">
      <div><p className="eyebrow">Information for families & learners</p><h1>Forms &amp;<br/><em>resources.</em></h1><p>Find school fee structures, application forms, policies and curriculum documents in one place.</p><a className="text-link" href="#document-library">Browse the document library <span aria-hidden="true">↓</span></a></div>
      <div className="document-hub-panel"><span className="document-hub-mark" aria-hidden="true">↘</span><p>Plan your next step.</p><h2>The information<br/>you need, <em>together.</em></h2><div><a href="#document-library" onClick={()=>changeCategory('fees')}>School fee structures <span aria-hidden="true">↗</span></a><a href="#document-library" onClick={()=>changeCategory('application')}>Application forms <span aria-hidden="true">↗</span></a></div></div>
    </section>
    <section className="document-library section" id="document-library" aria-labelledby="document-library-title">
      <div className="document-library-heading"><div><p className="eyebrow">School document library</p><h2 id="document-library-title">Find your <em>document.</em></h2></div><p>Search by title or choose a category. Need something else? Our team can help.</p></div>
      <div className="document-tools"><label className="document-search">Search documents<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search fees, forms, policies…" aria-controls="document-results"/></label><label className="document-sort">Sort documents<select value={sort} onChange={event=>setSort(event.target.value)}><option value="recommended">Recommended order</option><option value="latest">Recently updated</option><option value="title">Title A–Z</option></select></label></div>
      <div className="document-filters" role="group" aria-label="Filter documents by category"><button type="button" aria-pressed={category==='all'} aria-controls="document-results" onClick={()=>changeCategory('all')}>All resources <span>{resources.length}</span></button>{Object.entries(resourceCategories).map(([value,label])=><button key={value} type="button" aria-pressed={category===value} aria-controls="document-results" onClick={()=>changeCategory(value as ResourceCategory)}>{label} <span>{resources.filter(resource=>resource.category===value).length}</span></button>)}</div>
      <div id="document-results" aria-busy={loading}>
        {loading ? <p className="document-status" role="status">Loading documents…</p> : error ? <div className="document-status document-status-error" role="alert"><h3>Documents could not be loaded.</h3><p>Please try again, or contact the college for the information you need.</p><button type="button" onClick={onRetry}>Try again</button></div> : <>
          <p className="document-results-count" role="status" aria-live="polite">{filtered.length} {filtered.length===1?'document':'documents'}{category!=='all'?` in ${resourceCategories[category]}`:''}{query.trim()?` matching “${query.trim()}”`:''}</p>
          {filtered.length>0 ? <div className="document-grid">{filtered.map(resource=><ResourceCard key={resource.id} resource={resource}/>)}</div> : <div className="document-status"><span className="document-empty-mark" aria-hidden="true">↓</span><h3>{resources.length===0?'No documents available yet.':query.trim()?'No matching documents.':`No ${resourceCategories[category as ResourceCategory] || 'matching'} documents available yet.`}</h3><p>{resources.length===0?'Please check back soon, or contact our team for school documents and information.':'Try another category or search term, or ask our team for help.'}</p>{resources.length>0 && <button type="button" onClick={clearFilters}>Clear filters</button>}<button className="document-contact" type="button" onClick={onEnquire}>Contact the college <span aria-hidden="true">↗</span></button></div>}
        </>}
      </div>
    </section>
    <section className="document-help section"><div><p className="eyebrow light">We are here to help</p><h2>Looking for<br/><em>something else?</em></h2></div><div><p>Ask our team about a document, the application process or your next step at Waigani Christian College.</p><button className="button gold" type="button" onClick={onEnquire}>Make an enquiry <span aria-hidden="true">↗</span></button></div></section>
  </>
}

export function FormsResourcesAccess({resources,loading,error,compact=false}:{resources:Resource[];loading:boolean;error:string;compact?:boolean}) {
  const latest = [...resources].sort((a,b)=>(Date.parse(b.updated_at || b.created_at || '') || 0)-(Date.parse(a.updated_at || a.created_at || '') || 0))[0]
  return <section className={`forms-access section${compact?' forms-access-compact':''}`} id="forms-resources"><div className="forms-access-copy"><p className="eyebrow">Forms & resources</p><h2>{compact?<>Information for<br/><em>your next step.</em></>:<>A little planning.<br/><em>A confident next step.</em></>}</h2><p>Find fee structures, application forms, policies and curriculum documents in our school document library.</p><a className="text-link" href="/forms-resources">Explore forms & resources <span aria-hidden="true">↗</span></a>{!loading && !error && resources.length>0 && <p className="forms-access-count">{resources.length} {resources.length===1?'document':'documents'} available{latest && <> · Latest: <a href={`/forms-resources?q=${encodeURIComponent(latest.title)}`}>{latest.title}</a></>}</p>}</div><div className="forms-access-links"><a href="/forms-resources?category=fees"><span>01</span><div><small>Plan ahead</small><h3>School fees</h3></div><b aria-hidden="true">↗</b></a><a href="/forms-resources?category=application"><span>02</span><div><small>Take the next step</small><h3>Application forms</h3></div><b aria-hidden="true">↗</b></a></div></section>
}
