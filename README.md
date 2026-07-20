# Within

An Expo React Native MVP for private daily journaling, evidence-backed pattern
detection, and timely life-skills practice.

## Run

```bash
npm install
npm start
```

Use `npm run ios`, `npm run android`, or `npm run web` for a specific target.

Journal entries are persisted on-device. AI analysis is optional and uses a
Gemini-backed API with structured output validation, evidence gating, rate
limiting, provider safety settings, and deterministic crisis interception.

```bash
cp server/.env.example server/.env
cp .env.example .env
# Add GEMINI_API_KEY to server/.env, then:
npm run start:api
EXPO_PUBLIC_API_URL=http://localhost:4000 npm start
```

For Expo Go on a physical device, replace `localhost` with the development
machine's LAN address.

The client sends a bounded recent journal history to `POST /v1/journal/analyze`.
Provider keys remain on the server, and candidates without two valid source
entries are discarded. Run `npm run test:api` for backend tests.

## Deploy the API

The API has a production Dockerfile and Fly configuration:

```bash
fly secrets set GEMINI_API_KEY=... -a within-reflection-api-hiren
fly deploy
```

The crisis router is a product safeguard, not a complete clinical safety system.
Production launch still requires region-aware crisis resources, expert review,
authentication, encrypted cloud persistence, tenant isolation, and audit logs.
