# Within: Conscientious Conversation Product Specification

**Status:** Product reset, MVP implementation
**Date:** 28 July 2026
**Owner:** Product  

## 1. Product Thesis

Within is a private AI conversation for thinking clearly about relationships,
decisions, conflict, and personal growth.

People already talk naturally to general-purpose AI about their lives. The problem
is not the chat interface. The problem is that a conventional assistant commonly
accepts the user's framing, optimizes for immediate reassurance, loses important
history, and avoids conclusions that may create discomfort.

Within should feel as effortless as a familiar AI conversation while behaving more
conscientiously:

- It acknowledges feelings without treating the user's interpretation as fact.
- It remembers relevant history and previous conclusions.
- It notices contradictions between goals, actions, predictions, and outcomes.
- It reconstructs plausible perspectives absent from the user's account.
- It distinguishes observations, interpretations, and missing information.
- It follows up on advice and commitments instead of producing disposable insight.
- It recommends qualified human help when repeated impact exceeds self-guided use.

**Promise:** Talk it through. See what you might be missing.

**Purpose:** Help people reach difficult but valuable realizations before life
forces them to.

## 2. The Problem

People are unreliable narrators of their own lives. This is not dishonesty; memory,
identity, emotion, incomplete information, and self-protection shape every account.
When an AI automatically adopts that account, it can make a protective explanation
feel more certain and delay useful self-examination.

A user may repeatedly:

- seek closeness while using criticism that produces distance;
- request feedback and then debate every person who provides it;
- describe each conflict as unique while similar outcomes recur;
- focus on another person's reaction while omitting the history behind it;
- experience a major realization, then return to the same strategy after the
  immediate consequences fade;
- continue self-guided reflection after the severity of the impact warrants
  professional support.

The product must challenge these reasoning failures without pretending to know an
objective truth it cannot observe.

## 3. Positioning

**Category:** Conscientious AI for personal decisions and relationships
**Primary message:** An AI that helps you see clearly, not merely feel right.
**Supporting message:** Within remembers what matters, questions assumptions, and
does not automatically take your side.

Within is not:

- an agreeable AI companion;
- an oracle or moral verdict engine;
- a diagnostic or medical product;
- a replacement for psychotherapy;
- a surveillance system;
- a system that claims to know another person's motives.

Diagnostic labels are not product categories or targets. The product works with
observable patterns and consequences including anger, defensiveness,
people-pleasing, conflict avoidance, impulsivity, boundaries, dating pace, burnout,
leadership, family conflict, and repeated decision failures.

## 4. Product Principles

1. **Natural conversation is the interface.** Do not force routine journaling,
   forms, taxonomies, or artificial check-ins into the primary experience.
2. **Empathy is not agreement.** Validate emotions where appropriate without
   endorsing causal claims, accusations, or self-explanations.
3. **One account is incomplete.** Actively look for missing history, alternative
   interpretations, and the user's possible contribution.
4. **Challenge precisely.** Challenge a claim, contradiction, strategy, or outcome;
   never attack identity or manufacture shame.
5. **Evidence beats confidence.** State what is known, what is inferred, and what
   would change the conclusion.
6. **Patterns need history.** Do not call a single event a recurring pattern.
7. **Impact and intent are separate.** Good intent does not erase impact; harmful
   impact does not prove malicious intent.
8. **Responsibility has boundaries.** Do not make the user responsible for every
   action another adult takes.
9. **Insight must survive the conversation.** Remember unresolved questions,
   commitments, predictions, and outcomes for relevant future conversations.
10. **Escalation is a feature.** Recommend a qualified professional when there is
    repeated serious harm, loss of control, functional impairment, or inability to
    change despite insight.
11. **No diagnosis by inference.** Do not diagnose the user or people they discuss.
12. **No engagement optimization.** Success is clearer thinking and appropriate
    action, not conversation length.

## 5. Core Experience

### First use

The app opens to a conversation home with natural starters and any existing
threads. A short disclosure explains:

- the user is speaking with AI;
- the AI may be wrong and receives only what the user shares;
- conversations are processed by the configured AI provider;
- Within is not emergency or medical care.

The user can then talk naturally. No onboarding questionnaire is required.

### A conscientious response

The response shown to the user is natural prose, not a worksheet. Internally, every
response must be produced from a structured reasoning contract:

- **Known:** relevant statements or observations supplied by the user;
- **Interpretations:** plausible readings, explicitly marked as uncertain;
- **Missing:** information that could materially change the conclusion;
- **Challenge:** a specific contradiction or neglected perspective, when supported;
- **Next question:** at most one question that advances understanding.

The app may expose a compact "Why this response?" view so users can inspect this
separation without interrupting the conversation.

Example:

> The missed deadline may reflect poor planning, but that conclusion may be
> incomplete. You previously said the project scope changed twice after work began.
> Before concluding the team does not care, were the revised constraints and
> ownership explicitly agreed?

This response neither excuses the missed deadline nor accepts a character judgment
as the only explanation.

## 6. Core Loop

1. **Talk:** The user describes an event, belief, decision, or concern naturally.
2. **Orient:** Within identifies the user's apparent goal and the material facts
   available in the supplied conversation.
3. **Test:** Within checks the framing for missing context, unsupported certainty,
   contradictions, alternative perspectives, and goal-strategy-outcome mismatch.
4. **Respond:** Within gives a concise, humane response with one useful challenge
   or question.
5. **Remember:** The system extracts only durable context: people, goals,
   unresolved tensions, commitments, predictions, outcomes, and user corrections.
6. **Revisit:** Later conversations retrieve relevant context and compare new events
   with previous conclusions.
7. **Escalate:** Repeated serious impact or failed self-guided change prompts an
   appropriate recommendation for human support.

## 7. MVP Scope

### Included

- Multiple natural conversation threads
- Local conversation persistence
- Google and Apple authentication
- Cross-device conversation sync for signed-in users
- Gemini-backed responses through the server
- Deterministic crisis and emergency routing
- Structured response contract and server-side validation
- Inspectable "Why this response?" details
- Per-thread bounded rolling summaries and cross-thread typed durable memories
- Hybrid memory retrieval using the latest message, active thread summary,
  subject matches, lexical overlap, memory status, and memory type
- User inspection, correction, and deletion of memory
- Clear conversation and delete account controls
- Privacy and support pages

### Next

- Follow-up on commitments, predictions, and outcomes
- Conscientiousness evaluation suite using realistic multi-turn cases
- Provider routing and fallback quality checks
- Professional-help recognition and therapist discovery
- Expert-authored reasoning skills applied to conversations

### Excluded from the reset MVP

- Diagnosis or disorder detection
- Passive access to messages, contacts, microphone, location, or photos
- Partner surveillance or secret analysis
- Anonymous interpersonal ratings
- Public or social conversations
- A general content feed
- Gamification intended only to increase time in app

## 8. Memory Architecture

The model must not receive an indefinitely growing transcript or unrelated threads.

1. Keep each thread's most recent messages verbatim.
2. Maintain a bounded rolling summary per thread.
3. Store cross-thread durable memory as typed records:
   - people and relationships;
   - user-stated goals and values;
   - unresolved situations;
   - commitments and intended replacement behaviours;
   - predictions and later outcomes;
   - user corrections and disputed interpretations.
4. Retrieve only context relevant to the current message and active thread summary.
5. Let users inspect, correct, and delete durable memories.

The implementation stores threads, per-thread summaries, and typed memories with
the user's local or synced conversation snapshot. Gemini proposes source-linked
updates, the API validates them, deterministic hybrid retrieval selects relevant
context, and the user can inspect, correct, or delete the result. Within must not
claim recall beyond the supplied active transcript, thread summary, and retrieved
memories.

## 9. AI Response Contract

The server requests and validates:

```json
{
  "reply": "Natural user-facing response.",
  "stance": "support|explore|challenge|escalate",
  "knownFacts": ["Statements grounded in supplied messages"],
  "interpretations": ["Tentative interpretations"],
  "missingContext": ["Information that could change the response"],
  "directChallenge": "One precise challenge, or an empty string",
  "followUpQuestion": "At most one question, or an empty string"
}
```

Rules:

- The reply must remain useful if the structured details are collapsed.
- Known facts must be traceable to supplied messages.
- Interpretations must not be written as established facts.
- A challenge must target reasoning or behaviour, not identity.
- The assistant must not flatter, reflexively agree, or manufacture opposition.
- Directness should scale with evidence and impact.
- The model must not claim access to events, people, or data outside the request.

## 10. Safety and Care Boundaries

Deterministic handling bypasses ordinary conversation for explicit self-harm,
violence, abuse, and medical emergencies. The product provides an immediate
human-contact path and does not continue coaching through a crisis response.

Ordinary responses must not:

- diagnose or infer a disorder;
- recommend medication changes;
- issue definitive abuse, intent, or dangerousness judgments from limited context;
- instruct major irreversible relationship, financial, legal, or medical decisions;
- treat self-condemnation as accountability;
- imply that disagreement with the AI proves defensiveness.

Within should recommend professional support when user-supplied history shows
repeated serious relational harm, loss of behavioural control, or failure to change
despite consequences. This is a recommendation for assessment, not a diagnosis.

## 11. Authoring and White Label Direction

The existing authoring platform remains strategically useful, but authored material
must evolve from journal pattern definitions into conversational reasoning skills.

A skill can teach the model:

- what signals to notice;
- which alternative perspectives to test;
- what evidence strengthens or weakens a hypothesis;
- common reasoning failures;
- safe, useful questions;
- contraindications and escalation boundaries;
- language that preserves accountability without shame.

Skills inform reasoning. They must never override platform safety, invent evidence,
or force every conversation into an author's framework. White-label branding,
tenant configuration, billing, and skill distribution remain later work.

## 12. Success Measures

The MVP should measure:

- percentage of conversations users mark as helping them see something new;
- challenge acceptance, rejection, and correction rates;
- whether follow-up outcomes are recorded;
- repeated contradictions noticed across conversations;
- appropriate professional-help recommendations;
- false certainty, reflexive agreement, invented recall, and unsafe-response rates;
- deletion, retention, latency, and model cost.

Conversation volume and time spent are operational metrics, not primary outcomes.

## 13. Product Test

Before adding a feature, ask:

> Does this help the user examine their account more clearly, remember what matters,
> test a strategy against outcomes, or reach appropriate human help sooner?

If not, it does not belong in the core product.
