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
        <div className="w-14 h-14 rounded-[16px] bg-[#d3f6e3] flex items-center justify-center text-2xl">✅</div>
        <p className="text-[#0a0d12] text-[20px] font-medium tracking-[-0.02em]">¡Respuesta enviada!</p>
        <p className="text-[#535862] text-[14px]">Esperando resultados...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {locked && (
        <div className="bg-[#fff2be] border border-[#bb9915] rounded-[8px] px-4 py-2 text-[#535862] text-[14px] text-center font-medium">
          Las respuestas están cerradas
        </div>
      )}
      {slide.options?.map(opt => (
        <button
          key={opt.id}
          onClick={() => handleSelect(opt.id)}
          disabled={locked}
          className={`w-full text-left px-5 py-4 rounded-[16px] border text-[16px] font-medium tracking-[-0.01em] transition-all duration-200
            ${selected === opt.id
              ? 'border-[#0099ff] border-2 bg-[#cce7ff] text-[#0a0d12] shadow-[rgba(4,69,144,0.08)_0px_14px_20px_4px]'
              : 'border-[#535862] bg-[#fafdff] text-[#0a0d12] hover:border-[#0099ff] hover:bg-[#ebf5ff]'
            }
            ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {opt.text}
        </button>
      ))}
      <button
        onClick={handleSubmit}
        disabled={!selected || locked}
        className="mt-1 w-full py-3 rounded-[9999px] bg-[#181d27] hover:opacity-90 disabled:bg-[#f6f7f8] disabled:text-[#93979f] text-white text-[16px] font-medium tracking-[-0.01em] transition-all duration-200"
      >
        Enviar respuesta
      </button>
    </div>
  )
}
