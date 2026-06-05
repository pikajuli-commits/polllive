'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { Slide, SlideType, SlideOption } from '@/lib/redis'

const SLIDE_TYPES: { value: SlideType; label: string; icon: string; desc: string }[] = [
  { value: 'poll', label: 'Votación', icon: '📊', desc: 'Múltiple opción con resultados en barra' },
  { value: 'wordcloud', label: 'Nube de palabras', icon: '☁️', desc: 'Respuesta libre, visualización en nube' },
  { value: 'quiz', label: 'Quiz', icon: '🏆', desc: 'Pregunta con opción correcta' },
  { value: 'qa', label: 'Q&A', icon: '💬', desc: 'La audiencia hace preguntas abiertas' },
]

function newOption(): SlideOption {
  return { id: uuidv4(), text: '' }
}

function newSlide(type: SlideType): Slide {
  const base = { id: uuidv4(), type, question: '' }
  if (type === 'poll' || type === 'quiz') {
    return { ...base, options: [newOption(), newOption()] }
  }
  return base
}

export default function CreatePage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [slides, setSlides] = useState<Slide[]>([newSlide('poll')])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const addSlide = (type: SlideType) => {
    setSlides(prev => [...prev, newSlide(type)])
  }

  const removeSlide = (idx: number) => {
    setSlides(prev => prev.filter((_, i) => i !== idx))
  }

  const updateSlide = (idx: number, patch: Partial<Slide>) => {
    setSlides(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))
  }

  const addOption = (slideIdx: number) => {
    setSlides(prev => prev.map((s, i) => {
      if (i !== slideIdx) return s
      return { ...s, options: [...(s.options || []), newOption()] }
    }))
  }

  const updateOption = (slideIdx: number, optIdx: number, text: string) => {
    setSlides(prev => prev.map((s, i) => {
      if (i !== slideIdx || !s.options) return s
      const opts = s.options.map((o, j) => j === optIdx ? { ...o, text } : o)
      return { ...s, options: opts }
    }))
  }

  const removeOption = (slideIdx: number, optIdx: number) => {
    setSlides(prev => prev.map((s, i) => {
      if (i !== slideIdx || !s.options) return s
      return { ...s, options: s.options.filter((_, j) => j !== optIdx) }
    }))
  }

  const handleCreate = async () => {
    if (!title.trim()) { setError('Agrega un título a la sesión'); return }
    if (slides.some(s => !s.question.trim())) { setError('Todas las slides necesitan una pregunta'); return }
    if (slides.some(s => (s.type === 'poll' || s.type === 'quiz') && (s.options?.some(o => !o.text.trim()) || (s.options?.length ?? 0) < 2))) {
      setError('Las votaciones y quizzes necesitan al menos 2 opciones completas'); return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), slides }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/present/${data.session.id}?code=${data.session.code}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al crear sesión')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-white mb-1">Nueva sesión</h1>
          <p className="text-slate-400">Crea tus slides y comparte el código QR con tu audiencia</p>
        </div>

        {/* Session title */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-slate-300 mb-2">Título de la sesión</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ej: Clase de economía — Semana 3"
            className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 focus:border-indigo-500 text-white text-lg outline-none transition-colors"
          />
        </div>

        {/* Slides */}
        <div className="space-y-6">
          {slides.map((slide, idx) => {
            const meta = SLIDE_TYPES.find(t => t.value === slide.type)!
            return (
              <div key={slide.id} className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{meta.icon}</span>
                    <span className="text-slate-300 font-medium">Slide {idx + 1} — {meta.label}</span>
                  </div>
                  {slides.length > 1 && (
                    <button
                      onClick={() => removeSlide(idx)}
                      className="text-slate-500 hover:text-red-400 transition-colors text-sm"
                    >
                      Eliminar
                    </button>
                  )}
                </div>

                <input
                  value={slide.question}
                  onChange={e => updateSlide(idx, { question: e.target.value })}
                  placeholder="Escribe la pregunta..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 focus:border-indigo-500 text-white outline-none transition-colors mb-4"
                />

                {(slide.type === 'poll' || slide.type === 'quiz') && (
                  <div className="space-y-2">
                    {slide.options?.map((opt, oi) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        <span className="text-slate-500 text-sm w-6 shrink-0">{oi + 1}.</span>
                        <input
                          value={opt.text}
                          onChange={e => updateOption(idx, oi, e.target.value)}
                          placeholder={`Opción ${oi + 1}`}
                          className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 focus:border-indigo-500 text-white outline-none transition-colors"
                        />
                        {(slide.options?.length ?? 0) > 2 && (
                          <button
                            onClick={() => removeOption(idx, oi)}
                            className="text-slate-600 hover:text-red-400 transition-colors"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    {(slide.options?.length ?? 0) < 6 && (
                      <button
                        onClick={() => addOption(idx)}
                        className="text-indigo-400 hover:text-indigo-300 text-sm mt-1 transition-colors"
                      >
                        + Agregar opción
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Add slide buttons */}
        <div className="mt-6">
          <p className="text-slate-400 text-sm mb-3">Agregar slide:</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {SLIDE_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => addSlide(t.value)}
                className="flex flex-col items-center gap-1 px-3 py-3 rounded-xl border-2 border-dashed border-slate-700 hover:border-indigo-500 hover:bg-indigo-500/5 transition-all text-slate-400 hover:text-indigo-300"
              >
                <span className="text-2xl">{t.icon}</span>
                <span className="text-xs font-medium">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300">
            {error}
          </div>
        )}

        {/* Create */}
        <button
          onClick={handleCreate}
          disabled={loading}
          className="mt-8 w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white text-xl font-bold transition-all"
        >
          {loading ? 'Creando sesión...' : 'Crear sesión y presentar →'}
        </button>
      </div>
    </div>
  )
}
