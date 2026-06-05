'use client'
import { useState } from 'react'
import { Slide } from '@/lib/redis'

interface Props {
  slide: Slide
  locked: boolean
  onAnswer: (optionId: string) => void
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
// Geniestudio tinted chip backgrounds per letter
const CHIP_STYLES = [
  { bg: '#cce7ff', dot: '#4fbeff' }, // Morning Tint + Cornflower
  { bg: '#f1e6ff', dot: '#9552e0' }, // Lilac Mist + Amethyst
  { bg: '#d3f6e3', dot: '#10b981' }, // Sprout + green
  { bg: '#fff2be', dot: '#bb9915' }, // Buttery + Mustard
  { bg: '#ffe4d4', dot: '#f26110' }, // Sunset + Tangerine
  { bg: '#fafdff', dot: '#535862' }, // fallback
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
        <div className="bg-[#fff2be] border border-[#bb9915] rounded-[8px] px-4 py-2 text-[#535862] text-[14px] text-center font-medium">
          Las respuestas están cerradas
        </div>
      )}
      {slide.options?.map((opt, i) => {
        const style = CHIP_STYLES[i % CHIP_STYLES.length]
        const isSelected = submitted && selected === opt.id
        const isDimmed = submitted && selected !== opt.id
        return (
          <button
            key={opt.id}
            onClick={() => handleSubmit(opt.id)}
            disabled={submitted || locked}
            style={{ backgroundColor: style.bg }}
            className={`w-full flex items-center gap-3 px-4 py-4 rounded-[16px] border text-[#0a0d12] font-medium text-[16px] tracking-[-0.01em] transition-all duration-200
              ${isSelected ? 'border-[#0a0d12] border-2 shadow-[rgba(10,13,18,0.08)_0px_4px_12px]' : 'border-transparent'}
              ${isDimmed ? 'opacity-30' : ''}
              ${!submitted && !locked ? 'hover:scale-[1.01] hover:border-[#535862] cursor-pointer' : ''}
            `}
          >
            <span
              className="w-7 h-7 rounded-[8px] flex items-center justify-center text-[12px] font-semibold shrink-0 text-white"
              style={{ backgroundColor: style.dot }}
            >
              {LETTERS[i]}
            </span>
            {opt.text}
          </button>
        )
      })}
      {submitted && (
        <p className="text-center text-[#535862] text-[14px] mt-1">Esperando al presentador...</p>
      )}
    </div>
  )
}
