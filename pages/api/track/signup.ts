import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { google } from 'googleapis'

async function sheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  if (!email || !key) return null
  const auth = new google.auth.JWT(email, undefined, key, ['https://www.googleapis.com/auth/spreadsheets'])
  return google.sheets({ version: 'v4', auth })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const session = await getServerSession(req, res, authOptions as any)
  if (!session?.user) return res.status(401).json({ ok: false })

  const { fullName, heardFrom } = req.body || {}
  const sheets = await sheetsClient()
  if (!sheets) return res.json({ ok: true }) // no-op if not configured

  const now = new Date().toISOString()
  const ua = req.headers['user-agent'] || ''
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || ''

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID!,
    range: 'Signups!A:Z',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[now, session.user.email || '', (session.user as any).id || '', fullName || '', heardFrom || '', 'google', ip, ua]] }
  })

  res.json({ ok: true })
}
