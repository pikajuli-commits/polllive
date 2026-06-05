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

  // Verify session exists
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
      if (s) {
        setSlide(s)
        setSlideIndex(i)
        setLocked(l)
        setPhase('slide')
      }
    })

    socket.on('responses:lock', ({ locked: l }: { locked: boolean }) => {
      setLocked(l)
    })

    socket.on('error', ({ message }: { message: string }) => {
      setError(message)
      setPhase('name')
    })
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
    socketRef.current.emit('audience:answer', {
      code: upperCode,
      slideIndex,
      answer,
    })
  }, [upperCode, slideIndex])

  // Name entry screen
  if (phase === 'name') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-5">
        <div className="w-full max-w-sm">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-sm">
              {error}
            </div>
          )}
          <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">👋</div>
              <h1 className="text-2xl font-bold text-white">Únete a la sesión</h1>
              {sessionTitle && <p className="text-slate-400 text-sm mt-1">{sessionTitle}</p>}
              <p className="text-indigo-400 font-mono text-xl mt-2 tracking-widest">{upperCode}</p>
            </div>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && joinSession()}
              placeholder="Tu nombre (opcional)"
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 focus:border-indigo-500 text-white text-lg outline-none transition-colors mb-4"
              autoFocus
            />
            <button
              onClick={joinSession}
              disabled={!!error}
              className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white text-lg font-bold transition-all"
            >
              Entrar →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Waiting for presenter
  if (phase === 'waiting') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 px-5">
        <div className="text-6xl animate-bounce">⏳</div>
        <h2 className="text-white text-xl font-semibold">Esperando al presentador...</h2>
        <p className="text-slate-500 text-sm">La sesión empezará pronto</p>
        {sessionTitle && <p className="text-indigo-400 text-sm">{sessionTitle}</p>}
      </div>
    )
  }

  // Active slide
  if (phase === 'slide' && slide) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col px-5 py-8">
        <div className="max-w-lg mx-auto w-full flex flex-col gap-6">
          {/* Slide type badge */}
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-sm">
              {slide.type === 'poll' && '📊 Votación'}
              {slide.type === 'wordcloud' && '☁️ Nube de palabras'}
              {slide.type === 'quiz' && '🏆 Quiz'}
              {slide.type === 'qa' && '💬 Pregunta abierta'}
            </span>
            <span className="text-slate-600 text-xs font-mono">{upperCode}</span>
          </div>

          {/* Question */}
          <h2 className="text-2xl font-bold text-white leading-snug">{slide.question}</h2>

          {/* Slide component */}
          {slide.type === 'poll' && (
            <PollSlide slide={slide} locked={locked} onAnswer={handleAnswer} />
          )}
          {slide.type === 'wordcloud' && (
            <WordCloudSlide locked={locked} onAnswer={handleAnswer} />
          )}
          {slide.type === 'quiz' && (
            <QuizSlide slide={slide} locked={locked} onAnswer={handleAnswer} />
          )}
          {slide.type === 'qa' && (
            <QASlide locked={locked} onAnswer={handleAnswer} />
          )}
        </div>
      </div>
    )
  }

  return null
}
