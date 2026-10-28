# Contributing to 你画AI猜

Thanks for taking a look. 你画AI猜 is a drawing game where friends and an AI
player guess the same sketch. The product goal is simple: one person draws,
everyone else — including the AI — tries to name it.

The playable interface stays in Simplified Chinese. Topic names, drink names,
and wishes live in `src/lib/game/topics.ts`.

## Setup

```bash
git clone https://github.com/zicojiao/agora-draw-guess.git
cd agora-draw-guess
pnpm install
cp .env.example .env.local
```

Fill `.env.local` with your own database and vision credentials. Agora voice
and Interactive Whiteboard are optional. Do not commit secrets, `wrangler.jsonc`,
or player drawings.

## Development

- Keep the vision model on the shared snapshot. Do not send the selected topic,
  drink name, or wish.
- Keep a blank canvas from triggering a guess.
- Humans and the AI share one win for the round.
- New background work needs a stop condition. The AI guess queue already limits
  how often a drawing is sent.
- Add or update tests when changing room rules, scoring, vision prompts, the
  access gate, or drawing sync.

## Checks

Run these before opening a pull request:

```bash
pnpm test
pnpm typecheck
pnpm build
```

`pnpm verify` runs all three. The default test suite does not call a paid model.

## Pull Requests

- Use a focused title and explain the drawing, guessing, or room behavior you changed.
- Include screenshots for UI changes.
- Call out any new environment variable.
- Do not include credentials, production database ids, or private player sketches.

## License

By contributing, you agree that your contributions are licensed under the MIT
License.
