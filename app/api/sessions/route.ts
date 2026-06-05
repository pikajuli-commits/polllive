import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { saveSession, Session, Slide } from '@/lib/redis'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
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
