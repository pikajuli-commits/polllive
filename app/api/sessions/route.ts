import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getSession, saveSession, Session, Slide } from '@/lib/redis'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { code, title, slides } = body as { code: string; title?: string; slides?: Slide[] }
    if (!code) return NextResponse.json({ error: 'code requerido' }, { status: 400 })

    const session = await getSession(code.toUpperCase())
    if (!session) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })

    const updated: Session = {
      ...session,
      ...(title !== undefined ? { title } : {}),
      ...(slides !== undefined ? { slides } : {}),
      // Reset currentSlide to 0 if the new slide count is smaller
      currentSlide: slides ? Math.min(session.currentSlide, Math.max(0, slides.length - 1)) : session.currentSlide,
    }
    await saveSession(updated)
    return NextResponse.json({ session: updated })
  } catch (err) {
    console.error('PATCH /api/sessions error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, slides } = body as { title: string; slides: Slide[] }

    if (!title || !slides || slides.length === 0) {
      return NextResponse.json({ error: 'title y slides son requeridos' }, { status: 400 })
    }

    const session: Session = {
      id: uuidv4(),
      code: generateCode(),
      title,
      slides,
      currentSlide: 0,
      locked: false,
      createdAt: Date.now(),
    }

    await saveSession(session)

    return NextResponse.json({ session })
  } catch (err) {
    console.error('POST /api/sessions error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
