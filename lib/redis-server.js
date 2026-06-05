/* eslint-disable @typescript-eslint/no-require-imports */
// CommonJS Redis client for server.js (not bundled by Next.js)
const Redis = require('ioredis')

function createClient() {
  const port = parseInt(process.env.REDIS_PORT || '6379')
  return new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port,
    password: process.env.REDIS_PASSWORD || undefined,
    tls: port === 6380 ? {} : undefined,
    lazyConnect: false,
  })
}

module.exports = { createClient }
