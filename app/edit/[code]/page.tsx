'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { Slide, SlideType, SlideOption } from '@/lib/redis'

const SLIDE_TYPES: { value: SlideType; label: string; icon: string; bg: string }[] = [
  { value: 'poll',      label: 'Votación',         icon: '📊', bg: '#cce7ff' },
  { value: 'wordcloud', label: 'Nube de palabras',  icon: '☁️', bg: '#f1e6ff' },
  { value: 'quiz',      label: 'Quiz',              icon: '🏆', bg: '#d3f6e3' },
  { value: 'qa',        label: 'Q&A',               icon: '💬', bg: '#fff2be' },
  { value: 'section',   label: 'Sección',            icon: '📌', bg: '#e8e9eb' },
]

function newOption(): SlideOption { return { id: uuidv4(), text: '' } }
function newSlide(type: SlideType): Slide {
  const base = { id: uuidv4(), type, question: '' }
  if (type === 'poll' || type === 'quiz') return { ...base, options: [newOption(), newOption()] }
  return base
}

export default function EditPage() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [slides, setSlides] = useState<Slide[]>([])
  const [sessionId, setSessionId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const upperCode = code?.toUpperCase()

  useEffect(() => {
    if (!upperCode) return
    fetch(`/api/sessions/full?code=${upperCode}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError('Sesión no encontrada'); setLoading(false); return }
        setTitle(data.session.title)
        setSlides(data.session.slides)
        setSessionId(data.session.id)
        setLoading(false)
      })
      .catch(() => { setError('No se pudo cargar la sesión'); setLoading(false) })
  }, [upperCode])

  const addSlide = (type: SlideType) => setSlides(prev => [...prev, newSlide(type)])
  const removeSlide = (idx: number) => setSlides(prev => prev.filter((_, i) => i !== idx))
  const updateSlide = (idx: number, patch: Partial<Slide>) =>
    setSlides(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))
  const addOption = (slideIdx: number) =>
    setSlides(prev => prev.map((s, i) => i !== slideIdx ? s : { ...s, options: [...(s.options || []), newOption()] }))
  const updateOption = (slideIdx: number, optIdx: number, text: string) =>
    setSlides(prev => prev.map((s, i) => {
      if (i !== slideIdx || !s.options) return s
      return { ...s, options: s.options.map((o, j) => j === optIdx ? { ...o, text } : o) }
    }))
  const removeOption = (slideIdx: number, optIdx: number) =>
    setSlides(prev => prev.map((s, i) => {
      if (i !== slideIdx || !s.options) return s
      return { ...s, options: s.options.filter((_, j) => j !== optIdx) }
    }))

  const handleSave = async () => {
    if (!title.trim()) { setError('El título no puede estar vacío'); return }
    if (slides.length === 0) { setError('La sesión necesita al menos una slide'); return }
    if (slides.some(s => !s.question.trim())) { setError('Todas las slides necesitan una pregunta'); return }
    if (slides.some(s =>
      (s.type === 'poll' || s.type === 'quiz') &&
      (s.options?.some(o => !o.text.trim()) || (s.options?.length ?? 0) < 2)
    )) { setError('Las votaciones y quizzes necesitan al menos 2 opciones completas'); return }

    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: upperCode, title: title.trim(), slides }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/present/${sessionId}?code=${upperCode}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#ebf5ff] flex items-center justify-center">
        <div className="text-[#535862] text-[16px] font-medium">Cargando sesión...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#ebf5ff]">
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-7 h-7 rounded-[8px] bg-[#181d27] flex items-center justify-center">
              <span className="text-white text-xs font-semibold">P</span>
            </div>
            <span className="text-[#0a0d12] text-[16px] font-medium tracking-[-0.01em]">PollLive</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[32px] font-medium leading-[1.2] tracking-[-0.64px] text-[#0a0d12] mb-1">
                Editar sesión
              </h1>
              <p className="text-[#535862] text-[16px] font-medium tracking-[-0.01em]">
                Los cambios se aplican inmediatamente al guardar
              </p>
            </div>
            <button
              onClick={() => router.push(`/present/${sessionId}?code=${upperCode}`)}
              className="px-4 py-2 rounded-[9999px] border border-[#535862] text-[#0a0d12] text-[14px] font-medium hover:bg-[#0a0d12] hover:text-white transition-all duration-200"
            >
              ← Volver
            </button>
          </div>
        </div>

        {/* Título */}
        <div className="mb-6">
          <label className="block text-[14px] font-medium text-[#535862] mb-2 tracking-[-0.01em]">
            Título de la sesión
          </label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Título de la sesión"
            className="w-full px-4 py-3 rounded-[16px] bg-[#ffffff] border border-[#535862] focus:border-[#0099ff] focus:outline-none text-[#0a0d12] text-[16px] font-medium placeholder:text-[#93979f] tracking-[-0.01em] transition-all duration-200"
          />
        </div>

        {/* Slides */}
        <div className="space-y-4">
          {slides.map((slide, idx) => {
            const meta = SLIDE_TYPES.find(t => t.value === slide.type)!
            return (
              <div key={slide.id} className="bg-[#fafdff] border border-[#535862] rounded-[32px] p-6 shadow-[rgba(4,69,144,0.08)_0px_14px_20px_4px]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-[9999px] text-[12px] font-medium text-[#0a0d12]" style={{ backgroundColor: meta.bg }}>
                      {meta.icon} {meta.label}
                    </span>
                    <span className="text-[#93979f] text-[12px] font-medium">Slide {idx + 1}</span>
                  </div>
                  {slides.length > 1 && (
                    <button
                      onClick={() => removeSlide(idx)}
                      className="text-[#93979f] hover:text-[#f26110] text-[13px] font-medium transition-colors duration-200"
                    >
                      Eliminar
                    </button>
                  )}
                </div>

                <input
                  value={slide.question}
                  onChange={e => updateSlide(idx, { question: e.target.value })}
                  placeholder={slide.type === 'section' ? 'Nombre de la sección...' : 'Escribe la pregunta...'}
                  className="w-full px-4 py-3 rounded-[16px] bg-[#ffffff] border border-[#535862] focus:border-[#0099ff] focus:outline-none text-[#0a0d12] text-[16px] font-medium placeholder:text-[#93979f] tracking-[-0.01em] transition-all duration-200 mb-4"
                />

                {(slide.type === 'poll' || slide.type === 'quiz') && (
                  <div className="space-y-2">
                    {slide.options?.map((opt, oi) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        <span className="text-[#93979f] text-[13px] w-5 shrink-0 font-medium">{oi + 1}.</span>
                        <input
                          value={opt.text}
                          onChange={e => updateOption(idx, oi, e.target.value)}
                          placeholder={`Opción ${oi + 1}`}
                          className="flex-1 px-3 py-2 rounded-[8px] bg-[#ffffff] border border-[#535862] focus:border-[#0099ff] focus:outline-none text-[#0a0d12] text-[14px] font-medium placeholder:text-[#93979f] transition-all duration-200"
                        />
                        {(slide.options?.length ?? 0) > 2 && (
                          <button
                            onClick={() => removeOption(idx, oi)}
                            className="text-[#93979f] hover:text-[#f26110] transition-colors duration-200 text-sm"
                          >✕</button>
                        )}
                      </div>
                    ))}
                    {(slide.options?.length ?? 0) < 6 && (
                      <button
                        onClick={() => addOption(idx)}
                        className="text-[#0099ff] hover:text-[#0069e0] text-[13px] font-medium mt-1 transition-colors duration-200"
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

        {/* Agregar slide */}
        <div className="mt-6">
          <p className="text-[#535862] text-[13px] font-medium mb-3 tracking-[-0.01em]">Agregar slide:</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {SLIDE_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => addSlide(t.value)}
                style={{ backgroundColor: t.bg }}
                className="flex flex-col items-center gap-1.5 px-3 py-4 rounded-[16px] border border-transparent hover:border-[#535862] transition-all duration-200 text-[#0a0d12]"
              >
                <span className="text-2xl">{t.icon}</span>
                <span className="text-[12px] font-medium tracking-[-0.01em]">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-5 px-4 py-3 rounded-[16px] bg-[#ffe4d4] border border-[#f26110] text-[#0a0d12] text-[14px] font-medium">
            {error}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-6 w-full py-4 rounded-[9999px] bg-[#181d27] hover:opacity-90 disabled:bg-[#f6f7f8] disabled:text-[#93979f] text-white text-[16px] font-medium tracking-[-0.01em] transition-all duration-200 shadow-[rgba(10,13,18,0.8)_0px_1px_2px_0px,rgb(10,13,18)_0px_0px_0px_1px]"
        >
          {saving ? 'Guardando...' : 'Guardar cambios →'}
        </button>

      </div>
    </div>
  )
}
