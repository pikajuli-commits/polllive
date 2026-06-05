import Link from 'next/link'
import JoinForm from '@/components/JoinForm'

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white px-5">
      <div className="max-w-lg w-full text-center">
        <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
          PollLive
        </h1>
        <p className="text-slate-400 text-lg mb-10">
          Encuestas interactivas en tiempo real. La audiencia vota desde su celular.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/create"
            className="px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-lg font-bold transition-all"
          >
            Crear sesión →
          </Link>
          <JoinForm />
        </div>
      </div>
    </div>
  )
}
