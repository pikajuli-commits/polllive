/* eslint-disable @typescript-eslint/no-require-imports */
// Wrapper unificado: @upstash/redis en producción, ioredis en local
// Expone una API compatible con ambos para server.js

const isUpstash = !!process.env.UPSTASH_REDIS_REST_URL

function createClient() {
  if (isUpstash) {
    const { Redis } = require('@upstash/redis')
    const client = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })

    // Wrapper que imita la API de ioredis que usa server.js
    return {
      async get(key) {
        const val = await client.get(key)
        if (val === null || val === undefined) return null
        // Upstash devuelve objetos ya parseados; ioredis devuelve strings
        return typeof val === 'string' ? val : JSON.stringify(val)
      },
      async set(key, value, exFlag, ttl) {
        // ioredis: set(key, val, 'EX', 86400)
        return client.set(key, value, { ex: ttl || 86400 })
      },
      async rpush(key, value) {
        return client.rpush(key, value)
      },
      async lrange(key, start, stop) {
        const items = await client.lrange(key, start, stop)
        // Upstash devuelve objetos; los convertimos a strings para que
        // server.js pueda hacer JSON.parse igual que con ioredis
        return items.map(i => typeof i === 'string' ? i : JSON.stringify(i))
      },
      async expire(key, ttl) {
        return client.expire(key, ttl)
      },
      async quit() {
        // Upstash es HTTP stateless, no hay conexión que cerrar
        return 'OK'
      },
    }
  }

  // Local: ioredis nativo
  const IORedis = require('ioredis')
  return new IORedis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  })
}

module.exports = { createClient }
