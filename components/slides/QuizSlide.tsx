'use client'
import { useState } from 'react'
import { Slide } from '@/lib/redis'

interface Props {
  slide: Slide
  locked: boolean
  onAnswer: (optionId: string) => void
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
const LETTER_COLORS = [
  'bg-indigo-600 border-indigo-500',
  'bg-violet-600 border-violet-500',
  'bg-cyan-600 border-cyan-500',
  'bg-emerald-600 border-emerald-500',
  'bg-amber-600 border-amber-500',
  'bg-rose-600 border-rose-500',
]

export default function QuizSlide({ slide, locked, onAnswer }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (optId: string) => {
    if (submitted || locked) return
    setSelected(optId)
    onAnswer(optId)
    setSubmitted(true)
  }

  return (
    <div className="flex flex-col gap-3">
      {locked && (
        <div className="bg-amber-500/20 border border-amber-500/40 rounded-lg px-4 py-2 text-amber-300 text-sm text-center">
          Las respuestas están cerradas
        </div>
      )}
      {slide.options?.map((opt, i) => (
        <button
          key={opt.id}
          onClick={() => handleSubmit(opt.id)}
          disabled={submitted || locked}
          className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl border-2 text-white font-medium text-lg transition-all
            ${submitted && selected === opt.id ? 'border-white scale-95' : ''}
            ${submitted && selected !== opt.id ? 'opacity-40' : ''}
            ${!submitted && !locked ? 'hover:scale-[1.02] cursor-pointer' : ''}
            ${LETTER_COLORS[i % LETTER_COLORS.length]}
          `}
        >
          <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold shrink-0">
            {LETTERS[i]}
          </span>
          {opt.text}
        </button>
      ))}
      {submitted && (
        <p className="text-center text-slate-400 mt-2">Esperando que termine el tiempo...</p>
      )}
    </div>
  )
}
