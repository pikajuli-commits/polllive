'use client'
import { useState } from 'react'

interface Props {
  locked: boolean
  onAnswer: (text: string) => void
}

export default function WordCloudSlide({ locked, onAnswer }: Props) {
  const [text, setText] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (!trimmed || submitted || locked) return
    onAnswer(trimmed)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <div className="text-5xl">✅</div>
        <p className="text-white text-xl font-medium">¡Enviado!</p>
        <p className="text-slate-400">Tu palabra aparece en la nube</p>
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
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        disabled={locked}
        placeholder="Escribe una palabra o frase corta..."
        rows={3}
        className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-600 focus:border-indigo-500 text-white text-lg resize-none outline-none transition-colors"
      />
      <button
        onClick={handleSubmit}
        disabled={!text.trim() || locked}
        className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-lg font-semibold transition-all"
      >
        Enviar
      </button>
    </div>
  )
}
