import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/redis'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.json({ error: 'code requerido' }, { status: 400 })

  const session = await getSession(code.toUpperCase())
  if (!session) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })

  return NextResponse.json({ session })
}
