export type LearningCategory = 'early_learning' | 'primary_school' | 'secondary_school' | 'fode'
export type PostCategory = LearningCategory | 'news_events' | 'student_life'

export type LearningPage = {
  id:number
  slug:string
  category:LearningCategory
  title:string
  eyebrow:string
  summary:string
  body:string
  published:boolean
  sort_order:number
  created_at?:string
  updated_at?:string
}

export const learningCategories:Record<LearningCategory,string> = {
  early_learning:'Early Learning',
  primary_school:'Primary School',
  secondary_school:'Secondary School',
  fode:'FODE',
}

export const postCategories:Record<PostCategory,string> = {
  news_events:'News & events',
  ...learningCategories,
  student_life:'Student life',
}

export const learningRoots:Record<LearningCategory,string> = {
  early_learning:'early-learning',
  primary_school:'primary-school',
  secondary_school:'secondary-school',
  fode:'fode',
}

export function learningPageHref(page:LearningPage|string) {
  return `/learning/${typeof page === 'string' ? page : page.slug}`
}
