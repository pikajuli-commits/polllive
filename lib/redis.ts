// ESM Redis client for Next.js API routes
import Redis from 'ioredis'

let redis: Redis | null = null

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    })
  }
  return redis
}

export type SlideType = 'poll' | 'wordcloud' | 'quiz' | 'qa'

export interface SlideOption {
  id: string
  text: string
}

export interface Slide {
  id: string
  type: SlideType
  question: string
  options?: SlideOption[]  // For poll and quiz
}

export interface Session {
  id: string         // UUID
  code: string       // 6-char code
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

export async function getSession(code: string): Promise<Session | null> {
  const redis = getRedis()
  const raw = await redis.get(`session:${code}`)
  if (!raw) return null
  return JSON.parse(raw) as Session
}

export async function saveSession(session: Session): Promise<void> {
  const redis = getRedis()
  await redis.set(`session:${session.code}`, JSON.stringify(session), 'EX', 86400)
}

export async function getResponses(sessionId: string, slideIndex: number): Promise<StoredResponse[]> {
  const redis = getRedis()
  const key = `responses:${sessionId}:${slideIndex}`
  const all = await redis.lrange(key, 0, -1)
  return all.map(r => JSON.parse(r) as StoredResponse)
}
