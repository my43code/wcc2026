import type { LearningPage } from './learning'
import { learningCategories, learningPageHref } from './learning'
import './SiteMap.css'

export default function SiteMap({pages,loading,error}:{pages:LearningPage[];loading:boolean;error:boolean}) {
  return <>
    <section className="site-map-heading section"><p className="eyebrow">Website directory</p><h1>Find your<br/><em>way around.</em></h1><p>Explore our school, learning pathways, updates and useful documents.</p></section>
    <section className="site-map-tree section" aria-label="Visual website map">
      <a className="site-map-root" href="/"><span className="site-map-home-icon" aria-hidden="true">⌂</span><span><small>Start here</small><strong>Waigani Christian College</strong><em>Homepage</em></span><b aria-hidden="true">↗</b></a>
      <div className="site-map-branches">
        <section className="site-map-branch"><div className="site-map-branch-heading"><span>01</span><h2>Our college</h2></div><nav aria-label="College pages"><ul><li><a href="/about-us">About us <span aria-hidden="true">↗</span></a><ul><li><a href="/about-us#vision">Our vision</a></li><li><a href="/about-us#mission">Our mission</a></li></ul></li><li><a href="/our-school">Our school <span aria-hidden="true">↗</span></a></li><li><a href="/student-life">Student life <span aria-hidden="true">↗</span></a></li><li><a href="/administration-staff">Administration & staff <span aria-hidden="true">↗</span></a></li><li><a href="/career-opportunities">Career opportunities <span aria-hidden="true">↗</span></a></li><li><a href="/news-events">News & events <span aria-hidden="true">↗</span></a></li><li><a href="/#contact">Contact the college <span aria-hidden="true">↗</span></a></li></ul></nav></section>
        <section className="site-map-branch site-map-learning"><div className="site-map-branch-heading"><span>02</span><h2>Learning pathways</h2></div><nav aria-label="Learning pages"><ul><li><a href="/learning">Explore all learning <span aria-hidden="true">↗</span></a></li></ul>{loading?<p className="site-map-status" role="status">Loading learning pages…</p>:error?<p className="site-map-status" role="status">Additional learning pages could not be loaded. Visit Learning or try again shortly.</p>:<ul className="site-map-learning-groups">{Object.entries(learningCategories).map(([category,label])=>{
          const group = pages.filter(page=>page.category===category)
          if (!group.length) return null
          const overview = group.find(page=>!page.slug.includes('/'))
          const children = group.filter(page=>page.id!==overview?.id)
          return <li key={category}>{overview?<a href={learningPageHref(overview)}>{overview.title}<span aria-hidden="true">↗</span></a>:<strong className="site-map-group-label">{label}</strong>}{children.length>0 && <ul>{children.map(page=><li key={page.id}><a href={learningPageHref(page)}>{page.title}</a></li>)}</ul>}</li>
        })}</ul>}</nav>{!loading && !error && pages.length===0 && <p className="site-map-status">No additional learning pages are currently available.</p>}</section>
        <section className="site-map-branch site-map-documents"><div className="site-map-branch-heading"><span>03</span><h2>Forms & resources</h2></div><nav aria-label="Documents and resources"><ul><li><a href="/forms-resources">Document library <span aria-hidden="true">↗</span></a><ul><li><a href="/forms-resources?category=fees">School fees</a></li><li><a href="/forms-resources?category=application">Application forms</a></li><li><a href="/forms-resources?category=policy">Policies</a></li><li><a href="/forms-resources?category=curriculum">Curriculum documents</a></li><li><a href="/forms-resources?category=general">General resources</a></li></ul></li></ul></nav><div className="site-map-help"><p>Need a hand finding something?</p><a href="mailto:enquiries@waiganichristiancollege.edu.pg">Email our team <span aria-hidden="true">↗</span></a></div></section>
      </div>
    </section>
  </>
}
