'use client'
import { useState } from 'react'
import { Slide } from '@/lib/redis'

interface Props {
  slide: Slide
  locked: boolean
  onAnswer: (optionId: string) => void
}

export default function PollSlide({ slide, locked, onAnswer }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const handleSelect = (id: string) => {
    if (submitted || locked) return
    setSelected(id)
  }

  const handleSubmit = () => {
    if (!selected || submitted || locked) return
    onAnswer(selected)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <div className="text-5xl">✅</div>
        <p className="text-white text-xl font-medium">¡Respuesta enviada!</p>
        <p className="text-slate-400">Esperando resultados...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {locked && (
        <div className="bg-amber-500/20 border border-amber-500/40 rounded-lg px-4 py-2 text-amber-300 text-sm text-center">
          Las respuestas están cerradas
        </div>
      )}
      {slide.options?.map(opt => (
        <button
          key={opt.id}
          onClick={() => handleSelect(opt.id)}
          disabled={locked}
          className={`w-full text-left px-5 py-4 rounded-xl border-2 text-lg font-medium transition-all duration-150
            ${selected === opt.id
              ? 'border-indigo-500 bg-indigo-500/20 text-white'
              : 'border-slate-600 bg-slate-800 text-slate-200 hover:border-indigo-400 hover:bg-slate-700'
            }
            ${locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {opt.text}
        </button>
      ))}
      <button
        onClick={handleSubmit}
        disabled={!selected || locked}
        className="mt-2 w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-lg font-semibold transition-all"
      >
        Enviar respuesta
      </button>
    </div>
  )
}
