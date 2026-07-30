import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import schoolLogo from './assets/WCC LOGO.png'
import './Admin.css'

type Category = 'news_events' | 'early_learning' | 'primary_school' | 'secondary_school' | 'student_life'
type MediaFields = { media_url:string|null; media_type:'image'|'video'|null; media_path:string|null }
type Post = { id:number; title:string; summary:string; body:string; category:Category; event_date:string|null; published:boolean; promoted:boolean; created_at:string } & MediaFields
type PostEditor = Omit<Post,'id'|'created_at'|'event_date'> & { event_date:string }
type Enquiry = { id:number; name:string; email:string; year_level:string; message:string; status:'new'|'in_progress'|'resolved'; created_at:string }

const categories: Record<Category,string> = {
  news_events:'News & events', early_learning:'Early learning', primary_school:'Primary school',
  secondary_school:'Secondary school', student_life:'Student life',
}
const blankPost:PostEditor = { title:'', summary:'', body:'', category:'news_events', event_date:'', published:true, promoted:false, media_url:null, media_type:null, media_path:null }

async function api(path:string, options:RequestInit = {}) {
  const token = sessionStorage.getItem('wcc_admin_token')
  const headers = new Headers(options.headers)
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type','application/json')
  if (token) headers.set('Authorization',`Bearer ${token}`)
  const response = await fetch(path, { ...options, headers })
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail || 'Request failed')
  return response.status === 204 ? null : response.json()
}

export default function Admin() {
  const [authenticated,setAuthenticated] = useState(false)
  const [loading,setLoading] = useState(true)
  const [section,setSection] = useState<'overview'|'posts'|'enquiries'>('overview')
  const [posts,setPosts] = useState<Post[]>([])
  const [enquiries,setEnquiries] = useState<Enquiry[]>([])
  const [editor,setEditor] = useState(blankPost)
  const [editingId,setEditingId] = useState<number|null>(null)
  const [filter,setFilter] = useState<'all'|Category>('all')
  const [notice,setNotice] = useState('')
  const [mediaFile,setMediaFile] = useState<File|null>(null)
  const [saving,setSaving] = useState(false)

  const loadData = useCallback(async () => {
    const [postData,enquiryData] = await Promise.all([api('/api/posts?admin=true'),api('/api/enquiries')])
    setPosts(postData); setEnquiries(enquiryData)
  },[])

  useEffect(() => {
    api('/api/admin/me').then(() => { setAuthenticated(true); return loadData() }).catch(() => sessionStorage.removeItem('wcc_admin_token')).finally(() => setLoading(false))
  },[loadData])

  async function login(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice('')
    const data = new FormData(event.currentTarget)
    try {
      const result = await api('/api/auth/login',{method:'POST',body:JSON.stringify({username:data.get('username'),password:data.get('password')})})
      sessionStorage.setItem('wcc_admin_token',result.access_token); setAuthenticated(true); await loadData()
    } catch(error) { setNotice(error instanceof Error ? error.message : 'Unable to sign in') }
  }

  async function savePost(event:FormEvent) {
    event.preventDefault(); setNotice(''); setSaving(true)
    try {
      let postMedia:MediaFields = { media_url:editor.media_url, media_type:editor.media_type, media_path:editor.media_path }
      if (mediaFile) {
        const formData = new FormData(); formData.append('file',mediaFile)
        postMedia = await api('/api/media',{method:'POST',body:formData})
      }
      await api(editingId ? `/api/posts/${editingId}` : '/api/posts',{method:editingId?'PUT':'POST',body:JSON.stringify({...editor,...postMedia,event_date:editor.event_date||null})})
      setEditor(blankPost); setMediaFile(null); setEditingId(null); setNotice(editingId?'Post updated.':'Post published.'); await loadData()
    } catch(error) { setNotice(error instanceof Error ? error.message : 'Unable to save') }
    finally { setSaving(false) }
  }

  function edit(post:Post) {
    setEditor({...post,event_date:post.event_date||''}); setMediaFile(null); setEditingId(post.id); setSection('posts'); window.scrollTo({top:0,behavior:'smooth'})
  }

  async function remove(post:Post) {
    if (!window.confirm(`Delete “${post.title}”?`)) return
    await api(`/api/posts/${post.id}`,{method:'DELETE'}); await loadData()
  }

  async function changeStatus(id:number,status:Enquiry['status']) {
    await api(`/api/enquiries/${id}`,{method:'PATCH',body:JSON.stringify({status})}); await loadData()
  }

  const visiblePosts = useMemo(() => filter==='all'?posts:posts.filter(post=>post.category===filter),[filter,posts])
  const counts = useMemo(() => ({published:posts.filter(p=>p.published).length,promoted:posts.filter(p=>p.promoted).length,newEnquiries:enquiries.filter(e=>e.status==='new').length}),[posts,enquiries])

  if (loading) return <div className="admin-loading">Loading admin portal…</div>
  if (!authenticated) return <main className="admin-login"><form onSubmit={login}><img src={schoolLogo} alt="Waigani Christian College crest"/><p>Secure administration</p><h1>Welcome back.</h1><label>Username<input name="username" required autoFocus /></label><label>Password<input name="password" type="password" required /></label>{notice&&<div className="admin-error">{notice}</div>}<button>Sign in →</button><a href="/">← Return to website</a></form></main>

  return <div className="admin-shell">
    <aside className="admin-sidebar"><a className="admin-brand" href="/"><img src={schoolLogo} alt="College crest"/><span>Waigani Christian<small>Administration</small></span></a><nav><button className={section==='overview'?'active':''} onClick={()=>setSection('overview')}>⌂ Overview</button><button className={section==='posts'?'active':''} onClick={()=>setSection('posts')}>✦ Content & posts</button><button className={section==='enquiries'?'active':''} onClick={()=>setSection('enquiries')}>✉ Enquiries <b>{counts.newEnquiries}</b></button></nav><div className="admin-sidebar-bottom"><a href="/">View public website ↗</a><button onClick={()=>{sessionStorage.removeItem('wcc_admin_token');location.reload()}}>Sign out</button></div></aside>
    <main className="admin-main"><header><div><p>Admin dashboard</p><h1>{section==='overview'?'Good day, Administrator.':section==='posts'?'Manage content':'Enquiry inbox'}</h1></div><button className="admin-new" onClick={()=>{setEditor(blankPost);setMediaFile(null);setEditingId(null);setSection('posts')}}>+ New post</button></header>{notice&&<div className="admin-notice">{notice}</div>}
      {section==='overview'&&<><section className="metric-grid"><article><span>Published content</span><strong>{counts.published}</strong><small>Across all school areas</small></article><article><span>Promoted stories</span><strong>{counts.promoted}</strong><small>Boosted on the website</small></article><article className="urgent"><span>New enquiries</span><strong>{counts.newEnquiries}</strong><small>Awaiting a response</small></article></section><section className="admin-panel"><div className="panel-heading"><div><p>Recent activity</p><h2>Latest posts</h2></div><button onClick={()=>setSection('posts')}>Manage all →</button></div><PostTable posts={posts.slice(0,5)} edit={edit} remove={remove}/></section></>}
      {section==='posts'&&<div className="content-layout"><form className="post-editor admin-panel" onSubmit={savePost}><div className="panel-heading"><div><p>Publisher</p><h2>{editingId?'Edit post':'Create a new post'}</h2></div>{editingId&&<button type="button" onClick={()=>{setEditor(blankPost);setMediaFile(null);setEditingId(null)}}>Cancel</button>}</div><label>Title<input value={editor.title} onChange={e=>setEditor({...editor,title:e.target.value})} required /></label><label>School area<select value={editor.category} onChange={e=>setEditor({...editor,category:e.target.value as Category})}>{Object.entries(categories).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Short summary<textarea rows={3} value={editor.summary} onChange={e=>setEditor({...editor,summary:e.target.value})} required /></label><label>Full story<textarea rows={7} value={editor.body} onChange={e=>setEditor({...editor,body:e.target.value})} /></label><label>Event date <span>Optional</span><input type="date" value={editor.event_date} onChange={e=>setEditor({...editor,event_date:e.target.value})}/></label><label>Image or video <span>Optional · images 10 MB, videos 50 MB</span><input key={`${editingId||'new'}-${editor.media_path||'empty'}`} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" onChange={e=>setMediaFile(e.target.files?.[0]||null)}/></label>{mediaFile&&<div className="media-selection"><strong>Ready to upload:</strong> {mediaFile.name}</div>}{editor.media_url&&<div className="media-preview">{editor.media_type==='video'?<video src={editor.media_url} controls preload="metadata"/>:<img src={editor.media_url} alt="Current post media"/>}<button type="button" onClick={()=>{setEditor({...editor,media_url:null,media_type:null,media_path:null});setMediaFile(null)}}>Remove media</button></div>}<div className="check-row"><label><input type="checkbox" checked={editor.published} onChange={e=>setEditor({...editor,published:e.target.checked})}/> Publish now</label><label><input type="checkbox" checked={editor.promoted} onChange={e=>setEditor({...editor,promoted:e.target.checked})}/> Boost this post</label></div><button className="save-post" disabled={saving}>{saving?'Uploading & saving…':editingId?'Save changes →':'Publish post →'}</button></form><section className="admin-panel post-library"><div className="panel-heading"><div><p>Content library</p><h2>All posts</h2></div></div><select className="filter" value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}><option value="all">All school areas</option>{Object.entries(categories).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><PostTable posts={visiblePosts} edit={edit} remove={remove}/></section></div>}
      {section==='enquiries'&&<section className="admin-panel"><div className="panel-heading"><div><p>Admissions</p><h2>Family enquiries</h2></div><span>{enquiries.length} total</span></div><div className="enquiry-list">{enquiries.length===0?<div className="empty">No enquiries received yet.</div>:enquiries.map(item=><article key={item.id}><div className="enquiry-person"><span>{item.name.charAt(0)}</span><div><strong>{item.name}</strong><a href={`mailto:${item.email}`}>{item.email}</a></div></div><div><small>Year level</small><p>{item.year_level}</p></div><div className="enquiry-message"><small>Message</small><p>{item.message||'No message included.'}</p></div><select value={item.status} onChange={e=>changeStatus(item.id,e.target.value as Enquiry['status'])}><option value="new">New</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></article>)}</div></section>}
    </main>
  </div>
}

function PostTable({posts,edit,remove}:{posts:Post[];edit:(p:Post)=>void;remove:(p:Post)=>void}) {
  return <div className="post-table">{posts.length===0?<div className="empty">No posts in this section.</div>:posts.map(post=><article key={post.id}><div className={`category-dot ${post.category}`}></div><div><strong>{post.title}</strong><span>{categories[post.category]} · {post.event_date||post.created_at.slice(0,10)}</span></div><div className="post-flags">{post.media_type&&<b>{post.media_type}</b>}{post.promoted&&<b>Boosted</b>}<i className={post.published?'live':'draft'}>{post.published?'Live':'Draft'}</i></div><div className="row-actions"><button onClick={()=>edit(post)}>Edit</button><button onClick={()=>remove(post)}>Delete</button></div></article>)}</div>
}
