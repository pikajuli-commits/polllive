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

  // Map sessionId (UUID) → code (6-char) so presenter:slide / presenter:lock
  // can look up the correct Redis key (which is keyed by code, not UUID).
  // Populated whenever any client joins a session.
  const sessionCodeMap = new Map()

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    // Presenter joins a room for their session
    // Now accepts `code` alongside sessionId so we can populate sessionCodeMap
    socket.on('presenter:join', ({ sessionId, code }) => {
      socket.join(`session:${sessionId}`)
      socket.data.role = 'presenter'
      socket.data.sessionId = sessionId
      if (code) sessionCodeMap.set(sessionId, code)
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

        // Populate the map so presenter events work even before presenter joins
        sessionCodeMap.set(session.id, code)

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
    // Bug fix: was using `session:${sessionId}` (UUID) as Redis key — wrong.
    // The session is stored under `session:${code}` (6-char code).
    // Now accepts `code` directly from the client event.
    // Also fetches existing responses for the slide and broadcasts to room.
    socket.on('presenter:slide', async ({ sessionId, code, slideIndex }) => {
      try {
        // Use code from event, fall back to in-memory map
        const sessionCode = code || sessionCodeMap.get(sessionId)
        if (!sessionCode) {
          console.warn('presenter:slide: no code available for session', sessionId)
          return
        }

        const redis = createClient()
        const raw = await redis.get(`session:${sessionCode}`)
        if (!raw) { await redis.quit(); return }

        const session = JSON.parse(raw)
        session.currentSlide = slideIndex
        session.locked = false
        await redis.set(`session:${sessionCode}`, JSON.stringify(session), 'EX', 86400)

        // Fetch existing responses for this slide (for going back to previous slides)
        const responseKey = `responses:${sessionId}:${slideIndex}`
        const all = await redis.lrange(responseKey, 0, -1)
        await redis.quit()

        const responses = all.map(r => JSON.parse(r))

        // Broadcast new slide to everyone in the room (audience + viewers)
        io.to(`session:${sessionId}`).emit('slide:current', {
          slide: session.slides[slideIndex],
          slideIndex,
          locked: false
        })

        // Broadcast existing responses to room (presenter + viewers use them; audience ignores)
        io.to(`session:${sessionId}`).emit('responses:update', {
          slideIndex,
          responses
        })
      } catch (err) {
        console.error('presenter:slide error', err)
      }
    })

    // Presenter locks/unlocks responses
    // Bug fix: same Redis key issue as presenter:slide — now uses code.
    socket.on('presenter:lock', async ({ sessionId, code, locked }) => {
      try {
        const sessionCode = code || sessionCodeMap.get(sessionId)
        if (!sessionCode) return

        const redis = createClient()
        const raw = await redis.get(`session:${sessionCode}`)
        if (!raw) { await redis.quit(); return }

        const session = JSON.parse(raw)
        session.locked = locked
        await redis.set(`session:${sessionCode}`, JSON.stringify(session), 'EX', 86400)
        await redis.quit()
        io.to(`session:${sessionId}`).emit('responses:lock', { locked })
      } catch (err) {
        console.error('presenter:lock error', err)
      }
    })

    // Audience submits an answer
    socket.on('audience:answer', async ({ code, slideIndex, answer, name }) => {
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
          name: name || socket.data.name || 'Anónimo',
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

    // Presenter (or co-presenter) clears all responses for the current slide
    // so participants can answer again with a clean slate.
    socket.on('presenter:clear', async ({ sessionId, code, slideIndex }) => {
      try {
        const sessionCode = code || sessionCodeMap.get(sessionId)
        if (!sessionCode) return

        const redis = createClient()
        const responseKey = `responses:${sessionId}:${slideIndex}`
        await redis.del(responseKey)

        const raw = await redis.get(`session:${sessionCode}`)
        await redis.quit()
        if (!raw) return

        const session = JSON.parse(raw)

        // 1. Clear responses display on presenter / viewer
        io.to(`session:${sessionId}`).emit('responses:update', {
          slideIndex,
          responses: []
        })

        // 2. Re-emit slide:current so audience components remount and can re-submit
        io.to(`session:${sessionId}`).emit('slide:current', {
          slide: session.slides[slideIndex],
          slideIndex,
          locked: session.locked
        })

        console.log(`Responses cleared for session ${sessionId} slide ${slideIndex}`)
      } catch (err) {
        console.error('presenter:clear error', err)
      }
    })

    // Collaborator/viewer joins — read-only observer
    // Joins the session room, receives slide:current and responses:update automatically.
    // Does NOT count toward audienceCount.
    socket.on('view:join', async ({ sessionId, code }) => {
      try {
        const redis = createClient()
        const raw = await redis.get(`session:${code}`)
        if (!raw) {
          await redis.quit()
          socket.emit('error', { message: 'Sesión no encontrada' })
          return
        }
        const session = JSON.parse(raw)

        socket.join(`session:${session.id}`)
        socket.data.role = 'viewer'
        socket.data.sessionId = session.id
        sessionCodeMap.set(session.id, code)

        // Fetch existing responses for current slide
        const responseKey = `responses:${session.id}:${session.currentSlide}`
        const all = await redis.lrange(responseKey, 0, -1)
        await redis.quit()

        const responses = all.map(r => JSON.parse(r))

        // Send current slide state
        socket.emit('slide:current', {
          slide: session.slides[session.currentSlide] || null,
          slideIndex: session.currentSlide,
          locked: session.locked
        })

        // Send existing responses for current slide
        socket.emit('responses:update', {
          slideIndex: session.currentSlide,
          responses
        })

        console.log(`Viewer joined session ${session.id}`)
      } catch (err) {
        console.error('view:join error', err)
        socket.emit('error', { message: 'Error al conectar como espectador' })
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
