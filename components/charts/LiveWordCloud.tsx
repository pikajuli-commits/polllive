'use client'
import { StoredResponse } from '@/lib/redis'

interface Props {
  responses: StoredResponse[]
}

const COLORS = [
  'text-indigo-400', 'text-violet-400', 'text-cyan-400',
  'text-emerald-400', 'text-amber-400', 'text-pink-400',
  'text-sky-400', 'text-rose-400',
]

const SIZES = [
  'text-3xl font-bold', 'text-2xl font-semibold', 'text-xl font-medium',
  'text-lg', 'text-base', 'text-sm',
]

export default function LiveWordCloud({ responses }: Props) {
  // Count word frequency
  const freq: Record<string, number> = {}
  responses.forEach(r => {
    const words = r.answer.trim().toLowerCase().split(/\s+/).filter(w => w.length > 1)
    words.forEach(w => { freq[w] = (freq[w] || 0) + 1 })
  })

  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 30)
  const max = sorted[0]?.[1] || 1

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-lg">
        Esperando respuestas...
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-3 justify-center items-center p-6 min-h-48">
      {sorted.map(([word, count], i) => {
        const sizeIndex = Math.min(SIZES.length - 1, Math.floor((1 - count / max) * SIZES.length))
        const color = COLORS[i % COLORS.length]
        return (
          <span
            key={word}
            className={`${SIZES[sizeIndex]} ${color} transition-all duration-500 cursor-default select-none`}
            title={`${count} veces`}
          >
            {word}
          </span>
        )
      })}
      <p className="w-full text-center text-slate-400 text-sm mt-4">
        {responses.length} respuesta{responses.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
