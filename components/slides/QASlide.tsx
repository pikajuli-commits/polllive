'use client'
import { useState } from 'react'

interface Props {
  locked: boolean
  onAnswer: (text: string, name?: string) => void
}

export default function QASlide({ locked, onAnswer }: Props) {
  const [text, setText] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (!trimmed || submitted || locked) return
    onAnswer(trimmed, authorName.trim() || 'Anónimo')
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <div className="w-14 h-14 rounded-[16px] bg-[#f1e6ff] flex items-center justify-center text-2xl">💬</div>
        <p className="text-[#0a0d12] text-[20px] font-medium tracking-[-0.02em]">¡Pregunta enviada!</p>
        <p className="text-[#535862] text-[14px]">El presentador la verá en pantalla</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {locked && (
        <div className="bg-[#fff2be] border border-[#bb9915] rounded-[8px] px-4 py-2 text-[#535862] text-[14px] text-center font-medium">
          Las preguntas están cerradas
        </div>
      )}
      <input
        value={authorName}
        onChange={e => setAuthorName(e.target.value)}
        disabled={locked}
        placeholder="Tu nombre (opcional)"
        className="w-full px-4 py-2.5 rounded-[12px] bg-[#ffffff] border border-[#535862] focus:border-[#0099ff] focus:outline-none text-[#0a0d12] text-[14px] font-medium placeholder:text-[#93979f] tracking-[-0.01em] transition-all duration-200"
      />
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        disabled={locked}
        placeholder="Escribe tu pregunta aquí..."
        rows={4}
        className="w-full px-4 py-3 rounded-[16px] bg-[#ffffff] border border-[#535862] focus:border-[#0099ff] focus:outline-none text-[#0a0d12] text-[16px] font-medium placeholder:text-[#93979f] resize-none transition-all duration-200"
      />
      <button
        onClick={handleSubmit}
        disabled={!text.trim() || locked}
        className="w-full py-3 rounded-[9999px] bg-[#181d27] hover:opacity-90 disabled:bg-[#f6f7f8] disabled:text-[#93979f] text-white text-[16px] font-medium tracking-[-0.01em] transition-all duration-200"
      >
        Enviar pregunta
      </button>
    </div>
  )
}
