// Redis client — usa @upstash/redis (HTTP) en producción, ioredis (TCP) en local
import { Redis as UpstashRedis } from '@upstash/redis'
import IORedis from 'ioredis'

// ---- Tipos compartidos ----

export type SlideType = 'poll' | 'wordcloud' | 'quiz' | 'qa' | 'section'

export interface SlideOption {
  id: string
  text: string
}

export interface Slide {
  id: string
  type: SlideType
  question: string
  options?: SlideOption[]
}

export interface Session {
  id: string
  code: string
  title: string
  slides: Slide[]
  currentSlide: number
  locked: boolean
  createdAt: number
}

export interface StoredResponse {
  answer: string
  name: string
  socketId: string
  ts: number
}

// ---- Cliente unificado ----

const isUpstash = !!process.env.UPSTASH_REDIS_REST_URL

let upstash: UpstashRedis | null = null
let ioredis: IORedis | null = null

function getUpstash(): UpstashRedis {
  if (!upstash) {
    upstash = new UpstashRedis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }
  return upstash
}

function getIORedis(): IORedis {
  if (!ioredis) {
    ioredis = new IORedis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    })
  }
  return ioredis
}

// ---- API pública ----

export async function getSession(code: string): Promise<Session | null> {
  if (isUpstash) {
    const data = await getUpstash().get<Session>(`session:${code}`)
    return data ?? null
  }
  const raw = await getIORedis().get(`session:${code}`)
  if (!raw) return null
  return JSON.parse(raw) as Session
}

export async function saveSession(session: Session): Promise<void> {
  if (isUpstash) {
    await getUpstash().set(`session:${session.code}`, session, { ex: 86400 })
    return
  }
  await getIORedis().set(`session:${session.code}`, JSON.stringify(session), 'EX', 86400)
}

export async function getResponses(sessionId: string, slideIndex: number): Promise<StoredResponse[]> {
  const key = `responses:${sessionId}:${slideIndex}`
  if (isUpstash) {
    const all = await getUpstash().lrange<StoredResponse>(key, 0, -1)
    return all
  }
  const all = await getIORedis().lrange(key, 0, -1)
  return all.map(r => JSON.parse(r) as StoredResponse)
}
