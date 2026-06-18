'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { getSocket, disconnectSocket } from '@/lib/socket'
import { Slide } from '@/lib/redis'
import PollSlide from '@/components/slides/PollSlide'
import WordCloudSlide from '@/components/slides/WordCloudSlide'
import QuizSlide from '@/components/slides/QuizSlide'
import QASlide from '@/components/slides/QASlide'

type Phase = 'joining' | 'form'

const SLIDE_BADGE: Record<string, { label: string; bg: string }> = {
  poll:      { label: '📊 Votación',        bg: '#cce7ff' },
  wordcloud: { label: '☁️ Nube de palabras', bg: '#f1e6ff' },
  quiz:      { label: '🏆 Quiz',             bg: '#d3f6e3' },
  qa:        { label: '💬 Pregunta abierta', bg: '#fff2be' },
}

export default function JoinPage() {
  const { code } = useParams<{ code: string }>()
  const [phase, setPhase] = useState<Phase>('joining')
  const [slides, setSlides] = useState<Slide[]>([])
  const [locked, setLocked] = useState(false)
  const [sessionTitle, setSessionTitle] = useState('')
  const [error, setError] = useState('')
  const [resetKey, setResetKey] = useState(0)
  const socketRef = useRef(getSocket())

  const upperCode = code?.toUpperCase()

  // Fetch all slides upfront
  useEffect(() => {
    if (!upperCode) return
    fetch(`/api/sessions/full?code=${upperCode}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError('Sesión no encontrada. Verifica el código.')
        else {
          setSessionTitle(data.session.title)
          setSlides(data.session.slides)
        }
      })
      .catch(() => setError('No se pudo conectar al servidor'))
  }, [upperCode])

  const joinSession = useCallback(() => {
    const socket = socketRef.current
    socket.emit('audience:join', { code: upperCode, name: 'Anónimo' })
    socket.on('responses:lock', ({ locked: l }: { locked: boolean }) => setLocked(l))
    socket.on('session:reset', () => setResetKey(k => k + 1))
    socket.on('error', ({ message }: { message: string }) => setError(message))
    setPhase('form')
  }, [upperCode])

  useEffect(() => {
    const socket = socketRef.current
    return () => {
      socket.off('responses:lock')
      socket.off('session:reset')
      socket.off('error')
      disconnectSocket()
    }
  }, [])

  const handleAnswer = useCallback((slideIndex: number, answer: string, name?: string) => {
    socketRef.current.emit('audience:answer', { code: upperCode, slideIndex, answer, name })
  }, [upperCode])

  // ── Entry screen ──
  if (phase === 'joining') {
    return (
      <div className="min-h-screen bg-[#ebf5ff] flex flex-col items-center justify-center px-5">
        <div className="w-full max-w-sm">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-[16px] bg-[#ffe4d4] border border-[#f26110] text-[#0a0d12] text-[14px] font-medium">
              {error}
            </div>
          )}
          <div className="bg-[#fafdff] rounded-[32px] p-8 border border-[#535862] shadow-[rgba(4,69,144,0.08)_0px_14px_20px_4px]">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-[16px] bg-[#cce7ff] flex items-center justify-center text-3xl mx-auto mb-4">
                👋
              </div>
              <h1 className="text-[24px] font-medium text-[#0a0d12] tracking-[-0.02em]">Únete a la sesión</h1>
              {sessionTitle && (
                <p className="text-[#535862] text-[14px] font-medium mt-1">{sessionTitle}</p>
              )}
              <span className="inline-block mt-2 px-3 py-1 rounded-[9999px] bg-[#ebf5ff] border border-[#535862] text-[#0a0d12] font-mono text-[18px] font-semibold tracking-[0.1em]">
                {upperCode}
              </span>
            </div>
            <button
              onClick={joinSession}
              disabled={!!error || slides.length === 0}
              className="w-full py-3 rounded-[9999px] bg-[#181d27] hover:opacity-90 disabled:bg-[#f6f7f8] disabled:text-[#93979f] text-white text-[16px] font-medium tracking-[-0.01em] transition-all duration-200"
            >
              {slides.length === 0 && !error ? 'Cargando...' : 'Entrar →'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Self-paced multi-question form ──
  const questionCount = slides.filter(s => s.type !== 'section').length

  return (
    <div className="min-h-screen bg-[#ebf5ff] px-5 py-8">
      <div className="max-w-lg mx-auto flex flex-col gap-5">

        {/* Session header */}
        <div className="flex items-center justify-between">
          <h1 className="text-[20px] font-medium text-[#0a0d12] tracking-[-0.02em]">{sessionTitle}</h1>
          <span className="text-[#93979f] text-[12px] font-mono font-medium tracking-widest">{upperCode}</span>
        </div>

        {locked && (
          <div className="bg-[#fff2be] border border-[#bb9915] rounded-[16px] px-4 py-3 text-[#535862] text-[14px] text-center font-medium">
            🔒 Las respuestas están cerradas
          </div>
        )}

        {/* All slides */}
        {slides.map((slide, idx) => {
          // Section divider
          if (slide.type === 'section') {
            return (
              <div key={slide.id} className="flex items-center gap-3 mt-2">
                <div className="flex-1 h-px bg-[#535862] opacity-30" />
                <span className="px-4 py-1.5 rounded-[9999px] bg-[#181d27] text-white text-[13px] font-semibold tracking-[-0.01em] whitespace-nowrap">
                  📌 {slide.question}
                </span>
                <div className="flex-1 h-px bg-[#535862] opacity-30" />
              </div>
            )
          }

          const badge = SLIDE_BADGE[slide.type]
          return (
            <div key={slide.id} className="bg-[#fafdff] rounded-[32px] border border-[#535862] p-5 shadow-[rgba(4,69,144,0.08)_0px_14px_20px_4px]">
              <div className="mb-3">
                <span
                  className="px-3 py-1 rounded-[9999px] text-[12px] font-medium text-[#0a0d12]"
                  style={{ backgroundColor: badge.bg }}
                >
                  {badge.label}
                </span>
              </div>
              <h2 className="text-[18px] font-medium text-[#0a0d12] leading-[1.3] tracking-[-0.02em] mb-4">
                {slide.question}
              </h2>

              {/* key includes resetKey so components remount when presenter clears all responses */}
              {slide.type === 'poll' && (
                <PollSlide key={`${slide.id}-${resetKey}`} slide={slide} locked={locked} onAnswer={(ans) => handleAnswer(idx, ans)} />
              )}
              {slide.type === 'wordcloud' && (
                <WordCloudSlide key={`${slide.id}-${resetKey}`} locked={locked} onAnswer={(ans) => handleAnswer(idx, ans)} />
              )}
              {slide.type === 'quiz' && (
                <QuizSlide key={`${slide.id}-${resetKey}`} slide={slide} locked={locked} onAnswer={(ans) => handleAnswer(idx, ans)} />
              )}
              {slide.type === 'qa' && (
                <QASlide key={`${slide.id}-${resetKey}`} locked={locked} onAnswer={(ans, name) => handleAnswer(idx, ans, name)} />
              )}
            </div>
          )
        })}

        {questionCount > 0 && (
          <p className="text-center text-[#93979f] text-[12px] pb-6">
            {questionCount} {questionCount === 1 ? 'pregunta' : 'preguntas'} en esta sesión
          </p>
        )}
      </div>
    </div>
  )
}
