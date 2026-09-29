import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isSignedIn, readSecret } from './_supabase.js'

/*
 * Shared by the /api functions (the leading underscore keeps Vercel from
 * serving this file as a route of its own).
 *
 * The Gemini key is GEMINI_API_KEY when it's set on the server (no VITE_
 * prefix!), otherwise the one typed in Settings → AI, kept in app_secrets.
 * Without either, the AI features say where to add one.
 *
 * Env vars:
 *   GEMINI_API_KEY          optional, server-only; wins over the one in Settings
 *   GEMINI_MODEL            optional, defaults below
 *   GEMINI_FALLBACK_MODEL   optional; tried when the main model stays overloaded
 *   the Supabase ones       see _supabase.ts; used to check the caller is signed in
 */

/** Where the key typed in Settings is stored (app_secrets.name). */
export const GEMINI_SECRET = 'gemini_api_key'

const DEFAULT_MODEL = 'gemini-3.5-flash-lite'
// A different model, so a busy one doesn't take the whole feature down.
const DEFAULT_FALLBACK_MODEL = 'gemini-3.5-flash'
export const MAX_BODY_CHARS = 20_000

/** Google's side is busy or broken — worth another try. Anything else is our problem. */
const RETRYABLE = new Set([500, 502, 503, 504])
const RETRY_DELAY_MS = 1000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** The app's languages by code, as the prompt names them; English unless it's one of these. */
const LANGUAGE_NAMES: Record<string, string> = { en: 'English', pl: 'Polish' }
export const writtenLanguage = (code: unknown) =>
  (typeof code === 'string' && LANGUAGE_NAMES[code]) || 'English'

export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
export const isNumOrNull = (v: unknown) => v === null || isNum(v)
export const isName = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 60
export const clip = (s: unknown, max: number) =>
  typeof s === 'string' ? s.trim().slice(0, max) : ''

/** The key to call Gemini with, and where it came from; null when there's none. */
export async function geminiKey(): Promise<{ key: string; source: 'server' | 'app' } | null> {
  if (process.env.GEMINI_API_KEY) return { key: process.env.GEMINI_API_KEY, source: 'server' }
  const stored = await readSecret(GEMINI_SECRET)
  return stored ? { key: stored, source: 'app' } : null
}

/**
 * Checks that the caller is signed in to this Supabase (only a member of the
 * household may spend the Gemini quota) and that there's a key. Sends the
 * error response itself and returns null when the request can't go ahead,
 * otherwise the key.
 */
export async function authorize(req: VercelRequest, res: VercelResponse): Promise<string | null> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST' })
    return null
  }
  if (!(await isSignedIn(req))) {
    res.status(401).json({ error: 'Not signed in' })
    return null
  }
  const found = await geminiKey()
  if (!found) {
    // the app turns this code into "add a key in Settings"
    res.status(503).json({ error: 'No Gemini key', code: 'no_key' })
    return null
  }
  return found.key
}

export type GeminiResult =
  { ok: true; parsed: Record<string, unknown>; model: string } | { ok: false; error: string }

type GeminiContent = { role: 'user' | 'model'; parts: { text: string }[] }

type RawResult = { ok: true; text: string; model: string } | { ok: false; error: string }

/**
 * One generateContent call with the retries every feature shares. Overload
 * (503) is common and usually brief: the main model is retried once, then a
 * different model is tried. Details of failures go to the Vercel log, not to
 * the browser.
 */
async function generate(apiKey: string, body: Record<string, unknown>): Promise<RawResult> {
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL
  const fallback = process.env.GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL
  const request = JSON.stringify(body)

  const ask = (m: string) =>
    fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: request,
      },
    )

  const attempts = [model, model, ...(fallback !== model ? [fallback] : [])]
  let gemini: Response | null = null
  let usedModel = model
  for (const [i, m] of attempts.entries()) {
    if (i > 0) await sleep(RETRY_DELAY_MS * i)
    usedModel = m
    gemini = await ask(m)
    if (gemini.ok || !RETRYABLE.has(gemini.status)) break
    console.error(`Gemini ${m} attempt ${i + 1}:`, gemini.status, await gemini.text())
  }

  if (!gemini || !gemini.ok) {
    const status = gemini?.status ?? 0
    if (gemini && !RETRYABLE.has(status)) console.error('Gemini error', status, await gemini.text())
    const hint =
      status === 404
        ? `: model "${usedModel}" not found, set GEMINI_MODEL`
        : status === 429
          ? ': rate limit or quota reached, try again later'
          : status === 400 || status === 403
            ? ': check the Gemini key'
            : RETRYABLE.has(status)
              ? ': Gemini is overloaded right now, try again in a minute'
              : ''
    return { ok: false, error: `Gemini request failed (${status})${hint}` }
  }

  const data = (await gemini.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('')
  return { ok: true, text, model: usedModel }
}

/** One schema-constrained JSON call. */
export async function askGemini(args: {
  apiKey: string
  systemPrompt: string
  input: unknown
  schema: unknown
  temperature?: number
}): Promise<GeminiResult> {
  const result = await generate(args.apiKey, {
    systemInstruction: { parts: [{ text: args.systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(args.input) }] }],
    generationConfig: {
      temperature: args.temperature ?? 0.4,
      responseMimeType: 'application/json',
      responseSchema: args.schema,
    },
  })
  if (!result.ok) return result
  try {
    const parsed = JSON.parse(result.text)
    if (!parsed || typeof parsed !== 'object') throw new Error('not an object')
    return { ok: true, parsed, model: result.model }
  } catch {
    console.error('Gemini returned non-JSON', result.text)
    return { ok: false, error: 'Gemini returned an unreadable answer. Try again.' }
  }
}

/**
 * A conversation turn: the household's data goes first as context, then the
 * thread so far, and the answer comes back as plain text.
 */
export async function chatGemini(args: {
  apiKey: string
  systemPrompt: string
  context: unknown
  history: { role: 'user' | 'assistant'; content: string }[]
}): Promise<RawResult> {
  const contents: GeminiContent[] = [
    {
      role: 'user',
      parts: [
        {
          text: `Our data, as JSON. Use it to answer what follows.\n${JSON.stringify(args.context)}`,
        },
      ],
    },
    { role: 'model', parts: [{ text: 'Got it. What would you like to know?' }] },
    ...args.history.map((m): GeminiContent => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
  ]
  const result = await generate(args.apiKey, {
    systemInstruction: { parts: [{ text: args.systemPrompt }] },
    contents,
    generationConfig: { temperature: 0.6 },
  })
  if (result.ok && !result.text.trim()) {
    return { ok: false, error: 'Gemini returned an empty answer. Try again.' }
  }
  return result
}
