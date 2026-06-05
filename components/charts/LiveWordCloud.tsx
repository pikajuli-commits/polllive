'use client'
import { useMemo } from 'react'
import { StoredResponse } from '@/lib/redis'

interface Props {
  responses: StoredResponse[]
}

// Geniestudio accent palette
const COLORS = ['#4fbeff', '#9552e0', '#f26110', '#bb9915', '#0099ff', '#0069e0']

// Virtual canvas — cálculo de posiciones en este espacio, luego se mapea al contenedor real
const VW = 680
const VH = 360

// Ancho aproximado de un carácter según el tamaño de fuente (sans-serif)
function charW(fontSize: number) {
  return fontSize * 0.58
}

// Bounding box de una palabra en una posición dada
function bbox(word: string, fontSize: number, x: number, y: number) {
  return {
    x, y,
    w: word.length * charW(fontSize) + 6,
    h: fontSize * 1.35,
  }
}

// ¿Dos bounding boxes se solapan? `pad` = margen de aire entre palabras
function overlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  pad = 7
) {
  return !(
    a.x + a.w + pad < b.x ||
    b.x + b.w + pad < a.x ||
    a.y + a.h + pad < b.y ||
    b.y + b.h + pad < a.y
  )
}

// Color determinista por palabra (no aleatorio — siempre el mismo color para la misma palabra)
function wordColor(word: string) {
  let h = 0
  for (let i = 0; i < word.length; i++) h = Math.imul(31, h) + word.charCodeAt(i) | 0
  return COLORS[Math.abs(h) % COLORS.length]
}

export default function LiveWordCloud({ responses }: Props) {
  const placed = useMemo(() => {
    // ── 1. Contar frecuencias ──
    const freq: Record<string, number> = {}
    responses.forEach(r => {
      r.answer.trim().toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 1)
        .forEach(w => { freq[w] = (freq[w] || 0) + 1 })
    })

    const sorted = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)

    if (sorted.length === 0) return []

    const max = sorted[0][1]
    const cx = VW / 2
    const cy = VH / 2

    const result: Array<{ word: string; fontSize: number; color: string; x: number; y: number }> = []
    const placed: ReturnType<typeof bbox>[] = []

    // ── 2. Colocar cada palabra con espiral de Arquímedes ──
    // La más frecuente parte exactamente del centro; las demás espiralan hacia afuera
    // hasta encontrar un espacio libre.
    for (const [word, count] of sorted) {
      const ratio = count / max
      const fontSize = Math.round(15 + ratio * 37)  // 15px → 52px
      const color = wordColor(word)
      const ww = word.length * charW(fontSize) + 6
      const wh = fontSize * 1.35

      let foundX = 0
      let foundY = 0
      let found = false

      // Espiral: ángulo inicial variado por palabra para que no todas salgan en la misma dirección
      let startAngle = 0
      for (let i = 0; i < word.length; i++) startAngle += word.charCodeAt(i)
      startAngle = (startAngle % 628) / 100  // 0 – 2π

      const maxAngle = 500   // tope de iteraciones
      const step = 0.09      // ángulo por paso (más pequeño = espiral más densa)
      const spread = 2.6     // cuánto crece el radio por radián
      const verticalSqueeze = 0.58  // hace el óvalo más ancho que alto (natural en texto)

      for (let t = 0; t < maxAngle; t += step) {
        const angle = startAngle + t
        const r = spread * t
        const tx = cx + r * Math.cos(angle) - ww / 2
        const ty = cy + r * Math.sin(angle) * verticalSqueeze - wh / 2

        // Mantener dentro del canvas virtual
        if (tx < 4 || ty < 4 || tx + ww > VW - 4 || ty + wh > VH - 4) continue

        const candidate = bbox(word, fontSize, tx, ty)
        if (!placed.some(b => overlaps(candidate, b))) {
          foundX = tx
          foundY = ty
          placed.push(candidate)
          found = true
          break
        }
      }

      // Fallback: si la espiral no encontró lugar, barrer posiciones en cuadrícula
      if (!found) {
        outer: for (let row = 0; row < VH; row += Math.max(wh + 8, 20)) {
          for (let col = 0; col < VW; col += Math.max(ww + 8, 20)) {
            const candidate = bbox(word, fontSize, col, row)
            if (col + ww <= VW - 4 && row + wh <= VH - 4 && !placed.some(b => overlaps(candidate, b))) {
              foundX = col
              foundY = row
              placed.push(candidate)
              found = true
              break outer
            }
          }
        }
      }

      if (found) {
        result.push({ word, fontSize, color, x: foundX, y: foundY })
      }
    }

    return result
  }, [responses])

  if (placed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <span className="text-4xl">☁️</span>
        <p className="text-[#535862] text-[16px] font-medium">Esperando respuestas...</p>
      </div>
    )
  }

  // Escalar el canvas virtual al contenedor real manteniendo proporciones
  // El contenedor tiene width: 100% y height: VH px — se usa el canvas 1:1 en escritorio.
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: `${VH}px` }}
    >
      {placed.map(({ word, fontSize, color, x, y }) => (
        <span
          key={word}
          className="absolute select-none cursor-default font-semibold transition-all duration-500 ease-out"
          style={{
            fontSize: `${fontSize}px`,
            left: `${x}px`,
            top: `${y}px`,
            color,
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
          title={`${responses.filter(r =>
            r.answer.trim().toLowerCase().split(/\s+/).includes(word)
          ).length} mención${responses.length !== 1 ? 'es' : ''}`}
        >
          {word}
        </span>
      ))}
      <p className="absolute bottom-1 right-2 text-[#93979f] text-[11px] font-medium">
        {responses.length} respuesta{responses.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
