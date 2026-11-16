import { supabase } from './supabase'

export type ResourceCategory = 'fees' | 'application' | 'policy' | 'curriculum' | 'general'
export type Resource = {
  id:number; title:string; description:string; category:ResourceCategory
  file_url:string; file_bucket:'school-resources'|'post-media'; file_path:string
  file_name:string; file_size:number; sort_order:number; published:boolean
  created_at?:string; updated_at?:string
}
export type ResourceEditor = Omit<Resource,'id'|'created_at'|'updated_at'>
export const resourceBucket = 'school-resources'
export const resourceMaxSize = 20 * 1024 * 1024
export const resourceCategories:Record<ResourceCategory,string> = {
  fees:'School Fees', application:'Application Forms', policy:'Policies', curriculum:'Curriculum', general:'General',
}
const documentTypes:Record<string,string> = {
  pdf:'application/pdf', doc:'application/msword',
  docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls:'application/vnd.ms-excel', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp',
}

export function validateResourceFile(file:File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  const contentType = documentTypes[extension]
  if (!contentType || (file.type && file.type!=='application/octet-stream' && file.type!==contentType)) throw new Error('Use a PDF, Word, Excel, JPG, PNG or WebP file.')
  if (file.size === 0) throw new Error('The file is empty. Choose a document with content.')
  if (file.size > resourceMaxSize) throw new Error('Files must be 20 MB or smaller.')
  if (file.name.length > 300) throw new Error('Please shorten the file name to 300 characters or fewer.')
  return {extension,contentType}
}

export function formatResourceSize(size:number) {
  if (size < 1024) return `${size} B`
  return size >= 1048576 ? `${(size/1048576).toFixed(1)} MB` : `${Math.ceil(size/1024)} KB`
}

export async function loadPublicResources():Promise<Resource[]> {
  const {data,error} = await supabase.from('resources').select('*').eq('published',true).order('category').order('sort_order').order('title')
  if (error) throw error
  return data || []
}

export async function getResourceDownloadUrl(resource:Resource, options:{download?:boolean} = {}) {
  const bucket = resource.file_bucket || 'post-media'
  if (bucket!=='post-media' && bucket!==resourceBucket) throw new Error('This document is unavailable. Please contact the college.')
  if (!resource.file_path || !resource.file_path.startsWith('resources/') || resource.file_path.split('/').includes('..')) throw new Error('The document address is invalid. Please contact the college.')
  if (bucket==='post-media') return supabase.storage.from(bucket).getPublicUrl(resource.file_path,{download:options.download?resource.file_name:undefined}).data.publicUrl
  const {data,error} = await supabase.storage.from(bucket).createSignedUrl(resource.file_path,60,{download:options.download?resource.file_name:undefined})
  if (error) throw new Error('This document could not be opened. Please try again or contact the college.')
  return data.signedUrl
}
