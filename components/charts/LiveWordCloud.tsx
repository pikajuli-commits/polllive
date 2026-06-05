'use client'
import { useMemo } from 'react'
import { StoredResponse } from '@/lib/redis'

interface Props {
  responses: StoredResponse[]
}

const COLORS = ['#4fbeff', '#9552e0', '#f26110', '#bb9915', '#0099ff', '#0069e0']

// ── Singleton canvas for exact text measurement (module scope, not inside component) ──
// typeof window guard is required: this module runs on the server during Next.js build.
// On the server _measureCanvas = null → fallback to approximate charW.
const _measureCanvas =
  typeof window !== 'undefined' ? document.createElement('canvas') : null

function measureWord(word: string, fontSize: number): number {
  if (!_measureCanvas) return word.length * fontSize * 0.58
  const ctx = _measureCanvas.getContext('2d')!
  ctx.font = `bold ${fontSize}px sans-serif`
  return ctx.measureText(word).width + 4   // +4 for subtle letter-spacing buffer
}

// Deterministic color per word — same word always gets same color across re-renders
function wordColor(word: string): string {
  let h = 0
  for (let i = 0; i < word.length; i++) h = Math.imul(31, h) + word.charCodeAt(i) | 0
  return COLORS[Math.abs(h) % COLORS.length]
}

interface Box { x: number; y: number; w: number; h: number }

function intersects(a: Box, b: Box, pad = 8): boolean {
  return !(
    a.x + a.w + pad < b.x ||
    b.x + b.w + pad < a.x ||
    a.y + a.h + pad < b.y ||
    b.y + b.h + pad < a.y
  )
}

// ── Half-dimensions of the visible card area (origin = center of card) ──
// Presenter card is ~700–900px wide and 360px tall.
// Using conservative halves so words stay comfortably inside the card padding.
const HALF_W = 310
const HALF_H = 160

export default function LiveWordCloud({ responses }: Props) {
  const placed = useMemo(() => {
    // ── 1. Count word frequencies ──────────────────────────────────────────
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

    const result: Array<{ word: string; fontSize: number; color: string; x: number; y: number }> = []
    const boxes: Box[] = []

    // ── 2. Archimedean spiral placement — all coordinates relative to (0,0) ──
    // Architecture matches d3-cloud:
    //   • (0,0) = center of the visible area
    //   • x, y = top-left corner of each word
    //   • A single CSS `top:50% left:50%` parent div maps (0,0) to the card center
    //   • No virtual canvas width needed — works at any container size
    for (const [word, count] of sorted) {
      const ratio = count / max
      const fontSize = Math.round(15 + ratio * 37)   // 15px (rare) → 52px (most frequent)
      const wordW = measureWord(word, fontSize)
      const wordH = fontSize * 1.35
      const color = wordColor(word)

      // Start angle seeded per word so words radiate in different directions,
      // preventing all words from clustering on one side of the spiral
      let seedAngle = 0
      for (let i = 0; i < word.length; i++) seedAngle += word.charCodeAt(i)
      const startAngle = (seedAngle % 628) / 100   // maps to [0, 2π)

      const STEP = 0.085        // angle increment per iteration
      const SPREAD = 3.2        // radius growth per radian (higher = looser spiral)
      const V_SQUEEZE = 0.55    // vertical compression → elliptical cloud (wider than tall)
      const MAX_T = 600         // max iterations before giving up

      let found = false

      for (let t = 0; t < MAX_T; t += STEP) {
        const angle = startAngle + t
        const r = SPREAD * t
        const spiralX = r * Math.cos(angle)               // word center X in origin coords
        const spiralY = r * Math.sin(angle) * V_SQUEEZE   // word center Y (ellipse)

        // Convert center to top-left (what CSS left/top receive)
        const tx = spiralX - wordW / 2
        const ty = spiralY - wordH / 2

        // Bounds: word must fit within the card half-dimensions
        if (tx < -HALF_W || tx + wordW > HALF_W || ty < -HALF_H || ty + wordH > HALF_H) continue

        const candidate: Box = { x: tx, y: ty, w: wordW, h: wordH }

        if (!boxes.some(b => intersects(candidate, b))) {
          result.push({ word, fontSize, color, x: tx, y: ty })
          boxes.push(candidate)
          found = true
          break
        }
      }

      // Fallback: grid scan across the half-bounds if spiral exhausted
      if (!found) {
        const colStep = Math.max(wordW + 12, 30)
        const rowStep = Math.max(wordH + 10, 20)
        outer:
        for (let gy = -HALF_H; gy + wordH <= HALF_H; gy += rowStep) {
          for (let gx = -HALF_W; gx + wordW <= HALF_W; gx += colStep) {
            const candidate: Box = { x: gx, y: gy, w: wordW, h: wordH }
            if (!boxes.some(b => intersects(candidate, b))) {
              result.push({ word, fontSize, color, x: gx, y: gy })
              boxes.push(candidate)
              break outer
            }
          }
        }
      }
    }

    return result
  }, [responses])

  // ── Empty state ────────────────────────────────────────────────────────────
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
        Origin anchor — the d3-cloud centering pattern in pure CSS:
        top:50% left:50% maps pixel (0,0) to the visual center of the container.
        width:0 height:0 overflow:visible lets words extend in all directions from center.
        Result: cloud is ALWAYS centered regardless of the container's actual width.
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
