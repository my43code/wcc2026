import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import campusImage from './assets/471375683_122111557094676720_8636929484856250894_n.jpg'
import facilitiesImage from './assets/IMG_0354.jpg'
import transportImage from './assets/IMG_0493.jpg'
import learningImage from './assets/Picture1.jpg'
import schoolLogo from './assets/WCC LOGO.png'
import nationalEmblem from './assets/National_emblem_of_Papua_New_Guinea.svg.png'

const programs = [
  { icon: '✦', title: 'Early Learning', ages: 'Ages 3–5', text: 'A joyful, play-led foundation that builds confidence, curiosity and belonging.' },
  { icon: '⌁', title: 'Primary School', ages: 'Grades 1–6', text: 'Strong literacy and numeracy, enriched by science, creativity and character.' },
  { icon: '◇', title: 'Secondary School', ages: 'Grades 7–12', text: 'Purposeful pathways, expert teaching and preparation for life beyond school.' },
]

type NewsItem = { id?: number; date: string; tag: string; title: string; text: string }
type SearchResult = { id:number; title:string; summary:string; category:string; event_date:string|null; promoted:boolean }

const defaultNews: NewsItem[] = [
  { date: '12 AUG', tag: 'Community', title: 'College Open Day 2026', text: 'Tour our campus, meet our teachers and see learning in action.' },
  { date: '22 AUG', tag: 'Student life', title: 'Culture & Arts Festival', text: 'An evening celebrating student performance, stories and creativity.' },
  { date: '05 SEP', tag: 'Sport', title: 'Inter-house Athletics', text: 'Our school community comes together for a day of energy and team spirit.' },
]

const heroSlides = [
  { image: campusImage, alt: 'Waigani Christian College students gathered on campus', position: '55% center' },
  { image: facilitiesImage, alt: 'Learning facilities at Waigani Christian College', position: 'center' },
  { image: learningImage, alt: 'Students learning together at Waigani Christian College', position: 'center' },
  { image: transportImage, alt: 'Waigani Christian College student transport and community', position: 'center' },
]

function Arrow() { return <span aria-hidden="true">↗</span> }

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const [news, setNews] = useState<NewsItem[]>(defaultNews)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [heroSlide, setHeroSlide] = useState(0)
  const [sliderPaused, setSliderPaused] = useState(false)

  useEffect(() => {
    document.body.style.overflow = formOpen || searchOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [formOpen, searchOpen])

  useEffect(() => {
    fetch('/api/posts').then(response => response.ok ? response.json() : Promise.reject()).then((posts: Array<{id:number;title:string;summary:string;category:string;event_date:string|null}>) => {
      const labels:Record<string,string> = {news_events:'News',early_learning:'Early learning',primary_school:'Primary',secondary_school:'Secondary',student_life:'Student life'}
      const months=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
      setNews(posts.slice(0,6).map(post => { const date=post.event_date?new Date(`${post.event_date}T00:00:00`):new Date(); return {id:post.id,date:`${String(date.getDate()).padStart(2,'0')} ${months[date.getMonth()]}`,tag:labels[post.category]||'College',title:post.title,text:post.summary} }))
    }).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (sliderPaused) return
    const timer = window.setInterval(() => setHeroSlide(current => (current + 1) % heroSlides.length), 5500)
    return () => window.clearInterval(timer)
  }, [sliderPaused])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const response = await fetch('/api/enquiries', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name:data.get('name'), email:data.get('email'), year_level:data.get('year_level'), message:data.get('message') }) })
    if (response.ok) setSent(true)
  }

  const runSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (searchQuery.trim().length < 2) return
    setSearching(true)
    try { const response=await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`); setSearchResults(response.ok?await response.json():[]) } finally { setSearching(false) }
  }

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="site-shell">
      <div className="announcement">
        <p>Enrolments for 2027 are now open</p>
        <button onClick={() => setFormOpen(true)}>Begin your journey <Arrow /></button>
      </div>

      <header className="header">
        <a className="brand" href="#home" aria-label="Waigani Christian College home" onClick={closeMenu}>
          <img className="brand-logo" src={schoolLogo} alt="Waigani Christian College crest" />
          <span><strong>Waigani Christian</strong><small>College · Papua New Guinea</small></span>
        </a>
        <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="Toggle navigation">
          <span></span><span></span>
        </button>
        <nav className={menuOpen ? 'nav open' : 'nav'} aria-label="Main navigation">
          <a href="#about" onClick={closeMenu}>Our school</a>
          <a href="#learning" onClick={closeMenu}>Learning</a>
          <a href="#life" onClick={closeMenu}>Student life</a>
          <a href="#news" onClick={closeMenu}>News & events</a>
          <button className="search-button" onClick={() => { setSearchOpen(true); closeMenu() }} aria-label="Search website">⌕ <span>Search</span></button>
          <button className="nav-cta" onClick={() => { setFormOpen(true); closeMenu() }}>Enquire now</button>
        </nav>
      </header>

      <main>
        <section className="hero-section" id="home">
          <div className="hero-content">
            <p className="eyebrow light">Welcome to Waigani Christian College</p>
            <h1>Every child has<br />a story worth <em>shaping.</em></h1>
            <p className="hero-copy">We are a caring, ambitious school where young people are known, challenged and inspired to make a meaningful difference.</p>
            <div className="hero-actions">
              <button className="button gold" onClick={() => setFormOpen(true)}>Explore enrolment <Arrow /></button>
              <a href="#about" className="text-link light">Discover our school <span>↓</span></a>
            </div>
          </div>
          <div className="hero-art photo-art" role="region" aria-roledescription="carousel" aria-label="College highlights" onMouseEnter={() => setSliderPaused(true)} onMouseLeave={() => setSliderPaused(false)} onFocus={() => setSliderPaused(true)} onBlur={() => setSliderPaused(false)}>
            <div className="hero-slides" aria-live="polite">
              {heroSlides.map((slide, index) => <div key={slide.image} className={index === heroSlide ? 'hero-slide active' : 'hero-slide'} style={{ backgroundImage: `url(${slide.image})`, backgroundPosition: slide.position }} role="img" aria-label={slide.alt} aria-hidden={index !== heroSlide} />)}
            </div>
            <div className="hero-badge"><strong>25+</strong><span>years of<br />growing minds</span></div>
            <div className="slider-controls">
              <button onClick={() => setHeroSlide(current => (current - 1 + heroSlides.length) % heroSlides.length)} aria-label="Previous image">&#8592;</button>
              <div className="slider-dots">{heroSlides.map((_, index) => <button key={index} className={index === heroSlide ? 'active' : ''} onClick={() => setHeroSlide(index)} aria-label={`Show image ${index + 1}`} aria-current={index === heroSlide ? 'true' : undefined} />)}</div>
              <button onClick={() => setHeroSlide(current => (current + 1) % heroSlides.length)} aria-label="Next image">&#8594;</button>
            </div>
          </div>
          <div className="hero-stat"><strong>One community.</strong><span>Endless possibility.</span></div>
        </section>

        <section className="intro section" id="about">
          <div className="intro-heading">
            <p className="eyebrow">Our promise</p>
            <h2>Known by name.<br /><em>Ready for tomorrow.</em></h2>
          </div>
          <div className="intro-copy">
            <p>At Waigani Christian College, education is more than achievement. It is the discovery of purpose, the courage to think deeply and the character to serve others.</p>
            <p>Our students learn in an inclusive community grounded in strong values, high expectations and genuine care.</p>
            <a href="#values" className="text-link">Meet our community <Arrow /></a>
          </div>
        </section>

        <section className="program-section section" id="learning">
          <div className="section-topline">
            <div><p className="eyebrow">Learning at Waigani Christian College</p><h2>A pathway for<br /><em>every stage.</em></h2></div>
            <p>From first discoveries to future pathways, learning is designed around the needs and potential of each student.</p>
          </div>
          <div className="program-grid">
            {programs.map((program, index) => (
              <article className="program-card" key={program.title}>
                <span className="card-number">0{index + 1}</span>
                <span className="program-icon">{program.icon}</span>
                <p className="program-age">{program.ages}</p>
                <h3>{program.title}</h3>
                <p>{program.text}</p>
                <a href="#contact" aria-label={`Learn about ${program.title}`}><Arrow /></a>
              </article>
            ))}
          </div>
        </section>

        <section className="values-section" id="values">
          <div className="values-visual photo-values" style={{ backgroundImage: `url(${learningImage})` }}>
            <div className="quote-card"><span>“</span><p>They don’t just teach us what to think. They teach us how to think.</p><small>— College student, Grade 10</small></div>
          </div>
          <div className="values-content">
            <p className="eyebrow light">Our difference</p>
            <h2>Character lives<br />in the <em>everyday.</em></h2>
            <p>Our values are visible in the way we learn, lead and care for one another.</p>
            <div className="value-list">
              <div><strong>01</strong><span><b>Wisdom</b><small>Think deeply. Stay curious.</small></span></div>
              <div><strong>02</strong><span><b>Character</b><small>Act with courage and integrity.</small></span></div>
              <div><strong>03</strong><span><b>Community</b><small>Belong, contribute and serve.</small></span></div>
            </div>
          </div>
        </section>

        <section className="life-section section" id="life">
          <div className="life-title"><p className="eyebrow">Beyond the classroom</p><h2>More ways to<br /><em>find your place.</em></h2></div>
          <div className="life-grid">
            <div className="life-card sport photo-card" style={{ backgroundImage: `url(${campusImage})` }}><span>COMMUNITY</span><h3>Belong together</h3></div>
            <div className="life-card arts photo-card" style={{ backgroundImage: `url(${facilitiesImage})` }}><span>OUR CAMPUS</span><h3>A place to thrive</h3></div>
            <div className="life-card service photo-card" style={{ backgroundImage: `url(${transportImage})` }}><span>STUDENT CARE</span><h3>Connected to community</h3></div>
          </div>
        </section>

        <section className="news-section section" id="news">
          <div className="news-heading"><div><p className="eyebrow">What’s happening</p><h2>Life at <em>Waigani.</em></h2></div><a href="#news" className="text-link">View all news <Arrow /></a></div>
          <div className="news-list">
            {news.map(item => <article key={item.title}><div className="date"><strong>{item.date.split(' ')[0]}</strong><span>{item.date.split(' ')[1]}</span></div><div className="news-copy"><small>{item.tag}</small><h3>{item.title}</h3><p>{item.text}</p></div><span className="round-arrow"><Arrow /></span></article>)}
          </div>
        </section>

        <section className="cta-section" id="contact">
          <p className="eyebrow light">Your next chapter</p>
          <h2>Come and see what<br /><em>makes Waigani different.</em></h2>
          <p>The best way to know our school is to experience it. We would love to welcome your family.</p>
          <div><button className="button gold" onClick={() => setFormOpen(true)}>Book a school tour <Arrow /></button><a href="tel:+67500000000" className="text-link light">Call our team</a></div>
        </section>
      </main>

      <footer>
        <div className="footer-main"><div className="footer-brand"><a className="brand" href="#home"><img className="brand-logo" src={schoolLogo} alt="Waigani Christian College crest" /><span><strong>Waigani Christian</strong><small>College · Papua New Guinea</small></span></a><p>Growing minds, shaping character and building community.</p></div><div><h4>Explore</h4><a href="#about">Our school</a><a href="#learning">Learning</a><a href="#life">Student life</a><a href="#news">News & events</a></div><div className="footer-visit"><img className="national-emblem" src={nationalEmblem} alt="National emblem of Papua New Guinea" /><div><h4>Visit us</h4><p>Waigani Campus<br />Papua New Guinea</p><a href="mailto:enquiries@wcc.edu.pg">enquiries@wcc.edu.pg</a><a href="tel:+67500000000">+675 0000 0000</a></div></div></div>
        <div className="footer-bottom"><span>© 2026 Waigani Christian College. All rights reserved.</span><span className="footer-utility">Privacy · Policies <a href="/admin">Admin login →</a></span></div>
      </footer>

      <nav className="mobile-quickbar" aria-label="Quick actions">
        <a href="#home" aria-label="Back to homepage"><span aria-hidden="true">&#8962;</span>Home</a>
        <a href="tel:+67500000000" aria-label="Call the college"><span aria-hidden="true">&#9742;</span>Call</a>
        <button onClick={() => setFormOpen(true)}><span aria-hidden="true">&#9993;</span>Enquire</button>
      </nav>

      {formOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setFormOpen(false)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="form-title" onMouseDown={e => e.stopPropagation()}><button className="modal-close" onClick={() => setFormOpen(false)} aria-label="Close">×</button>{sent ? <div className="success"><span>✓</span><h2>Thank you.</h2><p>Our enrolments team will be in touch shortly.</p><button className="button navy" onClick={() => { setFormOpen(false); setSent(false) }}>Done</button></div> : <><p className="eyebrow">Start a conversation</p><h2 id="form-title">Enquire about Waigani Christian College</h2><p>Tell us a little about your family and our team will contact you.</p><form onSubmit={submit}><label>Parent or carer name<input required name="name" autoFocus /></label><label>Email address<input required type="email" name="email" /></label><label>Student year level<select name="year_level" required defaultValue=""><option value="" disabled>Select a year level</option><option>Early Learning</option><option>Primary School</option><option>Secondary School</option></select></label><label>Message <span>(optional)</span><textarea name="message" rows={3}></textarea></label><button className="button navy" type="submit">Send enquiry <Arrow /></button></form></>}</div></div>}

      {searchOpen && <div className="search-backdrop" onMouseDown={() => setSearchOpen(false)}><section className="search-panel" role="dialog" aria-modal="true" aria-labelledby="search-title" onMouseDown={event=>event.stopPropagation()}><button className="search-close" onClick={()=>setSearchOpen(false)} aria-label="Close search">×</button><p className="eyebrow">Find it quickly</p><h2 id="search-title">Search the college</h2><form onSubmit={runSearch}><input value={searchQuery} onChange={event=>setSearchQuery(event.target.value)} placeholder="Search news, events and school areas…" autoFocus/><button type="submit">Search →</button></form><div className="search-results">{searching?<p>Searching…</p>:searchResults.length>0?searchResults.map(result=><a key={result.id} href="#news" onClick={()=>setSearchOpen(false)}><small>{result.category.replaceAll('_',' ')}</small><strong>{result.title}{result.promoted&&<b>Featured</b>}</strong><span>{result.summary}</span></a>):searchQuery.length>1?<p>No matching information found.</p>:<p>Enter at least two letters to search published information.</p>}</div></section></div>}
    </div>
  )
}

export default App
