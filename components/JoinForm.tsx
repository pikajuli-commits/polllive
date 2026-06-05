'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function JoinForm() {
  const [code, setCode] = useState('')
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    if (c.length > 0) router.push(`/join/${c}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={code}
        onChange={e => setCode(e.target.value.toUpperCase())}
        placeholder="Código (ej: ABC123)"
        maxLength={6}
        className="px-4 py-4 rounded-xl bg-slate-800 border-2 border-slate-700 focus:border-indigo-500 text-white text-lg outline-none transition-colors uppercase w-44"
      />
      <button
        type="submit"
        className="px-5 py-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold transition-all"
      >
        Unirse
      </button>
    </form>
  )
}
