export type NewsItem = {
  id?:number
  date:string
  tag:string
  title:string
  text:string
  body?:string
  media_url?:string|null
  media_type?:'image'|'video'|null
  category?:string
  learning_page_id?:number|null
}
