'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { getSocket, disconnectSocket } from '@/lib/socket'
import { Slide, StoredResponse } from '@/lib/redis'
import LiveBarChart from '@/components/charts/LiveBarChart'
import LiveWordCloud from '@/components/charts/LiveWordCloud'
import QRCode from 'qrcode'

interface SessionData {
  title: string
  slides: Slide[]
}

const SLIDE_BADGE: Record<string, { label: string; bg: string }> = {
  poll:      { label: '📊 Votación',        bg: '#cce7ff' },
  wordcloud: { label: '☁️ Nube de palabras', bg: '#f1e6ff' },
  quiz:      { label: '🏆 Quiz',             bg: '#d3f6e3' },
  qa:        { label: '💬 Q&A',              bg: '#fff2be' },
}

export default function ViewPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const searchParams = useSearchParams()
  const code = searchParams.get('code') || ''

  const [session, setSession] = useState<SessionData | null>(null)
  const [slide, setSlide] = useState<Slide | null>(null)
  const [slideIndex, setSlideIndex] = useState(0)
  const [responses, setResponses] = useState<StoredResponse[]>([])
  const [locked, setLocked] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [duplicated, setDuplicated] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [showQR, setShowQR] = useState(false)
  const [error, setError] = useState('')
  const socketRef = useRef(getSocket())

  // Load full session data for navigation dot count
  useEffect(() => {
    if (!code) return
    fetch(`/api/sessions/full?code=${code}`)
      .then(r => r.json())
      .then(data => {
        if (data.session) setSession(data.session)
        else setError('Sesión no encontrada. Verifica el enlace.')
      })
      .catch(() => setError('No se pudo conectar al servidor'))
  }, [code])

  // Generate QR for audience join link
  useEffect(() => {
    if (!code) return
    const url = `${window.location.origin}/join/${code}`
    QRCode.toDataURL(url, { width: 280, margin: 2, color: { dark: '#0a0d12', light: '#fafdff' } })
      .then(setQrDataUrl)
  }, [code])

  // Connect socket as co-presenter
  useEffect(() => {
    if (!code || !sessionId) return
    const socket = socketRef.current

    socket.emit('view:join', { sessionId, code })

    socket.on('slide:current', ({ slide: s, slideIndex: i, locked: l }: { slide: Slide | null; slideIndex: number; locked: boolean }) => {
      if (s) {
        setSlide(s)
        setSlideIndex(i)
        setLocked(l ?? false)
        setResponses([])
      }
    })

    socket.on('responses:update', ({ responses: r }: { slideIndex: number; responses: StoredResponse[] }) => {
      setResponses(r)
    })

    socket.on('responses:lock', ({ locked: l }: { locked: boolean }) => setLocked(l))

    socket.on('error', ({ message }: { message: string }) => setError(message))

    return () => {
      const s = socketRef.current
      s.off('slide:current')
      s.off('responses:update')
      s.off('responses:lock')
      s.off('error')
      disconnectSocket()
    }
  }, [code, sessionId])

  const goToSlide = useCallback((idx: number) => {
    setSlideIndex(idx)
    setResponses([])
    setLocked(false)
    socketRef.current.emit('presenter:slide', { sessionId, code, slideIndex: idx })
  }, [sessionId, code])

  const toggleLock = useCallback(() => {
    const next = !locked
    setLocked(next)
    socketRef.current.emit('presenter:lock', { sessionId, code, locked: next })
  }, [locked, sessionId, code])

  const handleClear = useCallback(() => {
    if (!confirmClear) {
      setConfirmClear(true)
      setTimeout(() => setConfirmClear(false), 3000)
      return
    }
    setConfirmClear(false)
    setResponses([])
    socketRef.current.emit('presenter:clear', { sessionId, code, slideIndex })
  }, [confirmClear, sessionId, code, slideIndex])

  const handleDuplicate = useCallback(async () => {
    if (!session) return
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `Copia de ${session.title}`, slides: session.slides }),
      })
      const data = await res.json()
      if (!res.ok) return
      const url = `${window.location.origin}/present/${data.session.id}?code=${data.session.code}`
      await navigator.clipboard.writeText(url)
      setDuplicated(true)
      setTimeout(() => setDuplicated(false), 3000)
    } catch { /* ignore */ }
  }, [session])

  // ── Error state ──
  if (error) {
    return (
      <div className="min-h-screen bg-[#ebf5ff] flex items-center justify-center px-5">
        <div className="bg-[#ffe4d4] border border-[#f26110] rounded-[16px] px-6 py-4 text-[#0a0d12] font-medium text-[15px]">
          {error}
        </div>
      </div>
    )
  }

  // ── Connecting / waiting for first slide ──
  if (!slide) {
    return (
      <div className="min-h-screen bg-[#ebf5ff] flex flex-col items-center justify-center gap-4">
        <div className="flex gap-2">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-3 h-3 rounded-full bg-[#4fbeff] animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        <p className="text-[#535862] text-[15px] font-medium">Conectando a la sesión...</p>
        {session && (
          <span className="mt-1 px-3 py-1 rounded-[9999px] bg-[#fafdff] border border-[#535862] text-[#0a0d12] text-[13px] font-medium">
            {session.title}
          </span>
        )}
      </div>
    )
  }

  const badge = SLIDE_BADGE[slide.type]
  const _d = Math.min(responses.length / 35, 1) * 0.06
  const cardBg = `rgb(${Math.round(250*(1-_d)+10*_d)},${Math.round(253*(1-_d)+13*_d)},${Math.round(255*(1-_d)+18*_d)})`
  const joinUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${code}`

  return (
    <div className="min-h-screen bg-[#ebf5ff] flex flex-col">

      {/* Top bar — co-presenter controls */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#535862] bg-[#fafdff]">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-[6px] bg-[#181d27] flex items-center justify-center">
            <span className="text-white text-[10px] font-semibold">P</span>
          </div>
          <div>
            <h1 className="text-[16px] font-medium text-[#0a0d12] tracking-[-0.01em] leading-none">
              {session?.title ?? '—'}
            </h1>
            <p className="text-[12px] text-[#93979f] font-medium mt-0.5">
              Slide {slideIndex + 1} / {session?.slides.length ?? '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDuplicate}
            className={`px-4 py-1.5 rounded-[9999px] border text-[13px] font-medium transition-all duration-200 ${
              duplicated
                ? 'bg-[#d3f6e3] border-[#10b981] text-[#0a0d12]'
                : 'border-[#535862] bg-transparent hover:bg-[#0a0d12] hover:text-white hover:border-[#0a0d12] text-[#0a0d12]'
            }`}
          >
            {duplicated ? '✓ Enlace copiado' : '📋 Duplicar'}
          </button>
          <a
            href={`/edit/${code}`}
            className="px-4 py-1.5 rounded-[9999px] border border-[#535862] bg-transparent hover:bg-[#0a0d12] hover:text-white hover:border-[#0a0d12] text-[#0a0d12] text-[13px] font-medium transition-all duration-200"
          >
            ✏️ Editar
          </a>
          <button
            onClick={() => setShowQR(v => !v)}
            className="px-4 py-1.5 rounded-[9999px] border border-[#535862] bg-transparent hover:bg-[#0a0d12] hover:text-white hover:border-[#0a0d12] text-[#0a0d12] text-[13px] font-medium transition-all duration-200"
          >
            {showQR ? 'Ocultar QR' : 'Mostrar QR'}
          </button>
          <button
            onClick={handleClear}
            className={`px-4 py-1.5 rounded-[9999px] border text-[13px] font-medium transition-all duration-200 ${
              confirmClear
                ? 'bg-[#ffe4d4] border-[#f26110] text-[#f26110] animate-pulse'
                : 'border-[#535862] bg-transparent hover:bg-[#f26110] hover:text-white hover:border-[#f26110] text-[#0a0d12]'
            }`}
          >
            {confirmClear ? '¿Confirmar borrado?' : '🗑️ Borrar todo'}
          </button>
          <button
            onClick={toggleLock}
            className={`px-4 py-1.5 rounded-[9999px] border text-[13px] font-medium transition-all duration-200 ${
              locked
                ? 'bg-[#ffe4d4] border-[#f26110] text-[#0a0d12]'
                : 'bg-[#d3f6e3] border-[#535862] text-[#0a0d12]'
            }`}
          >
            {locked ? '🔒 Cerrado' : '🔓 Abierto'}
          </button>
          <span className="px-3 py-1 rounded-[9999px] bg-[#f1e6ff] border border-[#535862] text-[#0a0d12] text-[12px] font-medium">
            🤝 Co-presentador
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 flex flex-col p-8 overflow-y-auto">

          {/* Badge + question */}
          <div className="mb-6">
            <span
              className="inline-flex items-center px-3 py-1 rounded-[9999px] text-[13px] font-medium text-[#0a0d12] mb-3"
              style={{ backgroundColor: badge.bg }}
            >
              {badge.label}
            </span>
            <h2 className="text-[32px] font-medium leading-[1.2] tracking-[-0.64px] text-[#0a0d12]">
              {slide.question}
            </h2>
          </div>

          {/* Live results card */}
          <div className="flex-1 rounded-[32px] border border-[#535862] p-6 shadow-[rgba(4,69,144,0.08)_0px_14px_20px_4px]" style={{ backgroundColor: cardBg, transition: 'background-color 0.6s ease' }}>
            {responses.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[240px] gap-3">
                <div className="w-14 h-14 rounded-[16px] bg-[#cce7ff] flex items-center justify-center text-2xl">⏳</div>
                <p className="text-[#0a0d12] text-[16px] font-medium">Esperando respuestas...</p>
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
                  <div className="space-y-3 max-h-[480px] overflow-y-auto">
                    {responses.map((r, i) => (
                      <div key={i} className="bg-[#ebf5ff] rounded-[16px] px-4 py-3 border border-[#535862]">
                        <p className="text-[#0a0d12] text-[15px] font-medium">{r.answer}</p>
                        <p className="text-[#93979f] text-[12px] mt-1">{r.name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Navigation — identical behavior to present page */}
          <div className="flex items-center justify-between mt-5">
            <button
              onClick={() => goToSlide(slideIndex - 1)}
              disabled={slideIndex === 0}
              className="px-6 py-2.5 rounded-[9999px] border border-[#535862] bg-[#fafdff] hover:bg-[#0a0d12] hover:text-white hover:border-[#0a0d12] disabled:opacity-30 text-[#0a0d12] text-[14px] font-medium transition-all duration-200"
            >
              ← Anterior
            </button>
            <div className="flex gap-2">
              {session?.slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goToSlide(i)}
                  className="w-2.5 h-2.5 rounded-full transition-all duration-200"
                  style={{ backgroundColor: i === slideIndex ? '#181d27' : '#93979f' }}
                />
              ))}
            </div>
            <button
              onClick={() => goToSlide(slideIndex + 1)}
              disabled={!session || slideIndex === session.slides.length - 1}
              className="px-6 py-2.5 rounded-[9999px] bg-[#181d27] hover:opacity-90 disabled:opacity-30 text-white text-[14px] font-medium transition-all duration-200"
            >
              Siguiente →
            </button>
          </div>
        </div>

        {/* QR sidebar — same as present page */}
        {showQR && (
          <div className="w-68 border-l border-[#535862] bg-[#fafdff] flex flex-col items-center justify-center p-6 gap-4">
            <p className="text-[#535862] text-[13px] font-medium text-center">Escanea para participar</p>
            {qrDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt="QR Code"
                className="rounded-[16px] w-44 h-44 object-contain border border-[#535862]"
              />
            )}
            <div className="bg-[#ebf5ff] rounded-[16px] px-4 py-3 text-center w-full border border-[#535862]">
              <p className="text-[#93979f] text-[11px] font-medium mb-1 uppercase tracking-widest">Código</p>
              <p className="text-[28px] font-semibold font-mono tracking-[0.1em] text-[#0a0d12]">{code}</p>
            </div>
            <p className="text-[#93979f] text-[11px] text-center break-all">{joinUrl}</p>
          </div>
        )}
      </div>
    </div>
  )
}
