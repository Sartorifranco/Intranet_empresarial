export const EXTERNAL_HEADLINE_COUNT = 12

const RSS2JSON_API = 'https://api.rss2json.com/v1/api.json'

/** Feed principal solicitado: La Nación. */
const PRIMARY_RSS_FEED =
  'https://www.lanacion.com.ar/arc/outboundfeeds/rss/?outputType=xml'

/** Fallback gratuito vía rss2json si el feed principal no responde. */
const FALLBACK_RSS_FEED = 'https://www.ambito.com/rss/pages/ultimas-noticias.xml'

export interface ExternalArticle {
  id: string
  title: string
  url: string
  publishedAt: string
  imageUrl?: string
}

interface Rss2JsonEnclosure {
  link?: string
  type?: string
}

interface Rss2JsonItem {
  title?: string
  link?: string
  pubDate?: string
  guid?: string
  thumbnail?: string
  enclosure?: Rss2JsonEnclosure | Rss2JsonEnclosure[]
  description?: string
}

interface Rss2JsonResponse {
  status: string
  message?: string
  items?: Rss2JsonItem[]
}

function slugify(text: string, index: number): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 48) || `headline-${index}`
  )
}

function normalizeEnclosure(
  enclosure?: Rss2JsonEnclosure | Rss2JsonEnclosure[],
): Rss2JsonEnclosure | undefined {
  if (!enclosure) return undefined
  return Array.isArray(enclosure) ? enclosure[0] : enclosure
}

function isLikelyImageUrl(url: string): boolean {
  if (/\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(url)) return true
  return /(?:images|media|img|photo|thumb|cdn)/i.test(url)
}

export function extractArticleImage(item: Rss2JsonItem): string | undefined {
  const thumbnail = item.thumbnail?.trim()
  if (thumbnail) return thumbnail

  const enclosure = normalizeEnclosure(item.enclosure)
  if (enclosure?.link?.trim()) {
    const link = enclosure.link.trim()
    if (enclosure.type?.startsWith('image/') || isLikelyImageUrl(link)) {
      return link
    }
  }

  const description = item.description ?? ''
  const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (imgMatch?.[1]?.trim()) {
    return imgMatch[1].trim()
  }

  const srcsetMatch = description.match(/<img[^>]+srcset=["']([^"']+)["']/i)
  if (srcsetMatch?.[1]) {
    const firstSrc = srcsetMatch[1].split(',')[0]?.trim().split(/\s+/)[0]
    if (firstSrc) return firstSrc
  }

  return undefined
}

function mapRss2JsonItems(items: Rss2JsonItem[]): ExternalArticle[] {
  return items
    .filter((item) => item.title && item.link)
    .slice(0, EXTERNAL_HEADLINE_COUNT)
    .map((item, index) => ({
      id: item.guid ?? slugify(item.title!, index),
      title: item.title!.trim(),
      url: item.link!,
      publishedAt: item.pubDate ?? '',
      imageUrl: extractArticleImage(item),
    }))
}

async function fetchFromRss2Json(rssUrl: string, signal?: AbortSignal): Promise<ExternalArticle[]> {
  const url = new URL(RSS2JSON_API)
  url.searchParams.set('rss_url', rssUrl)

  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`rss2json HTTP ${response.status}`)

  const data = (await response.json()) as Rss2JsonResponse
  if (data.status !== 'ok' || !data.items?.length) {
    throw new Error(data.message ?? 'rss2json returned no items')
  }

  const articles = mapRss2JsonItems(data.items)
  if (articles.length === 0) throw new Error('No valid headlines in RSS feed')

  return articles
}

export function formatRelativeDate(dateString: string): string {
  if (!dateString) return ''

  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMinutes < 1) return 'Hace un momento'
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`
  if (diffHours < 24) return `Hace ${diffHours} h`
  if (diffDays === 1) return 'Ayer'
  if (diffDays < 7) return `Hace ${diffDays} días`

  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
  })
}

export async function fetchExternalHeadlines(signal?: AbortSignal): Promise<ExternalArticle[]> {
  try {
    return await fetchFromRss2Json(PRIMARY_RSS_FEED, signal)
  } catch (primaryError) {
    if (primaryError instanceof Error && primaryError.name === 'AbortError') throw primaryError
    console.warn('Feed La Nación no disponible, usando fallback:', primaryError)
    return fetchFromRss2Json(FALLBACK_RSS_FEED, signal)
  }
}
