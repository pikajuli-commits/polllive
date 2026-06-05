import Link from 'next/link'
import JoinForm from '@/components/JoinForm'

export default function Home() {
  return (
    <div className="min-h-screen bg-[#ebf5ff] flex flex-col items-center justify-center px-5">
      <div className="max-w-lg w-full text-center">

        {/* Logo mark */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-[8px] bg-[#181d27] flex items-center justify-center">
            <span className="text-white text-sm font-semibold">P</span>
          </div>
          <span className="text-[#0a0d12] text-lg font-medium tracking-[-0.02em]">PollLive</span>
        </div>

        {/* Headline */}
        <h1 className="text-[48px] font-medium leading-[1.11] tracking-[-0.96px] text-[#0a0d12] mb-4 text-balance">
          Encuestas interactivas en tiempo real
        </h1>
        <p className="text-[18px] font-medium leading-[1.4] tracking-[-0.18px] text-[#535862] mb-10">
          La audiencia vota desde su celular. Sin registro. Sin app.
        </p>

        {/* Card */}
        <div className="bg-[#fafdff] border border-[#535862] rounded-[32px] p-8 shadow-[rgba(4,69,144,0.08)_0px_14px_20px_4px]">
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Link
              href="/create"
              className="px-7 py-3 rounded-[9999px] bg-[#181d27] hover:opacity-90 text-white text-[16px] font-medium tracking-[-0.01em] transition-all duration-200 whitespace-nowrap"
            >
              Crear sesión →
            </Link>
            <JoinForm />
          </div>

          {/* Tinted chips decoration */}
          <div className="flex gap-2 justify-center mt-6 flex-wrap">
            <span className="px-3 py-1 rounded-[9999px] bg-[#cce7ff] text-[#0a0d12] text-[12px] font-medium">📊 Votaciones</span>
            <span className="px-3 py-1 rounded-[9999px] bg-[#f1e6ff] text-[#0a0d12] text-[12px] font-medium">☁️ Nube de palabras</span>
            <span className="px-3 py-1 rounded-[9999px] bg-[#d3f6e3] text-[#0a0d12] text-[12px] font-medium">🏆 Quiz</span>
            <span className="px-3 py-1 rounded-[9999px] bg-[#fff2be] text-[#0a0d12] text-[12px] font-medium">💬 Q&A</span>
          </div>
        </div>

      </div>
    </div>
  )
}
