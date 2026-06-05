/* eslint-disable @typescript-eslint/no-require-imports */
// CommonJS Redis client for server.js (not bundled by Next.js)
const Redis = require('ioredis')

function createClient() {
  return new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    lazyConnect: false,
  })
}

module.exports = { createClient }
