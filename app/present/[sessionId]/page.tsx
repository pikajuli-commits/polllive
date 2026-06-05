'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { getSocket } from '@/lib/socket'
import { Slide, StoredResponse } from '@/lib/redis'
import LiveBarChart from '@/components/charts/LiveBarChart'
import LiveWordCloud from '@/components/charts/LiveWordCloud'
import QRCode from 'qrcode'

interface SessionData {
  title: string
  slides: Slide[]
}

export default function PresentPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const searchParams = useSearchParams()
  const code = searchParams.get('code') || ''

  const [session, setSession] = useState<SessionData | null>(null)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [responses, setResponses] = useState<StoredResponse[]>([])
  const [locked, setLocked] = useState(false)
  const [audienceCount, setAudienceCount] = useState(0)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [showQR, setShowQR] = useState(true)
  const socketRef = useRef(getSocket())

  // Load session from Redis via API
  useEffect(() => {
    if (!code) return
    fetch(`/api/sessions/join?code=${code}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) return
        // We need full session data — fetch it properly
      })
  }, [code])

  // Fetch full session for presenter
  useEffect(() => {
    if (!code) return
    fetch(`/api/sessions/full?code=${code}`)
      .then(r => r.json())
      .then(data => {
        if (data.session) setSession(data.session)
      })
  }, [code])

  // Generate QR code
  useEffect(() => {
    if (!code) return
    const url = `${window.location.origin}/join/${code}`
    QRCode.toDataURL(url, { width: 280, margin: 2, color: { dark: '#1e293b', light: '#f8fafc' } })
      .then(setQrDataUrl)
  }, [code])

  // Socket setup
  useEffect(() => {
    const socket = socketRef.current
    socket.emit('presenter:join', { sessionId })

    socket.on('responses:update', ({ slideIndex, responses: r }: { slideIndex: number; responses: StoredResponse[] }) => {
      if (slideIndex === currentSlide) setResponses(r)
    })

    socket.on('audience:count', ({ count }: { count: number }) => {
      setAudienceCount(count)
    })

    socket.on('responses:lock', ({ locked: l }: { locked: boolean }) => {
      setLocked(l)
    })

    return () => {
      socket.off('responses:update')
      socket.off('audience:count')
      socket.off('responses:lock')
    }
  }, [sessionId, currentSlide])

  const goToSlide = useCallback((idx: number) => {
    setCurrentSlide(idx)
    setResponses([])
    setLocked(false)
    socketRef.current.emit('presenter:slide', { sessionId, slideIndex: idx })
  }, [sessionId])

  const toggleLock = useCallback(() => {
    const next = !locked
    setLocked(next)
    socketRef.current.emit('presenter:lock', { sessionId, locked: next })
  }, [locked, sessionId])

  const joinUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${code}`

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 text-lg">Cargando sesión...</div>
      </div>
    )
  }

  const slide = session.slides[currentSlide]

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
        <div>
          <h1 className="text-lg font-bold text-white">{session.title}</h1>
          <p className="text-slate-400 text-sm">
            Slide {currentSlide + 1} / {session.slides.length}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm">{audienceCount} en vivo</span>
          </div>
          <button
            onClick={() => setShowQR(v => !v)}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors"
          >
            {showQR ? 'Ocultar QR' : 'Mostrar QR'}
          </button>
          <button
            onClick={toggleLock}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              locked ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
            }`}
          >
            {locked ? '🔒 Cerrado' : '🔓 Abierto'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main area */}
        <div className="flex-1 flex flex-col p-8 overflow-y-auto">
          {/* Question */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-sm mb-3">
              {slide.type === 'poll' && '📊 Votación'}
              {slide.type === 'wordcloud' && '☁️ Nube de palabras'}
              {slide.type === 'quiz' && '🏆 Quiz'}
              {slide.type === 'qa' && '💬 Q&A'}
            </div>
            <h2 className="text-4xl font-bold text-white leading-tight">{slide.question}</h2>
          </div>

          {/* Results visualization */}
          <div className="flex-1 bg-slate-900 rounded-2xl border border-slate-800 p-6">
            {responses.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
                <span className="text-5xl">⏳</span>
                <p className="text-lg">Esperando respuestas...</p>
                <p className="text-sm">La audiencia debe ir a <span className="text-indigo-400 font-mono">{joinUrl}</span></p>
              </div>
            ) : (
              <>
                {(slide.type === 'poll' || slide.type === 'quiz') && (
                  <LiveBarChart slide={slide} responses={responses} />
                )}
                {slide.type === 'wordcloud' && (
                  <LiveWordCloud responses={responses} />
                )}
                {slide.type === 'qa' && (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {responses.map((r, i) => (
                      <div key={i} className="bg-slate-800 rounded-xl px-4 py-3">
                        <p className="text-white">{r.answer}</p>
                        <p className="text-slate-500 text-xs mt-1">{r.name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => goToSlide(currentSlide - 1)}
              disabled={currentSlide === 0}
              className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white font-medium transition-all"
            >
              ← Anterior
            </button>
            <div className="flex gap-2">
              {session.slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goToSlide(i)}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    i === currentSlide ? 'bg-indigo-500' : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => goToSlide(currentSlide + 1)}
              disabled={currentSlide === session.slides.length - 1}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white font-medium transition-all"
            >
              Siguiente →
            </button>
          </div>
        </div>

        {/* QR sidebar */}
        {showQR && (
          <div className="w-72 border-l border-slate-800 bg-slate-900 flex flex-col items-center justify-center p-6 gap-4">
            <p className="text-slate-400 text-sm font-medium text-center">Escanea para participar</p>
            {qrDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="QR Code" className="rounded-xl w-48 h-48 object-contain" />
            )}
            <div className="bg-slate-800 rounded-xl px-4 py-3 text-center w-full">
              <p className="text-slate-400 text-xs mb-1">Código</p>
              <p className="text-3xl font-bold font-mono tracking-widest text-white">{code}</p>
            </div>
            <p className="text-slate-500 text-xs text-center break-all">{joinUrl}</p>
          </div>
        )}
      </div>
    </div>
  )
}
