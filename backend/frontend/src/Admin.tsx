import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import schoolLogo from './assets/WCC LOGO.png'
import './Admin.css'
import { adminApi as api, adminSignOut } from './adminApi'
import { completeAuthRedirect, supabase } from './supabase'
import { learningCategories, learningPageHref, learningRoots, postCategories as categories } from './learning'
import type { LearningCategory, LearningPage, PostCategory as Category } from './learning'

type MediaFields = { media_url:string|null; media_type:'image'|'video'|null; media_path:string|null }
type Post = { id:number; title:string; summary:string; body:string; category:Category; learning_page_id:number|null; event_date:string|null; published:boolean; promoted:boolean; created_at:string } & MediaFields
type PostEditor = Omit<Post,'id'|'created_at'|'event_date'> & { event_date:string }
type Enquiry = { id:number; name:string; email:string; year_level:string; message:string; status:'new'|'in_progress'|'resolved'; created_at:string }
type Staff = { id:number; name:string; job_title:string; email:string; linkedin_url:string|null; photo_url:string|null; photo_path:string|null; sort_order:number; published:boolean }
type StaffEditor = Omit<Staff,'id'>
type Career = { id:number; title:string; department:string; location:string; employment_type:'Full-time'|'Part-time'|'Contract'|'Casual'|'Internship'; summary:string; description:string; application_email:string; application_url:string|null; closing_date:string|null; published:boolean }
type CareerEditor = Omit<Career,'id'|'closing_date'> & { closing_date:string }
type Resource = { id:number; title:string; description:string; category:'fees'|'application'|'policy'|'curriculum'|'general'; file_url:string; file_path:string; file_name:string; file_size:number; sort_order:number; published:boolean }
type ResourceEditor = Omit<Resource,'id'>
type LearningPageEditor = Omit<LearningPage,'id'|'created_at'|'updated_at'>

const blankPost:PostEditor = { title:'', summary:'', body:'', category:'news_events', learning_page_id:null, event_date:'', published:true, promoted:false, media_url:null, media_type:null, media_path:null }
const blankStaff:StaffEditor = { name:'', job_title:'', email:'', linkedin_url:'', photo_url:null, photo_path:null, sort_order:0, published:true }
const blankCareer:CareerEditor = { title:'', department:'', location:'Waigani Heights, Port Moresby', employment_type:'Full-time', summary:'', description:'', application_email:'enquiries@waiganichristiancollege.edu.pg', application_url:null, closing_date:'', published:true }
const blankResource:ResourceEditor = { title:'', description:'', category:'general', file_url:'', file_path:'', file_name:'', file_size:0, sort_order:0, published:true }
const resourceCategories:Record<Resource['category'],string> = { fees:'School Fees', application:'Application Forms', policy:'Policies', curriculum:'Curriculum', general:'General' }
const blankLearningPage:LearningPageEditor = { title:'', slug:'fode/new-page', category:'fode', eyebrow:'', summary:'', body:'', published:false, sort_order:0 }

export default function Admin() {
  const [setupMode,setSetupMode] = useState(window.location.pathname === '/admin/setup')
  const recoveryMode = window.location.pathname === '/admin/forgot-password'
  const [canSetPassword,setCanSetPassword] = useState(false)
  const [authenticated,setAuthenticated] = useState(false)
  const [loading,setLoading] = useState(true)
  const [section,setSection] = useState<'overview'|'posts'|'pages'|'enquiries'|'staff'|'careers'|'resources'>('overview')
  const [posts,setPosts] = useState<Post[]>([])
  const [learningPages,setLearningPages] = useState<LearningPage[]>([])
  const [pageEditor,setPageEditor] = useState<LearningPageEditor>(blankLearningPage)
  const [editingPageId,setEditingPageId] = useState<number|null>(null)
  const [pageFilter,setPageFilter] = useState<'all'|LearningCategory>('all')
  const [enquiries,setEnquiries] = useState<Enquiry[]>([])
  const [staff,setStaff] = useState<Staff[]>([])
  const [staffEditor,setStaffEditor] = useState<StaffEditor>(blankStaff)
  const [editingStaffId,setEditingStaffId] = useState<number|null>(null)
  const [staffPhoto,setStaffPhoto] = useState<File|null>(null)
  const [careers,setCareers] = useState<Career[]>([])
  const [careerEditor,setCareerEditor] = useState<CareerEditor>(blankCareer)
  const [editingCareerId,setEditingCareerId] = useState<number|null>(null)
  const [resources,setResources] = useState<Resource[]>([])
  const [resourceEditor,setResourceEditor] = useState<ResourceEditor>(blankResource)
  const [editingResourceId,setEditingResourceId] = useState<number|null>(null)
  const [resourceFile,setResourceFile] = useState<File|null>(null)
  const [resourceFilter,setResourceFilter] = useState<'all'|Resource['category']>('all')
  const [editor,setEditor] = useState(blankPost)
  const [editingId,setEditingId] = useState<number|null>(null)
  const [filter,setFilter] = useState<'all'|Category>('all')
  const [postPageFilter,setPostPageFilter] = useState('all')
  const [notice,setNotice] = useState('')
  const [mediaFile,setMediaFile] = useState<File|null>(null)
  const [saving,setSaving] = useState(false)

  const loadData = useCallback(async () => {
    const [postData,enquiryData,staffData,pageData] = await Promise.all([api('/api/posts?admin=true'),api('/api/enquiries'),api('/api/staff?admin=true'),api('/api/learning-pages')])
    setPosts(postData); setEnquiries(enquiryData); setStaff(staffData); setLearningPages(pageData)
    try { setCareers(await api('/api/careers?admin=true')) }
    catch(error) { setCareers([]); setNotice(error instanceof Error ? error.message : 'Careers database setup is pending.') }
    try { setResources(await api('/api/resources')) }
    catch { setResources([]) }
  },[])

  useEffect(() => {
    if (setupMode) {
      completeAuthRedirect().then(session => {
        setCanSetPassword(Boolean(session))
        if (!session) setNotice('This link is invalid or has expired. Request a new password reset link.')
      }).catch(error => setNotice(error instanceof Error ? error.message : 'Unable to open this link.')).finally(() => setLoading(false))
      return
    }
    if (recoveryMode) { setLoading(false); return }
    api('/api/admin/me').then(() => {
      setAuthenticated(true)
      return loadData().catch(error => setNotice(error instanceof Error ? error.message : 'Database unavailable'))
    }).catch(() => undefined).finally(() => setLoading(false))
  },[loadData,setupMode,recoveryMode])

  async function requestPasswordReset(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice(''); setSaving(true)
    const data = new FormData(event.currentTarget)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(String(data.get('email') || '').trim(), {
        redirectTo: new URL('/admin/setup', window.location.origin).href,
      })
      if (error) throw error
      setNotice('If an account exists for this email, a password reset link has been sent. Check your inbox and spam folder.')
    } catch(error) { setNotice(error instanceof Error ? error.message : 'Unable to send reset email. Try again.') }
    finally { setSaving(false) }
  }

  async function setPassword(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice(''); setSaving(true)
    const data = new FormData(event.currentTarget)
    const password = String(data.get('password') || '')
    const confirmation = String(data.get('confirmation') || '')
    if (!canSetPassword) { setNotice('Request a new password reset link first.'); setSaving(false); return }
    if (password.length < 8) { setNotice('Use at least 8 characters.'); setSaving(false); return }
    if (password !== confirmation) { setNotice('Passwords do not match.'); setSaving(false); return }
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      await api('/api/admin/me')
      window.history.replaceState({}, '', '/admin')
      setSetupMode(false)
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
    setEditor({...post,learning_page_id:post.learning_page_id??null,event_date:post.event_date||''}); setMediaFile(null); setEditingId(post.id); setSection('posts'); window.scrollTo({top:0,behavior:'smooth'})
  }

  /** Run an admin action, show any failure in the notice bar, then refresh the lists. */
  async function attempt(action:()=>Promise<unknown>, success:string, failure:string) {
    setNotice('')
    let succeeded = false
    try { await action(); succeeded = true; if (success) setNotice(success) }
    catch(error) { setNotice(error instanceof Error ? error.message : failure) }
    try { await loadData() } catch { /* the notice above already explains the failure */ }
    return succeeded
  }

  async function remove(post:Post) {
    if (!window.confirm(`Delete “${post.title}”?`)) return
    await attempt(() => api(`/api/posts/${post.id}`,{method:'DELETE'}), 'Post deleted.', 'Unable to delete post')
  }

  async function changeStatus(id:number,status:Enquiry['status']) {
    await attempt(() => api(`/api/enquiries/${id}`,{method:'PATCH',body:JSON.stringify({status})}), '', 'Unable to update enquiry')
  }

  async function removeEnquiry(item:Enquiry) {
    if (!window.confirm(`Permanently delete the enquiry from ${item.name}?`)) return
    await attempt(() => api(`/api/enquiries/${item.id}`,{method:'DELETE'}), 'Enquiry deleted.', 'Unable to delete enquiry')
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
  async function removeStaff(person:Staff) { if (!window.confirm(`Delete ${person.name}'s profile?`)) return; await attempt(() => api(`/api/staff/${person.id}`,{method:'DELETE'}), 'Staff profile deleted.', 'Unable to delete staff profile') }
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
  async function removeCareer(role:Career) { if (!window.confirm(`Delete “${role.title}”?`)) return; await attempt(() => api(`/api/careers/${role.id}`,{method:'DELETE'}), 'Career opportunity deleted.', 'Unable to delete career opportunity') }
  function startNewCareer() { setSection('careers'); setCareerEditor({...blankCareer}); setEditingCareerId(null); setNotice(''); window.scrollTo({top:0,behavior:'smooth'}) }

  async function saveResource(event:FormEvent) {
    event.preventDefault(); setNotice(''); setSaving(true)
    try {
      let fileData = { file_url:resourceEditor.file_url, file_path:resourceEditor.file_path, file_name:resourceEditor.file_name, file_size:resourceEditor.file_size }
      if (resourceFile) {
        const formData = new FormData(); formData.append('file',resourceFile)
        fileData = await api('/api/resource-upload',{method:'POST',body:formData})
      }
      if (!fileData.file_url) throw new Error('Upload a file first.')
      await api(editingResourceId ? `/api/resources/${editingResourceId}` : '/api/resources',{method:editingResourceId?'PUT':'POST',body:JSON.stringify({...resourceEditor,...fileData})})
      setResourceEditor(blankResource); setResourceFile(null); setEditingResourceId(null); setNotice(editingResourceId?'Resource updated.':'Resource published.'); await loadData()
    } catch(error) { setNotice(error instanceof Error ? error.message : 'Unable to save resource') } finally { setSaving(false) }
  }
  function editResource(resource:Resource) { setResourceEditor(resource); setEditingResourceId(resource.id); setResourceFile(null); setSection('resources'); window.scrollTo({top:0,behavior:'smooth'}) }
  async function removeResource(resource:Resource) { if (!window.confirm(`Delete "${resource.title}"?`)) return; await attempt(() => api(`/api/resources/${resource.id}`,{method:'DELETE'}), 'Resource deleted.', 'Unable to delete resource') }
  function startNewResource() { setSection('resources'); setResourceEditor({...blankResource}); setResourceFile(null); setEditingResourceId(null); setNotice(''); window.scrollTo({top:0,behavior:'smooth'}) }
  const visibleResources = useMemo(() => resourceFilter==='all'?resources:resources.filter(r=>r.category===resourceFilter),[resourceFilter,resources])

  function startNewPage() {
    const category = pageFilter === 'all' ? 'fode' : pageFilter
    setPageEditor({...blankLearningPage,category,slug:`${learningRoots[category]}/new-page`})
    setEditingPageId(null); setSection('pages'); setNotice(''); window.scrollTo({top:0,behavior:'smooth'})
  }

  async function saveLearningPage(event:FormEvent) {
    event.preventDefault(); setNotice(''); setSaving(true)
    const page = {...pageEditor,slug:pageEditor.slug.trim().replace(/^\/+|\/+$/g,''),title:pageEditor.title.trim(),eyebrow:pageEditor.eyebrow.trim(),summary:pageEditor.summary.trim()}
    const slugPattern = new RegExp(`^${learningRoots[page.category]}(?:/[a-z0-9]+(?:-[a-z0-9]+)*)*$`)
    if (!slugPattern.test(page.slug)) { setNotice(`Use ${learningRoots[page.category]}/page-name with lowercase words and hyphens.`); setSaving(false); return }
    try {
      await api(editingPageId ? `/api/learning-pages/${editingPageId}` : '/api/learning-pages',{method:editingPageId?'PUT':'POST',body:JSON.stringify(page)})
      setPageEditor({...blankLearningPage}); setEditingPageId(null); setNotice(page.published?'Learning page published.':'Learning page saved as a draft.'); await loadData()
    } catch(error) { setNotice(error instanceof Error ? error.message : 'Unable to save learning page') }
    finally { setSaving(false) }
  }

  function editLearningPage(page:LearningPage) {
    setPageEditor({slug:page.slug,category:page.category,title:page.title,eyebrow:page.eyebrow,summary:page.summary,body:page.body,published:page.published,sort_order:page.sort_order})
    setEditingPageId(page.id); setSection('pages'); setNotice(''); window.scrollTo({top:0,behavior:'smooth'})
  }

  async function removeLearningPage(page:LearningPage) {
    if (!page.slug.includes('/')) { setNotice('Keep this pathway overview page. You can edit its content or save it as a draft.'); return }
    if (!window.confirm(`Delete “${page.title}”? Its posts will remain in the content library.`)) return
    const removed = await attempt(() => api(`/api/learning-pages/${page.id}`,{method:'DELETE'}),'Learning page deleted.','Unable to delete learning page')
    if (removed && editingPageId === page.id) { setEditingPageId(null); setPageEditor({...blankLearningPage}) }
  }

  async function toggleLearningPage(page:LearningPage) {
    const data:LearningPageEditor = {slug:page.slug,category:page.category,title:page.title,eyebrow:page.eyebrow,summary:page.summary,body:page.body,published:!page.published,sort_order:page.sort_order}
    const updated = await attempt(() => api(`/api/learning-pages/${page.id}`,{method:'PUT',body:JSON.stringify(data)}),page.published?'Learning page saved as a draft.':'Learning page published.','Unable to change page visibility')
    if (updated && editingPageId === page.id) setPageEditor({...pageEditor,published:!page.published})
  }

  function startPagePost(page:LearningPage) {
    setEditor({...blankPost,category:page.category,learning_page_id:page.id}); setMediaFile(null); setEditingId(null); setSection('posts'); setNotice(''); window.scrollTo({top:0,behavior:'smooth'})
  }

  const visiblePosts = useMemo(() => posts.filter(post=>(filter==='all'||post.category===filter)&&(postPageFilter==='all'||(postPageFilter==='unassigned'?post.learning_page_id==null:String(post.learning_page_id)===postPageFilter))),[filter,postPageFilter,posts])
  const visibleLearningPages = useMemo(() => pageFilter==='all'?learningPages:learningPages.filter(page=>page.category===pageFilter),[pageFilter,learningPages])
  const editingRootPage = editingPageId !== null && learningPages.some(page=>page.id===editingPageId && !page.slug.includes('/'))
  const counts = useMemo(() => ({published:posts.filter(p=>p.published).length,promoted:posts.filter(p=>p.promoted).length,newEnquiries:enquiries.filter(e=>e.status==='new').length,openCareers:careers.filter(c=>c.published).length}),[posts,enquiries,careers])

  if (loading) return <div className="admin-loading">Loading admin portal…</div>
  if (recoveryMode) return <main className="admin-login"><form onSubmit={requestPasswordReset}><img src={schoolLogo} alt="Waigani Christian College crest"/><p>Secure administration</p><h1>Reset password.</h1><label>Email address<input name="email" type="email" defaultValue="masomanu23@gmail.com" autoComplete="email" required autoFocus /></label>{notice&&<div className="admin-notice" role="status">{notice}</div>}<button disabled={saving}>{saving?'Sending…':'Send reset link'}</button><a href="/admin">Return to sign in</a></form></main>
  if (setupMode) return <main className="admin-login"><form onSubmit={setPassword}><img src={schoolLogo} alt="Waigani Christian College crest"/><p>Secure administration</p><h1>Set your password.</h1><label>New password<input name="password" type="password" minLength={8} autoComplete="new-password" required autoFocus /></label><label>Confirm password<input name="confirmation" type="password" minLength={8} autoComplete="new-password" required /></label>{notice&&<div className="admin-error">{notice}</div>}<button disabled={saving || !canSetPassword}>{saving?'Saving…':'Set password →'}</button><a href="/admin/forgot-password">Request a new reset link</a><a href="/admin">Return to sign in</a></form></main>
  if (!authenticated) return <main className="admin-login"><form onSubmit={login}><img src={schoolLogo} alt="Waigani Christian College crest"/><p>Secure administration</p><h1>Welcome back.</h1><label>Email address<input name="username" type="email" defaultValue="masomanu23@gmail.com" autoComplete="email" required autoFocus /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label>{notice&&<div className="admin-error">{notice}</div>}<button>Sign in →</button><a href="/admin/forgot-password">Forgot password?</a><a href="/">← Return to website</a></form></main>

  return <div className="admin-shell">
    <aside className="admin-sidebar"><a className="admin-brand" href="/"><img src={schoolLogo} alt="College crest"/><span>Waigani Christian</span></a><nav><button className={section==='overview'?'active':''} onClick={()=>setSection('overview')}>⌂ Overview</button><button className={section==='posts'?'active':''} onClick={()=>setSection('posts')}>✦ Content & posts</button><button className={section==='pages'?'active':''} onClick={()=>setSection('pages')}>Learning pages <b>{learningPages.length}</b></button><button className={section==='staff'?'active':''} onClick={()=>setSection('staff')}>♟ Staff profiles</button><button className={section==='careers'?'active':''} onClick={()=>setSection('careers')}>▣ Careers <b>{counts.openCareers}</b></button><button className={section==='resources'?'active':''} onClick={()=>setSection('resources')}>◎ Resources <b>{resources.length}</b></button><button className={section==='enquiries'?'active':''} onClick={()=>setSection('enquiries')}>✉ Enquiries <b>{counts.newEnquiries}</b></button></nav><div className="admin-sidebar-bottom"><a href="/">View public website ↗</a><button onClick={()=>{void adminSignOut().finally(()=>location.reload())}}>Sign out</button></div></aside>
    <main className="admin-main"><header><div><p>Admin dashboard</p><h1>{section==='overview'?'Good day, Administrator.':section==='posts'?'Manage content':section==='pages'?'Manage learning pages':section==='staff'?'Manage staff':section==='careers'?'Manage careers':section==='resources'?'Forms & resources':'Enquiry inbox'}</h1></div><button className="admin-new" onClick={()=>{if(section==='pages'){startNewPage()}else if(section==='staff'){startNewStaff()}else if(section==='careers'){startNewCareer()}else if(section==='resources'){startNewResource()}else{setEditor(blankPost);setMediaFile(null);setEditingId(null);setSection('posts')}}}>{section==='pages'?'+ New page':section==='staff'?'+ New profile':section==='careers'?'+ New vacancy':section==='resources'?'+ New resource':'+ New post'}</button></header>{notice&&<div className="admin-notice">{notice}</div>}
      {section==='overview'&&<><section className="metric-grid"><article><span>Published content</span><strong>{counts.published}</strong><small>Across all school areas</small></article><article><span>Promoted stories</span><strong>{counts.promoted}</strong><small>Boosted on the website</small></article><article className="career-metric"><span>Career opportunities</span><strong>{counts.openCareers}</strong><small>Published vacancies</small><button onClick={startNewCareer}>Post a vacancy →</button></article><article className="urgent"><span>New enquiries</span><strong>{counts.newEnquiries}</strong><small>Awaiting a response</small></article></section><section className="admin-panel"><div className="panel-heading"><div><p>Recent activity</p><h2>Latest posts</h2></div><button onClick={()=>setSection('posts')}>Manage all →</button></div><PostTable posts={posts.slice(0,5)} edit={edit} remove={remove} learningPages={learningPages}/></section><section className="admin-panel learning-management-summary"><div><p>Learning pathways</p><h2>Four pathways. Pages you can manage.</h2><span>{learningPages.filter(page=>page.published).length} published pages across Early Learning, Primary, Secondary and FODE.</span></div><button type="button" onClick={()=>setSection('pages')}>Manage learning pages</button></section></>}
      {section==='pages'&&<div className="content-layout learning-pages-layout">
        <form className="post-editor admin-panel" onSubmit={saveLearningPage}>
          <div className="panel-heading"><div><p>Learning pathways</p><h2>{editingPageId?'Edit learning page':'Create a learning page'}</h2></div>{editingPageId&&<button type="button" onClick={startNewPage}>Cancel</button>}</div>
          <p className="editor-help">Manage the information on each pathway page. Add further pages for programmes, enrolment information or learning resources.</p>
          <label>School area<select disabled={editingRootPage} value={pageEditor.category} onChange={e=>{const category=e.target.value as LearningCategory;setPageEditor({...pageEditor,category,slug:learningRoots[category]+'/'+(pageEditor.slug.split('/').slice(1).join('/')||'new-page')})}}>{Object.entries(learningCategories).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label>Page title<input required minLength={3} maxLength={160} value={pageEditor.title} onChange={e=>setPageEditor({...pageEditor,title:e.target.value})}/></label>
          <label>Page address<input required readOnly={editingRootPage} maxLength={160} value={pageEditor.slug} onChange={e=>setPageEditor({...pageEditor,slug:e.target.value})}/><span className="field-hint">{learningPageHref(pageEditor.slug)}</span></label>
          {editingRootPage&&<p className="editor-help">This overview page keeps its address so website navigation continues to work. You can edit its content and visibility.</p>}
          <label>Small heading <span>Optional</span><input maxLength={100} value={pageEditor.eyebrow} onChange={e=>setPageEditor({...pageEditor,eyebrow:e.target.value})}/></label>
          <label>Introduction<textarea required minLength={5} maxLength={500} rows={3} value={pageEditor.summary} onChange={e=>setPageEditor({...pageEditor,summary:e.target.value})}/></label>
          <label>Page content<textarea maxLength={10000} rows={10} value={pageEditor.body} onChange={e=>setPageEditor({...pageEditor,body:e.target.value})}/><span className="field-hint">Use blank lines between paragraphs. Add regular updates through Content &amp; posts.</span></label>
          <label>Display order<input required type="number" min="0" step="1" value={pageEditor.sort_order} onChange={e=>setPageEditor({...pageEditor,sort_order:Number(e.target.value)})}/></label>
          <div className="check-row"><label><input type="checkbox" checked={pageEditor.published} onChange={e=>setPageEditor({...pageEditor,published:e.target.checked})}/> Publish on website</label></div>
          <button className="save-post" disabled={saving}>{saving?'Saving...':pageEditor.published?'Save and publish page':'Save draft page'}</button>
        </form>
        <section className="admin-panel post-library">
          <div className="panel-heading"><div><p>Page library</p><h2>Learning pages</h2></div><span>{learningPages.length} total</span></div>
          <label className="page-filter">School area<select className="filter" value={pageFilter} onChange={e=>setPageFilter(e.target.value as typeof pageFilter)}><option value="all">All learning areas</option>{Object.entries(learningCategories).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <div className="learning-admin-list">{visibleLearningPages.length===0?<div className="empty">No pages in this learning area yet. Create a page to get started.</div>:visibleLearningPages.map(page=><article key={page.id}>
            <div><strong>{page.title}</strong><small>{learningCategories[page.category]} &middot; {page.published?'Published':'Draft'}</small><small className="page-address">{learningPageHref(page)}</small></div>
            <div className="page-row-actions"><button type="button" onClick={()=>editLearningPage(page)}>Edit page</button><button type="button" onClick={()=>startPagePost(page)}>Add post</button>{page.published&&<a href={learningPageHref(page)} target="_blank" rel="noreferrer">View page</a>}<button type="button" onClick={()=>toggleLearningPage(page)}>{page.published?'Unpublish':'Publish'}</button>{page.slug.includes('/')&&<button type="button" className="danger" onClick={()=>removeLearningPage(page)}>Delete</button>}</div>
          </article>)}</div>
        </section>
      </div>}
      {section==='posts'&&<div className="content-layout"><form className="post-editor admin-panel" onSubmit={savePost}><div className="panel-heading"><div><p>Publisher</p><h2>{editingId?'Edit post':'Create a new post'}</h2></div>{editingId&&<button type="button" onClick={()=>{setEditor(blankPost);setMediaFile(null);setEditingId(null)}}>Cancel</button>}</div><label>Title<input value={editor.title} onChange={e=>setEditor({...editor,title:e.target.value})} required /></label><label>School area<select value={editor.category} onChange={e=>setEditor({...editor,category:e.target.value as Category,learning_page_id:null})}>{Object.entries(categories).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Learning page <span>Optional</span><select value={editor.learning_page_id??''} onChange={e=>setEditor({...editor,learning_page_id:e.target.value?Number(e.target.value):null})}><option value="">Pathway overview (no specific page)</option>{learningPages.filter(page=>page.category===editor.category).map(page=><option key={page.id} value={page.id}>{page.title}{page.published?'':' (Draft page)'}</option>)}</select></label><label>Short summary<textarea rows={3} value={editor.summary} onChange={e=>setEditor({...editor,summary:e.target.value})} required /></label><label>Full story<textarea rows={7} value={editor.body} onChange={e=>setEditor({...editor,body:e.target.value})} /></label><label>Event date <span>Optional</span><input type="date" value={editor.event_date} onChange={e=>setEditor({...editor,event_date:e.target.value})}/></label><label>Image or video <span>Optional · images 10 MB, videos 50 MB</span><input key={`${editingId||'new'}-${editor.media_path||'empty'}`} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" onChange={e=>setMediaFile(e.target.files?.[0]||null)}/></label>{mediaFile&&<div className="media-selection"><strong>Ready to upload:</strong> {mediaFile.name}</div>}{editor.media_url&&<div className="media-preview">{editor.media_type==='video'?<video src={editor.media_url} controls preload="metadata"/>:<img src={editor.media_url} alt="Current post media" loading="lazy" decoding="async"/>}<button type="button" onClick={()=>{setEditor({...editor,media_url:null,media_type:null,media_path:null});setMediaFile(null)}}>Remove media</button></div>}<div className="check-row"><label><input type="checkbox" checked={editor.published} onChange={e=>setEditor({...editor,published:e.target.checked})}/> Publish now</label><label><input type="checkbox" checked={editor.promoted} onChange={e=>setEditor({...editor,promoted:e.target.checked})}/> Boost this post</label></div><button className="save-post" disabled={saving}>{saving?'Uploading & saving…':editingId?'Save changes →':'Publish post →'}</button></form><section className="admin-panel post-library"><div className="panel-heading"><div><p>Content library</p><h2>All posts</h2></div></div><div className="post-library-filters"><select aria-label="Filter posts by school area" className="filter" value={filter} onChange={e=>{setFilter(e.target.value as typeof filter);setPostPageFilter('all')}}><option value="all">All school areas</option>{Object.entries(categories).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><select aria-label="Filter posts by learning page" className="filter" value={postPageFilter} onChange={e=>setPostPageFilter(e.target.value)}><option value="all">All learning pages</option><option value="unassigned">Area-wide posts</option>{learningPages.filter(page=>filter==='all'||page.category===filter).map(page=><option key={page.id} value={page.id}>{page.title}</option>)}</select></div><PostTable posts={visiblePosts} edit={edit} remove={remove} learningPages={learningPages}/></section></div>}
      {section==='enquiries'&&<section className="admin-panel"><div className="panel-heading"><div><p>Admissions</p><h2>Family enquiries</h2></div><span>{enquiries.length} total</span></div><div className="enquiry-list">{enquiries.length===0?<div className="empty">No enquiries received yet.</div>:enquiries.map(item=><article key={item.id}><div className="enquiry-person"><span>{item.name.charAt(0)}</span><div><strong>{item.name}</strong><a href={`mailto:${item.email}`}>{item.email}</a></div></div><div><small>Year level</small><p>{item.year_level}</p></div><div className="enquiry-message"><small>Message</small><p>{item.message||'No message included.'}</p></div><div className="enquiry-actions"><select value={item.status} onChange={e=>changeStatus(item.id,e.target.value as Enquiry['status'])}><option value="new">New</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select><button type="button" onClick={()=>removeEnquiry(item)}>Delete</button></div></article>)}</div></section>}
      {section==='staff'&&<div className="content-layout"><form className="post-editor admin-panel" onSubmit={saveStaff}><div className="panel-heading"><div><p>Team directory</p><h2>{editingStaffId?'Edit profile':'Add staff profile'}</h2></div></div><label>Full name<input required value={staffEditor.name} onChange={e=>setStaffEditor({...staffEditor,name:e.target.value})}/></label><label>Job title<input required value={staffEditor.job_title} onChange={e=>setStaffEditor({...staffEditor,job_title:e.target.value})}/></label><label>Email address<input required type="email" value={staffEditor.email} onChange={e=>setStaffEditor({...staffEditor,email:e.target.value})}/></label><label>LinkedIn URL <span>Optional</span><input type="url" value={staffEditor.linkedin_url||''} onChange={e=>setStaffEditor({...staffEditor,linkedin_url:e.target.value})}/></label><label>Profile photo <span>JPG, PNG or WebP</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setStaffPhoto(e.target.files?.[0]||null)}/></label>{staffEditor.photo_url&&<div className="media-preview"><img src={staffEditor.photo_url} alt="Current profile" loading="lazy" decoding="async"/><button type="button" onClick={()=>setStaffEditor({...staffEditor,photo_url:null,photo_path:null})}>Remove photo</button></div>}<label>Display order<input type="number" min="0" value={staffEditor.sort_order} onChange={e=>setStaffEditor({...staffEditor,sort_order:Number(e.target.value)})}/></label><div className="check-row"><label><input type="checkbox" checked={staffEditor.published} onChange={e=>setStaffEditor({...staffEditor,published:e.target.checked})}/> Visible publicly</label></div><button className="save-post" disabled={saving}>{saving?'Saving…':editingStaffId?'Save profile →':'Add profile →'}</button></form><section className="admin-panel post-library"><div className="panel-heading"><div><p>Administration & staff</p><h2>All profiles</h2></div><span>{staff.length} total</span></div><div className="staff-admin-list">{staff.length===0?<div className="empty">No staff profiles yet.</div>:staff.map(person=><article key={person.id}>{person.photo_url?<img src={person.photo_url} alt="" loading="lazy" decoding="async"/>:<span>{person.name.charAt(0)}</span>}<div><strong>{person.name}</strong><small>{person.job_title} · {person.published?'Visible':'Hidden'}</small></div><div className="row-actions"><button onClick={()=>editStaff(person)}>Edit</button><button onClick={()=>removeStaff(person)}>Delete</button></div></article>)}</div></section></div>}
      {section==='careers'&&<div className="content-layout"><form className="post-editor admin-panel" onSubmit={saveCareer}><div className="panel-heading"><div><p>Recruitment</p><h2>{editingCareerId?'Edit vacancy':'Add career opportunity'}</h2></div>{editingCareerId&&<button type="button" onClick={()=>{setCareerEditor(blankCareer);setEditingCareerId(null)}}>Cancel</button>}</div><label>Position title<input required value={careerEditor.title} onChange={e=>setCareerEditor({...careerEditor,title:e.target.value})}/></label><label>Department<input value={careerEditor.department} onChange={e=>setCareerEditor({...careerEditor,department:e.target.value})}/></label><label>Employment type<select value={careerEditor.employment_type} onChange={e=>setCareerEditor({...careerEditor,employment_type:e.target.value as Career['employment_type']})}><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Casual</option><option>Internship</option></select></label><label>Location<input required value={careerEditor.location} onChange={e=>setCareerEditor({...careerEditor,location:e.target.value})}/></label><label>Short summary<textarea required rows={3} value={careerEditor.summary} onChange={e=>setCareerEditor({...careerEditor,summary:e.target.value})}/></label><label>Role description<textarea rows={7} value={careerEditor.description} onChange={e=>setCareerEditor({...careerEditor,description:e.target.value})}/></label><label>Application email<input required type="email" value={careerEditor.application_email} onChange={e=>setCareerEditor({...careerEditor,application_email:e.target.value})}/></label><label>Application URL <span>Optional</span><input type="url" value={careerEditor.application_url||''} onChange={e=>setCareerEditor({...careerEditor,application_url:e.target.value})}/></label><label>Closing date <span>Optional</span><input type="date" value={careerEditor.closing_date} onChange={e=>setCareerEditor({...careerEditor,closing_date:e.target.value})}/></label><div className="check-row"><label><input type="checkbox" checked={careerEditor.published} onChange={e=>setCareerEditor({...careerEditor,published:e.target.checked})}/> Publish on website</label></div><button className="save-post" disabled={saving}>{saving?'Saving…':editingCareerId?'Save vacancy →':'Publish vacancy →'}</button></form><section className="admin-panel post-library"><div className="panel-heading"><div><p>Recruitment</p><h2>Career opportunities</h2></div><span>{careers.length} total</span></div><div className="career-admin-list">{careers.length===0?<div className="empty">No career opportunities yet.</div>:careers.map(role=><article key={role.id}><div><strong>{role.title}</strong><small>{role.department||'College-wide'} · {role.employment_type} · {role.published?'Published':'Draft'}</small>{role.closing_date&&<small>Closes {role.closing_date}</small>}</div><div className="row-actions"><button onClick={()=>editCareer(role)}>Edit</button><button onClick={()=>removeCareer(role)}>Delete</button></div></article>)}</div></section></div>}
      {section==='resources'&&<div className="content-layout"><form className="post-editor admin-panel" onSubmit={saveResource}><div className="panel-heading"><div><p>School documents</p><h2>{editingResourceId?'Edit resource':'Upload a resource'}</h2></div>{editingResourceId&&<button type="button" onClick={()=>{setResourceEditor(blankResource);setResourceFile(null);setEditingResourceId(null)}}>Cancel</button>}</div>
        <p className="editor-help">Upload school fee structures, application forms, policies or curriculum documents. Published resources appear on the Learning page under Forms &amp; Resources.</p>
        <label>Title<input required minLength={3} maxLength={200} value={resourceEditor.title} onChange={e=>setResourceEditor({...resourceEditor,title:e.target.value})}/></label>
        <label>Description <span>Optional</span><textarea rows={2} maxLength={500} value={resourceEditor.description} onChange={e=>setResourceEditor({...resourceEditor,description:e.target.value})}/></label>
        <label>Category<select value={resourceEditor.category} onChange={e=>setResourceEditor({...resourceEditor,category:e.target.value as Resource['category']})}>{Object.entries(resourceCategories).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>File <span>PDF, Word, Excel, JPG, PNG or WebP · max 20 MB</span><input key={`${editingResourceId||'new'}-${resourceEditor.file_path||'empty'}`} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/jpeg,image/png,image/webp" onChange={e=>setResourceFile(e.target.files?.[0]||null)}/></label>
        {resourceFile&&<div className="media-selection"><strong>Ready to upload:</strong> {resourceFile.name} ({(resourceFile.size/1024).toFixed(0)} KB)</div>}
        {resourceEditor.file_url&&!resourceFile&&<div className="media-selection"><strong>Current file:</strong> {resourceEditor.file_name} ({(resourceEditor.file_size/1024).toFixed(0)} KB)</div>}
        <label>Display order<input type="number" min="0" step="1" value={resourceEditor.sort_order} onChange={e=>setResourceEditor({...resourceEditor,sort_order:Number(e.target.value)})}/></label>
        <div className="check-row"><label><input type="checkbox" checked={resourceEditor.published} onChange={e=>setResourceEditor({...resourceEditor,published:e.target.checked})}/> Publish on website</label></div>
        <button className="save-post" disabled={saving}>{saving?'Uploading & saving…':editingResourceId?'Save resource →':'Publish resource →'}</button>
      </form><section className="admin-panel post-library"><div className="panel-heading"><div><p>Document library</p><h2>All resources</h2></div><span>{resources.length} total</span></div>
        <label className="page-filter">Category<select className="filter" value={resourceFilter} onChange={e=>setResourceFilter(e.target.value as typeof resourceFilter)}><option value="all">All categories</option>{Object.entries(resourceCategories).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <div className="resource-admin-list">{visibleResources.length===0?<div className="empty">No resources uploaded yet.</div>:visibleResources.map(resource=><article key={resource.id}><div><strong>{resource.title}</strong><small>{resourceCategories[resource.category]} · {resource.file_name} · {(resource.file_size/1024).toFixed(0)} KB · {resource.published?'Published':'Draft'}</small></div><div className="row-actions"><a href={resource.file_url} target="_blank" rel="noreferrer">View</a><button onClick={()=>editResource(resource)}>Edit</button><button onClick={()=>removeResource(resource)}>Delete</button></div></article>)}</div>
      </section></div>}
    </main>
  </div>
}

function PostTable({posts,edit,remove,learningPages}:{posts:Post[];edit:(p:Post)=>void;remove:(p:Post)=>void;learningPages:LearningPage[]}) {
  return <div className="post-table">{posts.length===0?<div className="empty">No posts in this section.</div>:posts.map(post=><article key={post.id}><div className={`category-dot ${post.category}`}></div><div><strong>{post.title}</strong><span>{categories[post.category]}{post.learning_page_id&&learningPages.find(page=>page.id===post.learning_page_id)?` / ${learningPages.find(page=>page.id===post.learning_page_id)!.title}`:''} · {post.event_date||post.created_at.slice(0,10)}</span></div><div className="post-flags">{post.media_type&&<b>{post.media_type}</b>}{post.promoted&&<b>Boosted</b>}<i className={post.published?'live':'draft'}>{post.published?'Live':'Draft'}</i></div><div className="row-actions"><button onClick={()=>edit(post)}>Edit</button><button onClick={()=>remove(post)}>Delete</button></div></article>)}</div>
}
