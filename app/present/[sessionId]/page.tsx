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

const SLIDE_BADGE: Record<string, { label: string; bg: string }> = {
  poll:      { label: '📊 Votación',        bg: '#cce7ff' },
  wordcloud: { label: '☁️ Nube de palabras', bg: '#f1e6ff' },
  quiz:      { label: '🏆 Quiz',             bg: '#d3f6e3' },
  qa:        { label: '💬 Q&A',              bg: '#fff2be' },
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
  const [copied, setCopied] = useState(false)
  const socketRef = useRef(getSocket())

  useEffect(() => {
    if (!code) return
    fetch(`/api/sessions/join?code=${code}`).then(r => r.json()).then(data => { if (data.error) return })
  }, [code])

  useEffect(() => {
    if (!code) return
    fetch(`/api/sessions/full?code=${code}`)
      .then(r => r.json())
      .then(data => { if (data.session) setSession(data.session) })
  }, [code])

  useEffect(() => {
    if (!code) return
    const url = `${window.location.origin}/join/${code}`
    QRCode.toDataURL(url, { width: 280, margin: 2, color: { dark: '#0a0d12', light: '#fafdff' } })
      .then(setQrDataUrl)
  }, [code])

  useEffect(() => {
    const socket = socketRef.current
    // Pass code so server can populate sessionCodeMap and use correct Redis key
    socket.emit('presenter:join', { sessionId, code })
    socket.on('responses:update', ({ slideIndex, responses: r }: { slideIndex: number; responses: StoredResponse[] }) => {
      if (slideIndex === currentSlide) setResponses(r)
    })
    socket.on('audience:count', ({ count }: { count: number }) => setAudienceCount(count))
    socket.on('responses:lock', ({ locked: l }: { locked: boolean }) => setLocked(l))
    return () => {
      socket.off('responses:update')
      socket.off('audience:count')
      socket.off('responses:lock')
    }
  }, [sessionId, code, currentSlide])

  const goToSlide = useCallback((idx: number) => {
    setCurrentSlide(idx)
    setResponses([])
    setLocked(false)
    // Pass code so server uses correct Redis key (keyed by code, not UUID)
    socketRef.current.emit('presenter:slide', { sessionId, code, slideIndex: idx })
  }, [sessionId, code])

  const toggleLock = useCallback(() => {
    const next = !locked
    setLocked(next)
    // Pass code for same reason as above
    socketRef.current.emit('presenter:lock', { sessionId, code, locked: next })
  }, [locked, sessionId, code])

  const handleCopyViewerLink = useCallback(() => {
    const url = `${window.location.origin}/view/${sessionId}?code=${code}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [sessionId, code])

  const joinUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${code}`

  if (!session) {
    return (
      <div className="min-h-screen bg-[#ebf5ff] flex items-center justify-center">
        <div className="text-[#535862] text-[16px] font-medium">Cargando sesión...</div>
      </div>
    )
  }

  const slide = session.slides[currentSlide]
  const badge = SLIDE_BADGE[slide.type]

  // Background darkening: results card subtly tints as more responses come in.
  // At 0 responses: #fafdff (Paper White). At 35+: ~6% darker. Max imperceptible shift.
  const _d = Math.min(responses.length / 35, 1) * 0.06
  const cardBg = `rgb(${Math.round(250*(1-_d)+10*_d)},${Math.round(253*(1-_d)+13*_d)},${Math.round(255*(1-_d)+18*_d)})`

  return (
    <div className="min-h-screen bg-[#ebf5ff] flex flex-col">

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#535862] bg-[#fafdff]">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-[6px] bg-[#181d27] flex items-center justify-center">
            <span className="text-white text-[10px] font-semibold">P</span>
          </div>
          <div>
            <h1 className="text-[16px] font-medium text-[#0a0d12] tracking-[-0.01em] leading-none">{session.title}</h1>
            <p className="text-[12px] text-[#93979f] font-medium mt-0.5">
              Slide {currentSlide + 1} / {session.slides.length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[9999px] bg-[#d3f6e3] border border-[#535862]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
            <span className="text-[13px] font-medium text-[#0a0d12]">{audienceCount} en vivo</span>
          </div>
          <button
            onClick={handleCopyViewerLink}
            className={`px-4 py-1.5 rounded-[9999px] border text-[13px] font-medium transition-all duration-200 ${
              copied
                ? 'bg-[#d3f6e3] border-[#10b981] text-[#0a0d12]'
                : 'border-[#535862] bg-transparent hover:bg-[#0a0d12] hover:text-white hover:border-[#0a0d12] text-[#0a0d12]'
            }`}
          >
            {copied ? '✓ Copiado' : '🤝 Compartir control'}
          </button>
          <button
            onClick={() => setShowQR(v => !v)}
            className="px-4 py-1.5 rounded-[9999px] border border-[#535862] bg-transparent hover:bg-[#0a0d12] hover:text-white hover:border-[#0a0d12] text-[#0a0d12] text-[13px] font-medium transition-all duration-200"
          >
            {showQR ? 'Ocultar QR' : 'Mostrar QR'}
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
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main area */}
        <div className="flex-1 flex flex-col p-8 overflow-y-auto">

          {/* Question */}
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

          {/* Results */}
          <div className="flex-1 rounded-[32px] border border-[#535862] p-6 shadow-[rgba(4,69,144,0.08)_0px_14px_20px_4px]" style={{ backgroundColor: cardBg, transition: 'background-color 0.6s ease' }}>
            {responses.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="w-14 h-14 rounded-[16px] bg-[#cce7ff] flex items-center justify-center text-2xl">⏳</div>
                <p className="text-[#0a0d12] text-[16px] font-medium">Esperando respuestas...</p>
                <p className="text-[#535862] text-[13px]">
                  La audiencia debe ir a{' '}
                  <span className="text-[#0099ff] font-medium">{joinUrl}</span>
                </p>
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

          {/* Navigation */}
          <div className="flex items-center justify-between mt-5">
            <button
              onClick={() => goToSlide(currentSlide - 1)}
              disabled={currentSlide === 0}
              className="px-6 py-2.5 rounded-[9999px] border border-[#535862] bg-[#fafdff] hover:bg-[#0a0d12] hover:text-white hover:border-[#0a0d12] disabled:opacity-30 text-[#0a0d12] text-[14px] font-medium transition-all duration-200"
            >
              ← Anterior
            </button>
            <div className="flex gap-2">
              {session.slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goToSlide(i)}
                  className="w-2.5 h-2.5 rounded-full transition-all duration-200"
                  style={{ backgroundColor: i === currentSlide ? '#181d27' : '#93979f' }}
                />
              ))}
            </div>
            <button
              onClick={() => goToSlide(currentSlide + 1)}
              disabled={currentSlide === session.slides.length - 1}
              className="px-6 py-2.5 rounded-[9999px] bg-[#181d27] hover:opacity-90 disabled:opacity-30 text-white text-[14px] font-medium transition-all duration-200"
            >
              Siguiente →
            </button>
          </div>
        </div>

        {/* QR sidebar */}
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
