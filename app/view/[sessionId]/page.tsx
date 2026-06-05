'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { getSocket, disconnectSocket } from '@/lib/socket'
import { Slide, StoredResponse } from '@/lib/redis'
import LiveBarChart from '@/components/charts/LiveBarChart'
import LiveWordCloud from '@/components/charts/LiveWordCloud'

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
  const [error, setError] = useState('')
  const socketRef = useRef(getSocket())

  // Load session metadata for the title
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

  // Connect socket as viewer
  useEffect(() => {
    if (!code || !sessionId) return
    const socket = socketRef.current

    socket.emit('view:join', { sessionId, code })

    socket.on('slide:current', ({ slide: s, slideIndex: i }: { slide: Slide | null; slideIndex: number }) => {
      if (s) {
        setSlide(s)
        setSlideIndex(i)
        setResponses([]) // clear for new slide; responses:update will repopulate if any
      }
    })

    socket.on('responses:update', ({ responses: r }: { slideIndex: number; responses: StoredResponse[] }) => {
      setResponses(r)
    })

    socket.on('error', ({ message }: { message: string }) => setError(message))

    return () => {
      const s = socketRef.current
      s.off('slide:current')
      s.off('responses:update')
      s.off('error')
      disconnectSocket()
    }
  }, [code, sessionId])

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

  // Background darkening — same mechanic as presenter view
  const _d = Math.min(responses.length / 35, 1) * 0.06
  const cardBg = `rgb(${Math.round(250*(1-_d)+10*_d)},${Math.round(253*(1-_d)+13*_d)},${Math.round(255*(1-_d)+18*_d)})`

  return (
    <div className="min-h-screen bg-[#ebf5ff] flex flex-col">

      {/* Top bar — read-only, no controls */}
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
              Vista de colaborador · Slide {slideIndex + 1}
            </p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-[9999px] bg-[#f1e6ff] border border-[#535862] text-[#0a0d12] text-[12px] font-medium">
          👁 Solo lectura
        </span>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col p-8 max-w-4xl mx-auto w-full">

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

      </div>
    </div>
  )
}
