import type { LearningPage as LearningPageRecord } from './learning'
import { learningCategories, learningPageHref } from './learning'

export type LearningStory = {
  id?:number; date:string; tag:string; title:string; text:string; body?:string;
  media_url?:string|null; media_type?:'image'|'video'|null;
  category?:string; learning_page_id?:number|null;
}

type Props = {
  page:LearningPageRecord|undefined;
  pages:LearningPageRecord[];
  loading:boolean;
  error:boolean;
  image:string;
  imageAlt:string;
  stories:LearningStory[];
  postsLoading:boolean;
  postsError:boolean;
  onEnquire:()=>void;
  onRead:(story:LearningStory)=>void;
  onShare:(story:LearningStory)=>void;
}

export default function LearningPageView({page,pages,loading,error,image,imageAlt,stories,postsLoading,postsError,onEnquire,onRead,onShare}:Props) {
  if (loading) return <section className="learning-page-status section" role="status"><p className="eyebrow">Learning at Waigani</p><h1>Loading learning page…</h1></section>
  if (error || !page) return <section className="learning-page-status section"><p className="eyebrow">Learning at Waigani</p><h1>{error?'Please try again shortly.':'Page unavailable.'}</h1><p>{error?'We could not load this learning page. Please refresh or contact the college.':'This learning page is not currently available. Explore our learning pathways or contact the college for more information.'}</p><a className="text-link" href="/learning">Explore our learning pathways ↗</a></section>

  const areaPages = pages.filter(item=>item.category===page.category)
  const overview = areaPages.find(item=>!item.slug.includes('/'))
  const otherPages = areaPages.filter(item=>item.id!==page.id && item.slug.includes('/'))

  return <>
    <section className="page-hero learning-detail-hero">
      <div className="page-hero-copy">
        <nav className="learning-breadcrumb" aria-label="Breadcrumb"><a href="/learning">Learning</a>{overview && overview.id!==page.id && <><span aria-hidden="true">/</span><a href={learningPageHref(overview)}>{learningCategories[page.category]}</a></>}<span aria-hidden="true">/</span><span aria-current="page">{page.title}</span></nav>
        <p className="eyebrow light">{page.eyebrow || learningCategories[page.category]}</p><h1>{page.title}</h1><p className="learning-hero-summary">{page.summary}</p>
        <button className="button gold learning-enquire" onClick={onEnquire}>Enquire about this pathway <span aria-hidden="true">↗</span></button>
      </div>
      <div className="page-hero-image" style={{backgroundImage:`url(${image})`}} role="img" aria-label={imageAlt}/>
    </section>
    <div className="learning-detail-layout section">
      <aside className="learning-area-sidebar"><p className="eyebrow">Explore {learningCategories[page.category]}</p><nav aria-label={`${learningCategories[page.category]} pages`}>{areaPages.map(item=><a key={item.id} href={learningPageHref(item)} aria-current={item.id===page.id?'page':undefined}>{item.title}<span aria-hidden="true">↗</span></a>)}</nav><a className="learning-all-pathways" href="/learning">← All learning pathways</a></aside>
      <div className="learning-page-content">
        {page.body && <section className="learning-page-body" aria-label={`About ${page.title}`}>{page.body.split(/\n\s*\n/).filter(Boolean).map((paragraph,index)=><p key={index}>{paragraph}</p>)}</section>}
        {otherPages.length>0 && <section className="learning-related-pages" aria-labelledby="learning-related-title"><p className="eyebrow">Continue exploring</p><h2 id="learning-related-title">Your next <em>step.</em></h2><div className="learning-subpage-grid">{otherPages.map(item=><a key={item.id} href={learningPageHref(item)}><span>{item.eyebrow || learningCategories[item.category]}</span><h3>{item.title}</h3><p>{item.summary}</p><b>Explore this page ↗</b></a>)}</div></section>}
      </div>
    </div>
    <section className="learning-updates section" id="learning-updates">
      <div className="news-heading"><div><p className="eyebrow">News & announcements</p><h2>Updates from <em>{page.title}.</em></h2></div><a className="text-link" href="/news-events">College news ↗</a></div>
      {postsLoading?<p className="learning-empty" role="status">Loading updates…</p>:postsError?<p className="learning-empty" role="status">Updates could not be loaded. Please try again shortly.</p>:stories.length===0?<p className="learning-empty">No updates yet. Please check back soon.</p>:<div className="news-list">{stories.map(item=><article className="news-card" key={item.id || item.title}>
        <div className="news-card-media">{item.media_url ? item.media_type==='video'?<video src={item.media_url} preload="metadata" muted aria-label={`Video preview for ${item.title}`}/>:<img src={item.media_url} alt="" loading="lazy" decoding="async"/>:<div className="news-card-placeholder" aria-hidden="true"><span>WCC</span></div>}<div className="date"><strong>{item.date.split(' ')[0]}</strong><span>{item.date.split(' ')[1]}</span></div>{item.media_type==='video'&&<span className="media-badge">Video</span>}</div>
        <div className="news-copy"><small>{item.tag}</small><h3>{item.title}</h3><p>{item.text}</p></div><div className="news-card-actions"><button className="view-story" type="button" onClick={()=>onRead(item)}>View more <span aria-hidden="true">↗</span></button><button className="share-story" type="button" onClick={()=>onShare(item)} aria-label={`Share ${item.title}`}>Share ↗</button></div>
      </article>)}</div>}
    </section>
  </>
}
