# Vision evaluation

Normal tests never call a paid model. For an explicit provider check:

```
VISION_EVAL_MANIFEST=/absolute/path/manifest.json pnpm exec vitest run src/lib/server/vision-evaluation.test.ts
```

The runner reads `.env.local` without printing credentials. A manifest is a JSON array:

```
[{ "label": "桃子", "file": "peach.png", "kind": "human-partial" }]
```

Image paths are relative to the manifest. Use the nine canonical labels, plus 未知 for blank/ambiguous images. Labels never go to the provider. The runner reports per-image answers, errors, correctness, and p50/p95 latency. Provider failures fail the run; correctness is reported rather than hidden by an arbitrary pass threshold.

Use consenting players' sketches, including incomplete and messy drawings, for accuracy measurements. Keep a separate holdout set; include peach/apple and sun/bulb pairs. Do not commit private player drawings. Site icons and generated sketches are smoke tests only, not estimates of player accuracy.

For round-level evaluation, measure whether a correct guess arrives before the round ends, request count, and total elapsed time. The existing ai_attempts table stores vision_ms. Browser Performance entries named drawguess:upload, drawguess:ai-roundtrip and drawguess:vision retain up to 50 local timings per stage. They contain no images or identities and are not sent to analytics.
