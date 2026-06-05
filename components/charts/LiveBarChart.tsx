'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Slide, StoredResponse } from '@/lib/redis'

interface Props {
  slide: Slide
  responses: StoredResponse[]
}

// Geniestudio accent colors
const COLORS = ['#4fbeff', '#9552e0', '#f26110', '#bb9915', '#0099ff', '#0069e0']

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
          <XAxis
            dataKey="name"
            tick={{ fill: '#535862', fontSize: 13, fontWeight: 500 }}
            axisLine={{ stroke: '#535862' }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: '#93979f', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: '#fafdff',
              border: '1px solid #535862',
              borderRadius: 16,
              boxShadow: 'rgba(4,69,144,0.08) 0px 14px 20px 4px',
              padding: '8px 16px',
            }}
            labelStyle={{ color: '#0a0d12', fontWeight: 600, fontSize: 13 }}
            formatter={(val) => {
              const n = Number(val) || 0
              return [`${n} voto${n !== 1 ? 's' : ''}`, '']
            }}
            cursor={{ fill: '#ebf5ff' }}
          />
          <Bar dataKey="votes" radius={[8, 8, 0, 0]}>
            {counts.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-center text-[#93979f] text-[13px] mt-1 font-medium">
        {total} respuesta{total !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
