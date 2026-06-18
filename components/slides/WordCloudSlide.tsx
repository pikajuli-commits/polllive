'use client'
import { useState } from 'react'

interface Props {
  locked: boolean
  onAnswer: (text: string, name?: string) => void
}

export default function WordCloudSlide({ locked, onAnswer }: Props) {
  const [text, setText] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
  const tooManyWords = wordCount > 2

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (!trimmed || submitted || locked || tooManyWords) return
    onAnswer(trimmed)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <div className="w-14 h-14 rounded-[16px] bg-[#cce7ff] flex items-center justify-center text-2xl">☁️</div>
        <p className="text-[#0a0d12] text-[20px] font-medium tracking-[-0.02em]">¡Enviado!</p>
        <p className="text-[#535862] text-[14px]">Tu respuesta aparece en la nube</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {locked && (
        <div className="bg-[#fff2be] border border-[#bb9915] rounded-[8px] px-4 py-2 text-[#535862] text-[14px] text-center font-medium">
          Las respuestas están cerradas
        </div>
      )}
      <div className="relative">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          disabled={locked}
          placeholder="Máximo 2 palabras..."
          rows={2}
          className={`w-full px-4 py-3 rounded-[16px] bg-[#ffffff] border focus:outline-none text-[#0a0d12] text-[16px] font-medium placeholder:text-[#93979f] resize-none transition-all duration-200 ${
            tooManyWords ? 'border-[#f26110] focus:border-[#f26110]' : 'border-[#535862] focus:border-[#0099ff]'
          }`}
        />
        <span className={`absolute bottom-3 right-3 text-[12px] font-medium ${tooManyWords ? 'text-[#f26110]' : 'text-[#93979f]'}`}>
          {wordCount}/2
        </span>
      </div>
      {tooManyWords && (
        <p className="text-[#f26110] text-[13px] font-medium -mt-2">
          Máximo 2 palabras permitidas
        </p>
      )}
      <button
        onClick={handleSubmit}
        disabled={!text.trim() || locked || tooManyWords}
        className="w-full py-3 rounded-[9999px] bg-[#181d27] hover:opacity-90 disabled:bg-[#f6f7f8] disabled:text-[#93979f] text-white text-[16px] font-medium tracking-[-0.01em] transition-all duration-200"
      >
        Enviar
      </button>
    </div>
  )
}
