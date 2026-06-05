'use client'
import { useMemo } from 'react'
import { StoredResponse } from '@/lib/redis'

interface Props {
  responses: StoredResponse[]
}

// Geniestudio accent palette
const COLORS = [
  '#4fbeff', '#9552e0', '#f26110', '#bb9915',
  '#0099ff', '#0069e0', '#4fbeff', '#9552e0',
  '#f26110', '#bb9915',
]

// Generador pseudo-random estable basado en una semilla (el texto)
// Así las palabras no saltan de lugar en cada re-render
function seededRandom(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0
  }
  return () => {
    h ^= h >>> 16
    h = Math.imul(h, 0x45d9f3b)
    h ^= h >>> 16
    return (h >>> 0) / 0xffffffff
  }
}

export default function LiveWordCloud({ responses }: Props) {
  const words = useMemo(() => {
    const freq: Record<string, number> = {}
    responses.forEach(r => {
      const ws = r.answer.trim().toLowerCase().split(/\s+/).filter(w => w.length > 1)
      ws.forEach(w => { freq[w] = (freq[w] || 0) + 1 })
    })

    const sorted = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)

    const max = sorted[0]?.[1] || 1

    return sorted.map(([word, count]) => {
      const rng = seededRandom(word)
      const ratio = count / max

      // Tamaño: entre 14px y 52px según frecuencia
      const fontSize = Math.round(14 + ratio * 38)

      // Posición: distribuida en toda el área con algo de margen
      const left = 5 + rng() * 85   // 5% a 90%
      const top  = 5 + rng() * 85   // 5% a 90%

      // Rotación: -35° a +35°, con sesgo a horizontal para legibilidad
      const rotations = [-35, -25, -15, 0, 0, 0, 15, 25, 35]
      const rotate = rotations[Math.floor(rng() * rotations.length)]

      const color = COLORS[Math.floor(rng() * COLORS.length)]

      return { word, count, fontSize, left, top, rotate, color }
    })
  }, [responses])

  if (words.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
        <span className="text-4xl">☁️</span>
        <p className="text-lg">Esperando respuestas...</p>
      </div>
    )
  }

  return (
    <div className="relative w-full" style={{ height: '380px' }}>
      {words.map(({ word, count, fontSize, left, top, rotate, color }) => (
        <span
          key={word}
          className="absolute select-none cursor-default transition-all duration-700 ease-out font-semibold"
          style={{
            fontSize: `${fontSize}px`,
            left: `${left}%`,
            top: `${top}%`,
            transform: `rotate(${rotate}deg)`,
            color,
            lineHeight: 1,
            whiteSpace: 'nowrap',
            textShadow: `0 0 20px ${color}40`,
          }}
          title={`${count} vez${count !== 1 ? 'es' : ''}`}
        >
          {word}
        </span>
      ))}
      <p className="absolute bottom-0 right-0 text-slate-500 text-xs pr-1">
        {responses.length} respuesta{responses.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
