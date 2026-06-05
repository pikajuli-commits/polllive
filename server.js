// Custom Next.js server with Socket.io
const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')
const { createClient } = require('./lib/redis-server')

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })

  const io = new Server(httpServer, {
    cors: { origin: '*' }
  })

  // Store io instance globally so API routes can access it
  global.io = io

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    // Presenter joins a room for their session
    socket.on('presenter:join', ({ sessionId }) => {
      socket.join(`session:${sessionId}`)
      socket.data.role = 'presenter'
      socket.data.sessionId = sessionId
      console.log(`Presenter joined session ${sessionId}`)
    })

    // Audience member joins a session by code
    socket.on('audience:join', async ({ code, name }) => {
      try {
        const redis = createClient()
        const raw = await redis.get(`session:${code}`)
        await redis.quit()
        if (!raw) {
          socket.emit('error', { message: 'Sesión no encontrada' })
          return
        }
        const session = JSON.parse(raw)
        socket.join(`session:${session.id}`)
        socket.data.role = 'audience'
        socket.data.sessionId = session.id
        socket.data.name = name || 'Anónimo'
        socket.data.code = code

        // Send current slide to late joiners
        socket.emit('slide:current', {
          slide: session.slides[session.currentSlide] || null,
          slideIndex: session.currentSlide,
          locked: session.locked
        })

        // Notify presenter of audience count
        const room = io.sockets.adapter.rooms.get(`session:${session.id}`)
        const audienceCount = room ? [...room].filter(id => {
          const s = io.sockets.sockets.get(id)
          return s && s.data.role === 'audience'
        }).length : 0

        io.to(`session:${session.id}`).emit('audience:count', { count: audienceCount })
        console.log(`Audience joined session ${session.id} as ${socket.data.name}`)
      } catch (err) {
        console.error('audience:join error', err)
        socket.emit('error', { message: 'Error al unirse' })
      }
    })

    // Presenter advances to a slide
    socket.on('presenter:slide', async ({ sessionId, slideIndex }) => {
      try {
        const redis = createClient()
        const raw = await redis.get(`session:${sessionId}`)
        if (!raw) { await redis.quit(); return }
        const session = JSON.parse(raw)
        session.currentSlide = slideIndex
        session.locked = false
        await redis.set(`session:${session.code}`, JSON.stringify(session), 'EX', 86400)
        await redis.quit()

        io.to(`session:${sessionId}`).emit('slide:current', {
          slide: session.slides[slideIndex],
          slideIndex,
          locked: false
        })
      } catch (err) {
        console.error('presenter:slide error', err)
      }
    })

    // Presenter locks/unlocks responses
    socket.on('presenter:lock', async ({ sessionId, locked }) => {
      try {
        const redis = createClient()
        const raw = await redis.get(`session:${sessionId}`)
        if (!raw) { await redis.quit(); return }
        const session = JSON.parse(raw)
        session.locked = locked
        await redis.set(`session:${session.code}`, JSON.stringify(session), 'EX', 86400)
        await redis.quit()
        io.to(`session:${sessionId}`).emit('responses:lock', { locked })
      } catch (err) {
        console.error('presenter:lock error', err)
      }
    })

    // Audience submits an answer
    socket.on('audience:answer', async ({ code, slideIndex, answer }) => {
      try {
        const redis = createClient()
        const raw = await redis.get(`session:${code}`)
        if (!raw) { await redis.quit(); return }
        const session = JSON.parse(raw)

        if (session.locked) {
          socket.emit('error', { message: 'Las respuestas están cerradas' })
          await redis.quit()
          return
        }

        // Store response
        const responseKey = `responses:${session.id}:${slideIndex}`
        await redis.rpush(responseKey, JSON.stringify({
          answer,
          name: socket.data.name || 'Anónimo',
          socketId: socket.id,
          ts: Date.now()
        }))
        await redis.expire(responseKey, 86400)

        // Get all responses for this slide and broadcast
        const all = await redis.lrange(responseKey, 0, -1)
        await redis.quit()

        const responses = all.map(r => JSON.parse(r))
        io.to(`session:${session.id}`).emit('responses:update', {
          slideIndex,
          responses
        })
      } catch (err) {
        console.error('audience:answer error', err)
      }
    })

    socket.on('disconnect', () => {
      if (socket.data.sessionId && socket.data.role === 'audience') {
        const room = io.sockets.adapter.rooms.get(`session:${socket.data.sessionId}`)
        const audienceCount = room ? [...room].filter(id => {
          const s = io.sockets.sockets.get(id)
          return s && s.data.role === 'audience'
        }).length : 0
        io.to(`session:${socket.data.sessionId}`).emit('audience:count', { count: audienceCount })
      }
      console.log('Client disconnected:', socket.id)
    })
  })

  const PORT = process.env.PORT || 3000
  httpServer.listen(PORT, () => {
    console.log(`> Ready on http://localhost:${PORT}`)
  })
})
