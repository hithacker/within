# Within

An Expo React Native app for conscientious AI conversations about relationships,
decisions, conflict, and personal growth.

Within uses familiar threaded conversations but does not automatically accept the
user's framing. Its response contract separates supplied facts, tentative
interpretations, missing context, and direct challenges while preserving
per-thread summaries and bounded cross-thread memory.

See [docs/product-spec.md](docs/product-spec.md) for the product thesis and
[docs/architecture.md](docs/architecture.md) for the implemented system.

## Run

```bash
npm install
cp .env.example .env
cp server/.env.example server/.env
# Configure the public Expo values in .env and GEMINI_API_KEY in server/.env.
npm run dev
```

Use `npm run ios`, `npm run android`, or `npm run web` for a specific target. For
Expo Go on a physical device, use the development machine's LAN address instead of
`localhost` in `EXPO_PUBLIC_API_URL`.

The app works locally without an account. Optional Google or Apple sign-in syncs
threads and memory through Supabase. Apply migrations before testing sync:

```bash
npx supabase db push
```

## API

The primary endpoint is:

```text
POST /v1/conversations/respond
```

The client sends the active thread's latest 20 user and assistant messages, its
bounded rolling summary, and typed durable memories. The server hybrid-selects
relevant cross-thread memory, performs
deterministic safety routing before Gemini, requests structured JSON, validates the
response and source-linked memory updates, and returns a natural reply plus
inspectable reasoning metadata.

Provider keys remain server-side. Run verification with:

```bash
npm run typecheck
npm run test:api
npm run typecheck:studio
```

## Deploy

```bash
fly deploy -a within-reflection-api-hiren
```

Production requires configured Fly secrets, applied Supabase migrations, regional
crisis resources, evaluation cases, and security review.
