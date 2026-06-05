'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Slide, StoredResponse } from '@/lib/redis'

interface Props {
  slide: Slide
  responses: StoredResponse[]
}

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444']

export default function LiveBarChart({ slide, responses }: Props) {
  if (!slide.options) return null

  const counts = slide.options.map(opt => ({
    name: opt.text,
    votes: responses.filter(r => r.answer === opt.id).length,
  }))

  const total = responses.length

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={counts} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <XAxis dataKey="name" tick={{ fill: '#e2e8f0', fontSize: 14 }} />
          <YAxis allowDecimals={false} tick={{ fill: '#94a3b8' }} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8 }}
            labelStyle={{ color: '#e2e8f0' }}
            formatter={(val) => {
              const n = Number(val) || 0
              return [`${n} voto${n !== 1 ? 's' : ''}`, '']
            }}
          />
          <Bar dataKey="votes" radius={[6, 6, 0, 0]}>
            {counts.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-center text-slate-400 text-sm mt-2">{total} respuesta{total !== 1 ? 's' : ''}</p>
    </div>
  )
}
