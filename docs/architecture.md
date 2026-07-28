# Within Architecture

**Current as of:** 28 July 2026

Within is transitioning from journal analysis to conscientious conversation. The
new conversation path is implemented. Legacy journal code and data remain in the
repository during migration but are no longer part of the mobile experience.

## System

```mermaid
flowchart LR
  USER[User]
  AUTHOR[Expert author]

  subgraph DEVICE[Expo app]
    CHAT[Threaded conversation UI]
    LOCAL[(AsyncStorage\nthread + memory snapshot)]
    CHAT <--> LOCAL
  end

  subgraph FLY[Fly.io Mumbai]
    API[Express API\nsafety + response contract]
    STUDIO[Next.js authoring studio]
  end

  subgraph SUPABASE[Supabase]
    AUTH[Google and Apple auth]
    CONVERSATIONS[(conversation_snapshots\nowner-only RLS)]
    CONTENT[(organizations, collections,\nversions, reviews, tests)]
  end

  subgraph GOOGLE[Google AI]
    GEMINI[Gemini 2.5 Flash\nFlash-Lite fallback]
  end

  USER --> CHAT
  CHAT -->|Optional sign-in| AUTH
  CHAT <-->|User JWT + RLS| CONVERSATIONS
  CHAT -->|POST active thread messages,\nsummary, and memories| API
  API -->|Deterministic safety routing| API
  API -->|Conscientious JSON contract| GEMINI
  GEMINI -->|Structured response| API
  API -->|Validated reply + reasoning| CHAT

  AUTHOR --> STUDIO
  STUDIO --> AUTH
  STUDIO <--> CONTENT
  STUDIO -->|Validate content| API
```

## Conversation Flow

```mermaid
sequenceDiagram
  participant U as User
  participant M as Mobile app
  participant A as Fly API
  participant G as Gemini
  participant S as Supabase

  U->>M: Natural message
  M->>M: Persist locally
  opt Signed in
    M->>S: Upsert owner-only snapshot
  end
  M->>A: Last 30 messages
  A->>A: Validate request and classify safety
  alt Crisis, emergency, or abuse
    A-->>M: Deterministic support response
  else Ordinary conversation
    A->>A: Hybrid-select relevant typed memories
    A->>G: Active thread messages + thread summary + relevant memories
    G-->>A: JSON response
    A->>A: Zod validation
    A->>A: Validate source-linked memory updates
    A-->>M: Reply, reasoning, summary, memory upserts
  end
  M->>M: Apply memory updates and persist
  opt Signed in
    M->>S: Upsert updated snapshot
  end
```

## Response Contract

Every model response is validated as:

```text
reply
stance: support | explore | challenge | escalate
knownFacts[]
interpretations[]
missingContext[]
directChallenge
followUpQuestion
```

The natural reply is always visible. The mobile UI exposes the structured fields
under "Why this response?" so users can inspect how fact, inference, uncertainty,
and challenge were separated.

The current contract is a generation constraint, not a proof that the reasoning is
correct. Evaluation cases and deterministic grounding checks are required before
the system can make strong longitudinal claims.

## Data Model

```mermaid
erDiagram
  AUTH_USERS ||--o| CONVERSATION_SNAPSHOTS : owns
  AUTH_USERS ||--o| JOURNAL_SNAPSHOTS : legacy_owns
  AUTH_USERS ||--o{ ORGANIZATION_MEMBERS : joins
  ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERS : has
  ORGANIZATIONS ||--o{ KNOWLEDGE_PACKS : owns
  KNOWLEDGE_PACKS ||--o{ KNOWLEDGE_PACK_VERSIONS : versions
  KNOWLEDGE_PACK_VERSIONS ||--o{ PACK_REVIEWS : receives
  KNOWLEDGE_PACK_VERSIONS ||--o{ PACK_TEST_CASES : verifies

  AUTH_USERS {
    uuid id PK
    jsonb provider_metadata
  }
  CONVERSATION_SNAPSHOTS {
    uuid user_id PK,FK
    jsonb payload "threads, summaries, memories, tombstones, consent"
    timestamptz updated_at
  }
  JOURNAL_SNAPSHOTS {
    uuid user_id PK,FK
    jsonb payload "legacy journal state"
    timestamptz updated_at
  }
  ORGANIZATIONS {
    uuid id PK
    text slug UK
    text name
  }
  ORGANIZATION_MEMBERS {
    uuid organization_id PK,FK
    uuid user_id PK,FK
    text role
  }
  KNOWLEDGE_PACKS {
    text id PK
    uuid organization_id FK
    text slug
    text title
  }
  KNOWLEDGE_PACK_VERSIONS {
    text pack_id PK,FK
    text version PK
    text status
    jsonb content
  }
  PACK_REVIEWS {
    uuid id PK
    text pack_id FK
    text version FK
    text decision
  }
  PACK_TEST_CASES {
    uuid id PK
    text pack_id FK
    text version FK
    jsonb input
    jsonb expected
  }
```

## Trust Boundaries

| Component | Conversation access | Authoring access | Main control |
| --- | --- | --- | --- |
| Mobile app | Local state and signed-in user's snapshot | None | User JWT and owner-only RLS |
| Authoring studio | None | Member organization's content | Organization RLS and workflow RPCs |
| Fly API | Messages explicitly submitted for a response | Published content and validation | Server-only provider keys |
| Gemini | Bounded messages supplied for one request | None currently | Prompt contract and provider settings |
| Supabase | Stored snapshots and authored content | Stores workflow state | RLS, guarded RPCs, delete cascade |

The studio has no query or policy granting authors access to user conversations.

## Deliberately Retained

- Supabase Google and Apple authentication
- Owner-only snapshot sync
- Account deletion
- Fly deployment and health checks
- Gemini provider and fallback handling
- Deterministic crisis routing
- Versioned authoring workflow
- Legacy journal endpoint and tables during migration

## Durable Memory

The app stores multiple conversation threads for the user, but sends only the
active thread's latest 20 messages for generation. Each thread has its own bounded
rolling summary. Cross-thread typed memories cover people, relationships, goals,
unresolved situations, commitments, predictions, outcomes, and corrections.

The client owns the memory snapshot. The API does not maintain a hidden user-memory
database. For each request:

1. deterministic hybrid retrieval ranks at most 100 supplied memories using the
   latest message, active thread summary, subject matches, lexical overlap, status,
   confirmation, and memory-type priority, then selects up to 12 records;
2. Gemini receives only those records, the active thread summary, and recent
   messages from that thread;
3. proposed memory updates require source user-message IDs;
4. the API rejects invented sources, unknown update IDs, and changes to
   user-confirmed memories;
5. the client deduplicates and applies at most six updates;
6. users can inspect, correct, or delete the active thread summary and global typed
   records.

Conversation sync remains an owner-only JSON snapshot. Version 2 migrates the
legacy single transcript into one thread. Thread deletion creates a tombstone, and
cloud writes merge the latest remote snapshot before upsert so another device does
not casually overwrite or resurrect threads.

Memory is still fallible. The next architectural work is grounding and
anti-sycophancy evaluation, automatic follow-up on commitments and predictions,
and expert-authored conversational skills.
