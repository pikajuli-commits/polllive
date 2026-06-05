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
        placeholder="Código ABC123"
        maxLength={6}
        className="px-4 py-3 rounded-[9999px] bg-[#ffffff] border border-[#535862] focus:border-[#0099ff] focus:outline-none text-[#0a0d12] text-[16px] font-medium tracking-[-0.01em] transition-all duration-200 uppercase w-40 placeholder:text-[#93979f]"
      />
      <button
        type="submit"
        className="px-6 py-3 rounded-[9999px] border border-[#535862] bg-transparent hover:bg-[#0a0d12] hover:text-white hover:border-[#0a0d12] text-[#0a0d12] font-medium text-[16px] tracking-[-0.01em] transition-all duration-200"
      >
        Unirse
      </button>
    </form>
  )
}
