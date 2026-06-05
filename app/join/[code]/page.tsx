'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { getSocket, disconnectSocket } from '@/lib/socket'
import { Slide } from '@/lib/redis'
import PollSlide from '@/components/slides/PollSlide'
import WordCloudSlide from '@/components/slides/WordCloudSlide'
import QuizSlide from '@/components/slides/QuizSlide'
import QASlide from '@/components/slides/QASlide'

type Phase = 'name' | 'waiting' | 'slide' | 'ended'

const SLIDE_BADGE: Record<string, { label: string; bg: string }> = {
  poll:      { label: '📊 Votación',        bg: '#cce7ff' },
  wordcloud: { label: '☁️ Nube de palabras', bg: '#f1e6ff' },
  quiz:      { label: '🏆 Quiz',             bg: '#d3f6e3' },
  qa:        { label: '💬 Pregunta abierta', bg: '#fff2be' },
}

export default function JoinPage() {
  const { code } = useParams<{ code: string }>()
  const [phase, setPhase] = useState<Phase>('name')
  const [name, setName] = useState('')
  const [slide, setSlide] = useState<Slide | null>(null)
  const [slideIndex, setSlideIndex] = useState(0)
  const [locked, setLocked] = useState(false)
  const [sessionTitle, setSessionTitle] = useState('')
  const [error, setError] = useState('')
  const socketRef = useRef(getSocket())

  const upperCode = code?.toUpperCase()

  useEffect(() => {
    if (!upperCode) return
    fetch(`/api/sessions/join?code=${upperCode}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError('Sesión no encontrada. Verifica el código.')
        else setSessionTitle(data.title)
      })
      .catch(() => setError('No se pudo conectar al servidor'))
  }, [upperCode])

  const joinSession = useCallback(() => {
    const socket = socketRef.current
    socket.emit('audience:join', { code: upperCode, name: name.trim() || 'Anónimo' })
    setPhase('waiting')

    socket.on('slide:current', ({ slide: s, slideIndex: i, locked: l }: { slide: Slide | null; slideIndex: number; locked: boolean }) => {
      if (s) { setSlide(s); setSlideIndex(i); setLocked(l); setPhase('slide') }
    })
    socket.on('responses:lock', ({ locked: l }: { locked: boolean }) => setLocked(l))
    socket.on('error', ({ message }: { message: string }) => { setError(message); setPhase('name') })
  }, [upperCode, name])

  useEffect(() => {
    const socket = socketRef.current
    return () => {
      socket.off('slide:current')
      socket.off('responses:lock')
      socket.off('error')
      disconnectSocket()
    }
  }, [])

  const handleAnswer = useCallback((answer: string) => {
    socketRef.current.emit('audience:answer', { code: upperCode, slideIndex, answer })
  }, [upperCode, slideIndex])

  // ── Name entry ──
  if (phase === 'name') {
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
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && joinSession()}
              placeholder="Tu nombre (opcional)"
              className="w-full px-4 py-3 rounded-[16px] bg-[#ffffff] border border-[#535862] focus:border-[#0099ff] focus:outline-none text-[#0a0d12] text-[16px] font-medium placeholder:text-[#93979f] tracking-[-0.01em] transition-all duration-200 mb-4"
              autoFocus
            />
            <button
              onClick={joinSession}
              disabled={!!error}
              className="w-full py-3 rounded-[9999px] bg-[#181d27] hover:opacity-90 disabled:bg-[#f6f7f8] disabled:text-[#93979f] text-white text-[16px] font-medium tracking-[-0.01em] transition-all duration-200"
            >
              Entrar →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Waiting ──
  if (phase === 'waiting') {
    return (
      <div className="min-h-screen bg-[#ebf5ff] flex flex-col items-center justify-center gap-5 px-5">
        {/* Animated dots indicator */}
        <div className="flex gap-2">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-3 h-3 rounded-full bg-[#4fbeff] animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        <div className="text-center">
          <h2 className="text-[20px] font-medium text-[#0a0d12] tracking-[-0.02em]">Esperando al presentador...</h2>
          <p className="text-[#535862] text-[14px] font-medium mt-1">La sesión empezará pronto</p>
          {sessionTitle && (
            <span className="inline-block mt-3 px-3 py-1 rounded-[9999px] bg-[#fafdff] border border-[#535862] text-[#0a0d12] text-[13px] font-medium">
              {sessionTitle}
            </span>
          )}
        </div>
      </div>
    )
  }

  // ── Active slide ──
  if (phase === 'slide' && slide) {
    const badge = SLIDE_BADGE[slide.type]
    return (
      <div className="min-h-screen bg-[#ebf5ff] flex flex-col px-5 py-8">
        <div className="max-w-lg mx-auto w-full flex flex-col gap-5">

          {/* Header */}
          <div className="flex items-center justify-between">
            <span
              className="px-3 py-1 rounded-[9999px] text-[12px] font-medium text-[#0a0d12]"
              style={{ backgroundColor: badge.bg }}
            >
              {badge.label}
            </span>
            <span className="text-[#93979f] text-[12px] font-mono font-medium tracking-widest">{upperCode}</span>
          </div>

          {/* Question */}
          <h2 className="text-[22px] font-medium text-[#0a0d12] leading-[1.3] tracking-[-0.02em]">
            {slide.question}
          </h2>

          {/* Slide component — key fuerza remount al cambiar slide */}
          <div className="bg-[#fafdff] rounded-[32px] border border-[#535862] p-5 shadow-[rgba(4,69,144,0.08)_0px_14px_20px_4px]">
            {slide.type === 'poll' && (
              <PollSlide key={slideIndex} slide={slide} locked={locked} onAnswer={handleAnswer} />
            )}
            {slide.type === 'wordcloud' && (
              <WordCloudSlide key={slideIndex} locked={locked} onAnswer={handleAnswer} />
            )}
            {slide.type === 'quiz' && (
              <QuizSlide key={slideIndex} slide={slide} locked={locked} onAnswer={handleAnswer} />
            )}
            {slide.type === 'qa' && (
              <QASlide key={slideIndex} locked={locked} onAnswer={handleAnswer} />
            )}
          </div>

        </div>
      </div>
    )
  }

  return null
}
