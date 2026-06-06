'use client'
import { useMemo } from 'react'
import { StoredResponse } from '@/lib/redis'

interface Props {
  responses: StoredResponse[]
}

const COLORS = ['#4fbeff', '#9552e0', '#f26110', '#bb9915', '#0099ff', '#0069e0']

// Singleton canvas para medir texto exacto (module scope, no dentro del componente)
const _measureCanvas =
  typeof window !== 'undefined' ? document.createElement('canvas') : null

function measureWord(word: string, fontSize: number): number {
  if (!_measureCanvas) return word.length * fontSize * 0.58
  const ctx = _measureCanvas.getContext('2d')!
  ctx.font = `bold ${fontSize}px sans-serif`
  return ctx.measureText(word).width + 4
}

function wordColor(word: string): string {
  let h = 0
  for (let i = 0; i < word.length; i++) h = Math.imul(31, h) + word.charCodeAt(i) | 0
  return COLORS[Math.abs(h) % COLORS.length]
}

interface Box { x: number; y: number; w: number; h: number }

function intersects(a: Box, b: Box, pad = 7): boolean {
  return !(
    a.x + a.w + pad < b.x || b.x + b.w + pad < a.x ||
    a.y + a.h + pad < b.y || b.y + b.h + pad < a.y
  )
}

// Dimensiones del área visible desde el origen (0,0) al centro
const HALF_W = 330
const HALF_H = 168

// ── Factor de escala global según densidad de palabras ─────────────────────
// Con pocas palabras → fuentes grandes. Con muchas → reducir todas para que quepan.
// Este es el mismo mecanismo que usa Mentimeter para la escala dinámica.
function globalScale(wordCount: number): number {
  if (wordCount <= 5)  return 1.00
  if (wordCount <= 10) return 0.85
  if (wordCount <= 18) return 0.70
  if (wordCount <= 28) return 0.57
  return 0.46
}

export default function LiveWordCloud({ responses }: Props) {
  const placed = useMemo(() => {
    // ── 1. Contar frecuencias ──────────────────────────────────────────────
    const freq: Record<string, number> = {}
    responses.forEach(r => {
      const phrase = r.answer.trim().toLowerCase()
      if (phrase.length > 1) { freq[phrase] = (freq[phrase] || 0) + 1 }
    })

    const sorted = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)

    if (sorted.length === 0) return []
    const max = sorted[0][1]

    const scale = globalScale(sorted.length)
    const result: Array<{ word: string; fontSize: number; color: string; x: number; y: number }> = []
    const boxes: Box[] = []

    // ── 2. Colocar cada palabra ────────────────────────────────────────────
    for (const [word, count] of sorted) {
      const ratio = count / max
      const idealFont = Math.round((13 + ratio * 35) * scale)

      // Intentar con tamaños de fuente decrecientes hasta que quepa.
      // Esto garantiza que TODAS las palabras aparezcan — a lo sumo más pequeñas.
      const fontsToTry = [
        idealFont,
        Math.max(9, Math.round(idealFont * 0.78)),
        Math.max(9, Math.round(idealFont * 0.60)),
        9,  // mínimo absoluto
      ].filter((v, i, a) => a.indexOf(v) === i)  // sin duplicados

      const color = wordColor(word)

      // Ángulo inicial seeded por word → palabras salen en distintas direcciones
      let seedAngle = 0
      for (let i = 0; i < word.length; i++) seedAngle += word.charCodeAt(i)
      const startAngle = (seedAngle % 628) / 100   // [0, 2π)

      let wordPlaced = false

      for (const fontSize of fontsToTry) {
        if (wordPlaced) break

        const wordW = measureWord(word, fontSize)
        const wordH = fontSize * 1.35

        // ── Espiral de Arquímedes ──────────────────────────────────────────
        for (let t = 0; t < 500 && !wordPlaced; t += 0.09) {
          const angle = startAngle + t
          const r = 3.2 * t
          const tx = r * Math.cos(angle) - wordW / 2
          const ty = r * Math.sin(angle) * 0.55 - wordH / 2

          if (tx < -HALF_W || tx + wordW > HALF_W || ty < -HALF_H || ty + wordH > HALF_H) continue

          const candidate: Box = { x: tx, y: ty, w: wordW, h: wordH }
          if (!boxes.some(b => intersects(candidate, b))) {
            result.push({ word, fontSize, color, x: tx, y: ty })
            boxes.push(candidate)
            wordPlaced = true
          }
        }

        // ── Fallback cuadrícula (solo si la espiral falló en este tamaño) ──
        // Barre toda el área sistemáticamente para garantizar que la palabra entre.
        if (!wordPlaced) {
          const colStep = Math.max(wordW + 8, 22)
          const rowStep = Math.max(wordH + 6, 14)
          outer:
          for (let gy = -HALF_H; gy + wordH <= HALF_H; gy += rowStep) {
            for (let gx = -HALF_W; gx + wordW <= HALF_W; gx += colStep) {
              const candidate: Box = { x: gx, y: gy, w: wordW, h: wordH }
              if (!boxes.some(b => intersects(candidate, b))) {
                result.push({ word, fontSize, color, x: gx, y: gy })
                boxes.push(candidate)
                wordPlaced = true
                break outer
              }
            }
          }
        }
      }
      // Si ni con 9px cabe (caso extremo con 40+ palabras largas), la palabra se omite.
      // En la práctica esto no ocurre con los parámetros actuales.
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

  return (
    <div className="relative w-full overflow-hidden" style={{ height: '360px' }}>
      {/*
        Ancla de origen — mismo patrón que d3-cloud:
        top:50% left:50% mapea (0,0) al centro visual del contenedor.
        width:0 height:0 overflow:visible → las palabras se extienden desde el centro.
      */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 0,
          height: 0,
          overflow: 'visible',
        }}
      >
        {placed.map(({ word, x, y, fontSize, color }) => (
          <span
            key={word}
            className="select-none cursor-default font-semibold transition-all duration-500 ease-out"
            style={{
              position: 'absolute',
              left: x,
              top: y,
              fontSize,
              color,
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            {word}
          </span>
        ))}
      </div>
      <p className="absolute bottom-1 right-2 text-[#93979f] text-[11px] font-medium">
        {responses.length} respuesta{responses.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
