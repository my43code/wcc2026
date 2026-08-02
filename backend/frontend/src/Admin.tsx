import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import schoolLogo from './assets/WCC LOGO.png'
import './Admin.css'
import { adminApi as api, adminSignOut } from './adminApi'
import { completeAuthRedirect, supabase } from './supabase'

type Category = 'news_events' | 'early_learning' | 'primary_school' | 'secondary_school' | 'student_life'
type MediaFields = { media_url:string|null; media_type:'image'|'video'|null; media_path:string|null }
type Post = { id:number; title:string; summary:string; body:string; category:Category; event_date:string|null; published:boolean; promoted:boolean; created_at:string } & MediaFields
type PostEditor = Omit<Post,'id'|'created_at'|'event_date'> & { event_date:string }
type Enquiry = { id:number; name:string; email:string; year_level:string; message:string; status:'new'|'in_progress'|'resolved'; created_at:string }
type Staff = { id:number; name:string; job_title:string; email:string; linkedin_url:string|null; photo_url:string|null; photo_path:string|null; sort_order:number; published:boolean }
type StaffEditor = Omit<Staff,'id'>
type Career = { id:number; title:string; department:string; location:string; employment_type:'Full-time'|'Part-time'|'Contract'|'Casual'|'Internship'; summary:string; description:string; application_email:string; application_url:string|null; closing_date:string|null; published:boolean }
type CareerEditor = Omit<Career,'id'|'closing_date'> & { closing_date:string }

const categories: Record<Category,string> = {
  news_events:'News & events', early_learning:'Early learning', primary_school:'Primary school',
  secondary_school:'Secondary school', student_life:'Student life',
}
const blankPost:PostEditor = { title:'', summary:'', body:'', category:'news_events', event_date:'', published:true, promoted:false, media_url:null, media_type:null, media_path:null }
const blankStaff:StaffEditor = { name:'', job_title:'', email:'', linkedin_url:'', photo_url:null, photo_path:null, sort_order:0, published:true }
const blankCareer:CareerEditor = { title:'', department:'', location:'Waigani Heights, Port Moresby', employment_type:'Full-time', summary:'', description:'', application_email:'info@wcc.ac.pg', application_url:null, closing_date:'', published:true }

export default function Admin() {
  const setupMode = window.location.pathname === '/admin/setup'
  const [authenticated,setAuthenticated] = useState(false)
  const [loading,setLoading] = useState(true)
  const [section,setSection] = useState<'overview'|'posts'|'enquiries'|'staff'|'careers'>('overview')
  const [posts,setPosts] = useState<Post[]>([])
  const [enquiries,setEnquiries] = useState<Enquiry[]>([])
  const [staff,setStaff] = useState<Staff[]>([])
  const [staffEditor,setStaffEditor] = useState<StaffEditor>(blankStaff)
  const [editingStaffId,setEditingStaffId] = useState<number|null>(null)
  const [staffPhoto,setStaffPhoto] = useState<File|null>(null)
  const [careers,setCareers] = useState<Career[]>([])
  const [careerEditor,setCareerEditor] = useState<CareerEditor>(blankCareer)
  const [editingCareerId,setEditingCareerId] = useState<number|null>(null)
  const [editor,setEditor] = useState(blankPost)
  const [editingId,setEditingId] = useState<number|null>(null)
  const [filter,setFilter] = useState<'all'|Category>('all')
  const [notice,setNotice] = useState('')
  const [mediaFile,setMediaFile] = useState<File|null>(null)
  const [saving,setSaving] = useState(false)

  const loadData = useCallback(async () => {
    const [postData,enquiryData,staffData] = await Promise.all([api('/api/posts?admin=true'),api('/api/enquiries'),api('/api/staff?admin=true')])
    setPosts(postData); setEnquiries(enquiryData); setStaff(staffData)
    try { setCareers(await api('/api/careers?admin=true')) }
    catch(error) { setCareers([]); setNotice(error instanceof Error ? error.message : 'Careers database setup is pending.') }
  },[])

  useEffect(() => {
    if (setupMode) {
      completeAuthRedirect().then(session => {
        if (!session) setNotice('This invitation link is invalid or has expired. Ask the administrator to resend it.')
      }).catch(error => setNotice(error instanceof Error ? error.message : 'Unable to open this invitation.')).finally(() => setLoading(false))
      return
    }
    api('/api/admin/me').then(() => {
      setAuthenticated(true)
      return loadData().catch(error => setNotice(error instanceof Error ? error.message : 'Database unavailable'))
    }).catch(() => undefined).finally(() => setLoading(false))
  },[loadData,setupMode])

  async function setPassword(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice(''); setSaving(true)
    const data = new FormData(event.currentTarget)
    const password = String(data.get('password') || '')
    const confirmation = String(data.get('confirmation') || '')
    if (password !== confirmation) { setNotice('Passwords do not match.'); setSaving(false); return }
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      window.history.replaceState({}, '', '/admin')
      setAuthenticated(true)
      await loadData()
    } catch(error) { setNotice(error instanceof Error ? error.message : 'Unable to set password') }
    finally { setSaving(false) }
  }

  async function login(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice('')
    const data = new FormData(event.currentTarget)
    try {
      const result = await api('/api/auth/login',{method:'POST',body:JSON.stringify({username:data.get('username'),password:data.get('password')})})
      void result; setAuthenticated(true)
      try { await loadData() } catch(error) { setNotice(error instanceof Error ? `Signed in. ${error.message}` : 'Signed in, but the database is unavailable.') }
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

  async function removeEnquiry(item:Enquiry) {
    if (!window.confirm(`Permanently delete the enquiry from ${item.name}?`)) return
    try {
      await api(`/api/enquiries/${item.id}`,{method:'DELETE'})
      setNotice('Enquiry deleted.')
      await loadData()
    } catch(error) { setNotice(error instanceof Error ? error.message : 'Unable to delete enquiry') }
  }

  async function saveStaff(event:FormEvent) {
    event.preventDefault(); setNotice(''); setSaving(true)
    try {
      let photo = { photo_url:staffEditor.photo_url, photo_path:staffEditor.photo_path }
      if (staffPhoto) { const formData = new FormData(); formData.append('file',staffPhoto); const uploaded = await api('/api/media',{method:'POST',body:formData}); photo = {photo_url:uploaded.media_url,photo_path:uploaded.media_path} }
      await api(editingStaffId ? `/api/staff/${editingStaffId}` : '/api/staff',{method:editingStaffId?'PUT':'POST',body:JSON.stringify({...staffEditor,...photo,linkedin_url:staffEditor.linkedin_url||null})})
      setStaffEditor(blankStaff); setStaffPhoto(null); setEditingStaffId(null); setNotice(editingStaffId?'Staff profile updated.':'Staff profile added.'); await loadData()
    } catch(error) { setNotice(error instanceof Error ? error.message : 'Unable to save staff profile') } finally { setSaving(false) }
  }
  function editStaff(person:Staff) { setStaffEditor(person); setEditingStaffId(person.id); setStaffPhoto(null); setSection('staff'); window.scrollTo({top:0,behavior:'smooth'}) }
  async function removeStaff(person:Staff) { if (!window.confirm(`Delete ${person.name}'s profile?`)) return; await api(`/api/staff/${person.id}`,{method:'DELETE'}); await loadData() }
  function startNewStaff() {
    setSection('staff'); setStaffEditor({...blankStaff}); setStaffPhoto(null); setEditingStaffId(null); setNotice('')
    window.setTimeout(() => {
      const form = document.querySelector<HTMLFormElement>('.content-layout .post-editor')
      form?.scrollIntoView({behavior:'smooth',block:'start'})
      form?.querySelector<HTMLInputElement>('input')?.focus()
    }, 0)
  }

  async function saveCareer(event:FormEvent) {
    event.preventDefault(); setNotice(''); setSaving(true)
    try {
      await api(editingCareerId ? `/api/careers/${editingCareerId}` : '/api/careers',{method:editingCareerId?'PUT':'POST',body:JSON.stringify({...careerEditor,application_url:careerEditor.application_url||null,closing_date:careerEditor.closing_date||null})})
      setCareerEditor(blankCareer); setEditingCareerId(null); setNotice(editingCareerId?'Career opportunity updated.':'Career opportunity published.'); await loadData()
    } catch(error) { setNotice(error instanceof Error ? error.message : 'Unable to save career opportunity') } finally { setSaving(false) }
  }
  function editCareer(role:Career) { setCareerEditor({...role,closing_date:role.closing_date||''}); setEditingCareerId(role.id); setSection('careers'); window.scrollTo({top:0,behavior:'smooth'}) }
  async function removeCareer(role:Career) { if (!window.confirm(`Delete “${role.title}”?`)) return; await api(`/api/careers/${role.id}`,{method:'DELETE'}); await loadData() }
  function startNewCareer() { setSection('careers'); setCareerEditor({...blankCareer}); setEditingCareerId(null); setNotice(''); window.scrollTo({top:0,behavior:'smooth'}) }

  const visiblePosts = useMemo(() => filter==='all'?posts:posts.filter(post=>post.category===filter),[filter,posts])
  const counts = useMemo(() => ({published:posts.filter(p=>p.published).length,promoted:posts.filter(p=>p.promoted).length,newEnquiries:enquiries.filter(e=>e.status==='new').length,openCareers:careers.filter(c=>c.published).length}),[posts,enquiries,careers])

  if (loading) return <div className="admin-loading">Loading admin portal…</div>
  if (setupMode) return <main className="admin-login"><form onSubmit={setPassword}><img src={schoolLogo} alt="Waigani Christian College crest"/><p>Secure administration</p><h1>Set your password.</h1><label>New password<input name="password" type="password" minLength={8} required autoFocus /></label><label>Confirm password<input name="confirmation" type="password" minLength={8} required /></label>{notice&&<div className="admin-error">{notice}</div>}<button disabled={saving}>{saving?'Saving…':'Set password →'}</button><a href="/admin">Return to sign in</a></form></main>
  if (!authenticated) return <main className="admin-login"><form onSubmit={login}><img src={schoolLogo} alt="Waigani Christian College crest"/><p>Secure administration</p><h1>Welcome back.</h1><label>Email address<input name="username" type="email" autoComplete="email" required autoFocus /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label>{notice&&<div className="admin-error">{notice}</div>}<button>Sign in →</button><a href="/">← Return to website</a></form></main>

  return <div className="admin-shell">
    <aside className="admin-sidebar"><a className="admin-brand" href="/"><img src={schoolLogo} alt="College crest"/><span>Waigani Christian</span></a><nav><button className={section==='overview'?'active':''} onClick={()=>setSection('overview')}>⌂ Overview</button><button className={section==='posts'?'active':''} onClick={()=>setSection('posts')}>✦ Content & posts</button><button className={section==='staff'?'active':''} onClick={()=>setSection('staff')}>♟ Staff profiles</button><button className={section==='careers'?'active':''} onClick={()=>setSection('careers')}>▣ Careers <b>{counts.openCareers}</b></button><button className={section==='enquiries'?'active':''} onClick={()=>setSection('enquiries')}>✉ Enquiries <b>{counts.newEnquiries}</b></button></nav><div className="admin-sidebar-bottom"><a href="/">View public website ↗</a><button onClick={()=>{void adminSignOut().finally(()=>location.reload())}}>Sign out</button></div></aside>
    <main className="admin-main"><header><div><p>Admin dashboard</p><h1>{section==='overview'?'Good day, Administrator.':section==='posts'?'Manage content':section==='staff'?'Manage staff':section==='careers'?'Manage careers':'Enquiry inbox'}</h1></div><button className="admin-new" onClick={()=>{if(section==='staff'){startNewStaff()}else if(section==='careers'){startNewCareer()}else{setEditor(blankPost);setMediaFile(null);setEditingId(null);setSection('posts')}}}>{section==='staff'?'+ New profile':section==='careers'?'+ New vacancy':'+ New post'}</button></header>{notice&&<div className="admin-notice">{notice}</div>}
      {section==='overview'&&<><section className="metric-grid"><article><span>Published content</span><strong>{counts.published}</strong><small>Across all school areas</small></article><article><span>Promoted stories</span><strong>{counts.promoted}</strong><small>Boosted on the website</small></article><article className="career-metric"><span>Career opportunities</span><strong>{counts.openCareers}</strong><small>Published vacancies</small><button onClick={startNewCareer}>Post a vacancy →</button></article><article className="urgent"><span>New enquiries</span><strong>{counts.newEnquiries}</strong><small>Awaiting a response</small></article></section><section className="admin-panel"><div className="panel-heading"><div><p>Recent activity</p><h2>Latest posts</h2></div><button onClick={()=>setSection('posts')}>Manage all →</button></div><PostTable posts={posts.slice(0,5)} edit={edit} remove={remove}/></section></>}
      {section==='posts'&&<div className="content-layout"><form className="post-editor admin-panel" onSubmit={savePost}><div className="panel-heading"><div><p>Publisher</p><h2>{editingId?'Edit post':'Create a new post'}</h2></div>{editingId&&<button type="button" onClick={()=>{setEditor(blankPost);setMediaFile(null);setEditingId(null)}}>Cancel</button>}</div><label>Title<input value={editor.title} onChange={e=>setEditor({...editor,title:e.target.value})} required /></label><label>School area<select value={editor.category} onChange={e=>setEditor({...editor,category:e.target.value as Category})}>{Object.entries(categories).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Short summary<textarea rows={3} value={editor.summary} onChange={e=>setEditor({...editor,summary:e.target.value})} required /></label><label>Full story<textarea rows={7} value={editor.body} onChange={e=>setEditor({...editor,body:e.target.value})} /></label><label>Event date <span>Optional</span><input type="date" value={editor.event_date} onChange={e=>setEditor({...editor,event_date:e.target.value})}/></label><label>Image or video <span>Optional · images 10 MB, videos 50 MB</span><input key={`${editingId||'new'}-${editor.media_path||'empty'}`} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" onChange={e=>setMediaFile(e.target.files?.[0]||null)}/></label>{mediaFile&&<div className="media-selection"><strong>Ready to upload:</strong> {mediaFile.name}</div>}{editor.media_url&&<div className="media-preview">{editor.media_type==='video'?<video src={editor.media_url} controls preload="metadata"/>:<img src={editor.media_url} alt="Current post media"/>}<button type="button" onClick={()=>{setEditor({...editor,media_url:null,media_type:null,media_path:null});setMediaFile(null)}}>Remove media</button></div>}<div className="check-row"><label><input type="checkbox" checked={editor.published} onChange={e=>setEditor({...editor,published:e.target.checked})}/> Publish now</label><label><input type="checkbox" checked={editor.promoted} onChange={e=>setEditor({...editor,promoted:e.target.checked})}/> Boost this post</label></div><button className="save-post" disabled={saving}>{saving?'Uploading & saving…':editingId?'Save changes →':'Publish post →'}</button></form><section className="admin-panel post-library"><div className="panel-heading"><div><p>Content library</p><h2>All posts</h2></div></div><select className="filter" value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}><option value="all">All school areas</option>{Object.entries(categories).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><PostTable posts={visiblePosts} edit={edit} remove={remove}/></section></div>}
      {section==='enquiries'&&<section className="admin-panel"><div className="panel-heading"><div><p>Admissions</p><h2>Family enquiries</h2></div><span>{enquiries.length} total</span></div><div className="enquiry-list">{enquiries.length===0?<div className="empty">No enquiries received yet.</div>:enquiries.map(item=><article key={item.id}><div className="enquiry-person"><span>{item.name.charAt(0)}</span><div><strong>{item.name}</strong><a href={`mailto:${item.email}`}>{item.email}</a></div></div><div><small>Year level</small><p>{item.year_level}</p></div><div className="enquiry-message"><small>Message</small><p>{item.message||'No message included.'}</p></div><div className="enquiry-actions"><select value={item.status} onChange={e=>changeStatus(item.id,e.target.value as Enquiry['status'])}><option value="new">New</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select><button type="button" onClick={()=>removeEnquiry(item)}>Delete</button></div></article>)}</div></section>}
      {section==='staff'&&<div className="content-layout"><form className="post-editor admin-panel" onSubmit={saveStaff}><div className="panel-heading"><div><p>Team directory</p><h2>{editingStaffId?'Edit profile':'Add staff profile'}</h2></div></div><label>Full name<input required value={staffEditor.name} onChange={e=>setStaffEditor({...staffEditor,name:e.target.value})}/></label><label>Job title<input required value={staffEditor.job_title} onChange={e=>setStaffEditor({...staffEditor,job_title:e.target.value})}/></label><label>Email address<input required type="email" value={staffEditor.email} onChange={e=>setStaffEditor({...staffEditor,email:e.target.value})}/></label><label>LinkedIn URL <span>Optional</span><input type="url" value={staffEditor.linkedin_url||''} onChange={e=>setStaffEditor({...staffEditor,linkedin_url:e.target.value})}/></label><label>Profile photo <span>JPG, PNG or WebP</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setStaffPhoto(e.target.files?.[0]||null)}/></label>{staffEditor.photo_url&&<div className="media-preview"><img src={staffEditor.photo_url} alt="Current profile"/><button type="button" onClick={()=>setStaffEditor({...staffEditor,photo_url:null,photo_path:null})}>Remove photo</button></div>}<label>Display order<input type="number" min="0" value={staffEditor.sort_order} onChange={e=>setStaffEditor({...staffEditor,sort_order:Number(e.target.value)})}/></label><div className="check-row"><label><input type="checkbox" checked={staffEditor.published} onChange={e=>setStaffEditor({...staffEditor,published:e.target.checked})}/> Visible publicly</label></div><button className="save-post" disabled={saving}>{saving?'Saving…':editingStaffId?'Save profile →':'Add profile →'}</button></form><section className="admin-panel post-library"><div className="panel-heading"><div><p>Administration & staff</p><h2>All profiles</h2></div><span>{staff.length} total</span></div><div className="staff-admin-list">{staff.length===0?<div className="empty">No staff profiles yet.</div>:staff.map(person=><article key={person.id}>{person.photo_url?<img src={person.photo_url} alt=""/>:<span>{person.name.charAt(0)}</span>}<div><strong>{person.name}</strong><small>{person.job_title} · {person.published?'Visible':'Hidden'}</small></div><div className="row-actions"><button onClick={()=>editStaff(person)}>Edit</button><button onClick={()=>removeStaff(person)}>Delete</button></div></article>)}</div></section></div>}
      {section==='careers'&&<div className="content-layout"><form className="post-editor admin-panel" onSubmit={saveCareer}><div className="panel-heading"><div><p>Recruitment</p><h2>{editingCareerId?'Edit vacancy':'Add career opportunity'}</h2></div>{editingCareerId&&<button type="button" onClick={()=>{setCareerEditor(blankCareer);setEditingCareerId(null)}}>Cancel</button>}</div><label>Position title<input required value={careerEditor.title} onChange={e=>setCareerEditor({...careerEditor,title:e.target.value})}/></label><label>Department<input value={careerEditor.department} onChange={e=>setCareerEditor({...careerEditor,department:e.target.value})}/></label><label>Employment type<select value={careerEditor.employment_type} onChange={e=>setCareerEditor({...careerEditor,employment_type:e.target.value as Career['employment_type']})}><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Casual</option><option>Internship</option></select></label><label>Location<input required value={careerEditor.location} onChange={e=>setCareerEditor({...careerEditor,location:e.target.value})}/></label><label>Short summary<textarea required rows={3} value={careerEditor.summary} onChange={e=>setCareerEditor({...careerEditor,summary:e.target.value})}/></label><label>Role description<textarea rows={7} value={careerEditor.description} onChange={e=>setCareerEditor({...careerEditor,description:e.target.value})}/></label><label>Application email<input required type="email" value={careerEditor.application_email} onChange={e=>setCareerEditor({...careerEditor,application_email:e.target.value})}/></label><label>Application URL <span>Optional</span><input type="url" value={careerEditor.application_url||''} onChange={e=>setCareerEditor({...careerEditor,application_url:e.target.value})}/></label><label>Closing date <span>Optional</span><input type="date" value={careerEditor.closing_date} onChange={e=>setCareerEditor({...careerEditor,closing_date:e.target.value})}/></label><div className="check-row"><label><input type="checkbox" checked={careerEditor.published} onChange={e=>setCareerEditor({...careerEditor,published:e.target.checked})}/> Publish on website</label></div><button className="save-post" disabled={saving}>{saving?'Saving…':editingCareerId?'Save vacancy →':'Publish vacancy →'}</button></form><section className="admin-panel post-library"><div className="panel-heading"><div><p>Recruitment</p><h2>Career opportunities</h2></div><span>{careers.length} total</span></div><div className="career-admin-list">{careers.length===0?<div className="empty">No career opportunities yet.</div>:careers.map(role=><article key={role.id}><div><strong>{role.title}</strong><small>{role.department||'College-wide'} · {role.employment_type} · {role.published?'Published':'Draft'}</small>{role.closing_date&&<small>Closes {role.closing_date}</small>}</div><div className="row-actions"><button onClick={()=>editCareer(role)}>Edit</button><button onClick={()=>removeCareer(role)}>Delete</button></div></article>)}</div></section></div>}
    </main>
  </div>
}

function PostTable({posts,edit,remove}:{posts:Post[];edit:(p:Post)=>void;remove:(p:Post)=>void}) {
  return <div className="post-table">{posts.length===0?<div className="empty">No posts in this section.</div>:posts.map(post=><article key={post.id}><div className={`category-dot ${post.category}`}></div><div><strong>{post.title}</strong><span>{categories[post.category]} · {post.event_date||post.created_at.slice(0,10)}</span></div><div className="post-flags">{post.media_type&&<b>{post.media_type}</b>}{post.promoted&&<b>Boosted</b>}<i className={post.published?'live':'draft'}>{post.published?'Live':'Draft'}</i></div><div className="row-actions"><button onClick={()=>edit(post)}>Edit</button><button onClick={()=>remove(post)}>Delete</button></div></article>)}</div>
}
