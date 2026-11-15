import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { NewsItem } from './news'
import './NewsCarousel.css'

const filters = [
  {value:'all', label:'All updates', href:'/learning'},
  {value:'early_learning', label:'Early Learning', href:'/learning/early-learning'},
  {value:'primary_school', label:'Primary School', href:'/learning/primary-school'},
  {value:'secondary_school', label:'Secondary School', href:'/learning/secondary-school'},
  {value:'fode', label:'FODE upgrading', href:'/learning/fode'},
] as const

type Filter = typeof filters[number]['value']
type NewsCardProps = {item:NewsItem; onRead:(item:NewsItem)=>void; onShare:(item:NewsItem)=>void}
type Props = {
  items:NewsItem[]
  loading:boolean
  error:boolean
  paused:boolean
  onRead:(item:NewsItem)=>void
  onShare:(item:NewsItem)=>void
}

export function NewsCard({item,onRead,onShare}:NewsCardProps) {
  const href = item.id ? `/news-events?story=${item.id}` : '/news-events'
  return <article className="news-card news-update-card" data-news-slide>
    <a className="news-card-open" href={href} onClick={event=>{
      if (event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault(); onRead(item)
    }} aria-label={`Read ${item.title}`}>
      <div className="news-card-media">
        {item.media_url ? item.media_type==='video'
          ? <video src={item.media_url} preload="metadata" muted playsInline aria-hidden="true"/>
          : <img src={item.media_url} alt="" loading="lazy" decoding="async"/>
          : <div className="news-card-placeholder" aria-hidden="true"><span>WCC</span></div>}
        <div className="date" aria-label={item.date}><strong>{item.date.split(' ')[0]}</strong><span>{item.date.split(' ')[1]}</span></div>
        {item.media_type==='video'&&<span className="media-badge">Video</span>}
      </div>
      <div className="news-copy"><small>{item.tag}</small><h3>{item.title}</h3><p>{item.text}</p><span className="news-read-hint" aria-hidden="true">Read update <span>↗</span></span></div>
    </a>
    <div className="news-update-actions"><button type="button" onClick={()=>onShare(item)} aria-label={`Share ${item.title}`}>Share update <span aria-hidden="true">↗</span></button></div>
  </article>
}

export default function NewsCarousel({items,loading,error,paused,onRead,onShare}:Props) {
  const [filter,setFilter] = useState<Filter>('all')
  const [userPaused,setUserPaused] = useState(false)
  const [hovered,setHovered] = useState(false)
  const [focused,setFocused] = useState(false)
  const [visible,setVisible] = useState(false)
  const [pageVisible,setPageVisible] = useState(!document.hidden)
  const [reducedMotion,setReducedMotion] = useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [position,setPosition] = useState({first:0,shown:1,atStart:true,atEnd:true,canSlide:false})
  const sectionRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const trackId = useId()
  const filtered = useMemo(()=>filter==='all' ? items : items.filter(item=>item.category===filter),[filter,items])
  const currentFilter = filters.find(item=>item.value===filter)!

  const updatePosition = useCallback(()=>{
    const track = trackRef.current
    if (!track) return
    const cards = Array.from(track.querySelectorAll<HTMLElement>('[data-news-slide]'))
    if (!cards.length) return
    const firstLeft = cards[0].offsetLeft
    const step = cards.length>1 ? cards[1].offsetLeft-firstLeft : cards[0].offsetWidth
    const first = step>0 ? Math.max(0,Math.min(cards.length-1,Math.round(track.scrollLeft/step))) : 0
    const gap = cards.length>1 ? step-cards[0].offsetWidth : 0
    const shown = Math.max(1,Math.floor((track.clientWidth+gap+1)/Math.max(1,step)))
    const max = track.scrollWidth-track.clientWidth
    setPosition({first,shown,atStart:track.scrollLeft<=2,atEnd:track.scrollLeft>=max-2,canSlide:max>2})
  },[])

  useEffect(()=>{
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onMotion = ()=>setReducedMotion(media.matches)
    const onVisibility = ()=>setPageVisible(!document.hidden)
    media.addEventListener('change',onMotion)
    document.addEventListener('visibilitychange',onVisibility)
    const observer = new IntersectionObserver(entries=>setVisible(entries[0]?.isIntersecting || false),{threshold:0.2})
    if (sectionRef.current) observer.observe(sectionRef.current)
    return ()=>{ media.removeEventListener('change',onMotion); document.removeEventListener('visibilitychange',onVisibility); observer.disconnect() }
  },[])

  useEffect(()=>{
    const track = trackRef.current
    if (!track) return
    track.scrollTo({left:0,behavior:'instant'})
    updatePosition()
    const observer = new ResizeObserver(updatePosition)
    observer.observe(track)
    for (const card of track.querySelectorAll('[data-news-slide]')) observer.observe(card)
    return ()=>observer.disconnect()
  },[filtered,loading,error,updatePosition])

  const move = useCallback((direction:1|-1,automatic=false)=>{
    const track = trackRef.current
    if (!track) return
    if (!automatic) setUserPaused(true)
    const card = track.querySelector<HTMLElement>('[data-news-slide]')
    const next = card?.nextElementSibling as HTMLElement|null
    const step = card ? (next ? next.offsetLeft-card.offsetLeft : card.offsetWidth) : track.clientWidth
    const max = track.scrollWidth-track.clientWidth
    const target = automatic && track.scrollLeft>=max-2 ? 0 : Math.max(0,Math.min(max,track.scrollLeft+direction*step))
    track.scrollTo({left:target,behavior:reducedMotion?'instant':'smooth'})
  },[reducedMotion])

  useEffect(()=>{
    if (loading || error || filtered.length<2 || !position.canSlide || userPaused || reducedMotion || hovered || focused || paused || !visible || !pageVisible) return
    const timer = window.setInterval(()=>move(1,true),6000)
    return ()=>window.clearInterval(timer)
  },[loading,error,filtered.length,position.canSlide,userPaused,reducedMotion,hovered,focused,paused,visible,pageVisible,move])

  function onTrackKey(event:KeyboardEvent<HTMLDivElement>) {
    if (event.target!==event.currentTarget) return
    if (event.key==='ArrowLeft' || event.key==='ArrowRight') { event.preventDefault(); move(event.key==='ArrowRight'?1:-1) }
  }

  return <section ref={sectionRef} className="news-section news-carousel section" id="news" aria-labelledby={titleId}
    onFocusCapture={()=>setFocused(true)}
    onBlurCapture={event=>{if (!event.currentTarget.contains(event.relatedTarget as Node|null)) setFocused(false)}}>
    <div className="news-heading"><div><p className="eyebrow">From early learning to upgrading</p><h2 id={titleId}>News &amp; <em>updates.</em></h2></div><a href="/news-events" className="text-link">View all updates <span aria-hidden="true">↗</span></a></div>
    <div className="news-carousel-filters" role="group" aria-label="Filter news by learning area">{filters.map(item=><button key={item.value} type="button" aria-pressed={filter===item.value} aria-controls={trackId} onClick={()=>{setFilter(item.value);setUserPaused(true)}}>{item.label}</button>)}</div>
    {loading ? <p className="news-carousel-message" role="status">Loading the latest updates…</p>
      : error ? <p className="news-carousel-message" role="status">Updates could not be loaded. Please try again shortly.</p>
      : filtered.length===0 ? <div className="news-carousel-message" role="status"><p>{filter==='all'?'No updates have been published yet.':`No ${currentFilter.label} updates have been published yet.`}</p><a href={currentFilter.href}>Explore {filter==='all'?'our learning pathways':currentFilter.label} <span aria-hidden="true">↗</span></a></div>
      : <>
        <div ref={trackRef} className="news-carousel-track" id={trackId} role="region" aria-roledescription="carousel" aria-label="News and updates slides" tabIndex={0}
          onScroll={updatePosition} onKeyDown={onTrackKey} onPointerDown={()=>setUserPaused(true)}
          onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
          onFocusCapture={event=>{(event.target as HTMLElement).closest<HTMLElement>('[data-news-slide]')?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'})}}>
          {filtered.map(item=><NewsCard key={item.id??item.title} item={item} onRead={onRead} onShare={onShare}/>)}
        </div>
        <div className="news-carousel-controls">
          <p className="news-carousel-position">{position.first+1}–{Math.min(filtered.length,position.first+position.shown)} <span>of {filtered.length} updates</span></p>
          <div className="news-carousel-buttons">
            {!reducedMotion && position.canSlide && <button className="news-carousel-autoplay" type="button" aria-pressed={userPaused} aria-label={userPaused?'Play automatic sliding':'Pause automatic sliding'} onClick={()=>{if (userPaused) setFocused(false);setUserPaused(value=>!value)}}><span aria-hidden="true">{userPaused?'▶':'Ⅱ'}</span>{userPaused?'Play slides':'Pause slides'}</button>}
            <button className="news-carousel-arrow" type="button" aria-label="Previous updates" aria-controls={trackId} disabled={position.atStart} onClick={()=>move(-1)}><span aria-hidden="true">←</span></button>
            <button className="news-carousel-arrow" type="button" aria-label="Next updates" aria-controls={trackId} disabled={position.atEnd} onClick={()=>move(1)}><span aria-hidden="true">→</span></button>
          </div>
        </div>
        <p className="news-carousel-help">Swipe or use the arrows to browse. Select a card to read the full update.</p>
      </>}
  </section>
}
