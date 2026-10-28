/** Opt-in paid integration run. Labels stay in the evaluator, never in the prompt. */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve, extname } from 'node:path'
import { expect, it } from 'vitest'
import { guessDrawing } from './openai-vision'
import type { DrawGuessEnv } from './worker-env'

const manifest = process.env.VISION_EVAL_MANIFEST
it.skipIf(!manifest)('evaluates labeled drawings against the configured vision provider', async () => {
  process.loadEnvFile('.env.local')
  const fixtures = JSON.parse(readFileSync(manifest!, 'utf8')) as Array<{ label: string; file: string; kind?: string }>
  const results: Array<{ label: string; guess: string; ms: number; correct: boolean; kind: string; failed: boolean; confidence?: number; reason?: string }> = []
  for (const fixture of fixtures) {
    const file = resolve(dirname(manifest!), fixture.file)
    const mime = extname(file) === '.jpg' || extname(file) === '.jpeg' ? 'jpeg' : 'png'
    const image = `data:image/${mime};base64,${readFileSync(file, { encoding: 'base64' })}`
    const began = Date.now()
    try {
      const decision = await guessDrawing(process.env as unknown as DrawGuessEnv, image)
      results.push({ label: fixture.label, guess: decision.guess, correct: decision.guess === fixture.label, ms: Date.now() - began, kind: fixture.kind ?? 'unspecified', failed: false, confidence: decision.confidence, reason: decision.reason })
    } catch {
      results.push({ label: fixture.label, guess: 'request-failed', correct: false, ms: Date.now() - began, kind: fixture.kind ?? 'unspecified', failed: true })
    }
  }
  const times = results.map(r => r.ms).sort((a,b) => a-b)
  const percentile = (q: number) => times[Math.max(0, Math.ceil(times.length*q)-1)]
  const report = { evaluation: 'drawing-vision', results, count: results.length, correct: results.filter(r=>r.correct).length, errors: results.filter(r=>r.failed).length, p50Ms: percentile(.5), p95Ms: percentile(.95) }
  writeFileSync(`${manifest}.results.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
  expect(results.length).toBeGreaterThan(0)
  expect(results.filter(r => r.failed)).toHaveLength(0)
}, 300000)
