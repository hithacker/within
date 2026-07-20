# Within: Product Specification

**Status:** Draft v1  
**Date:** 17 July 2026  
**Owner:** Product  
**Target release:** Journal-first MVP

## 1. Product Summary

Within is a private daily journal that helps people notice recurring life patterns
early and learn practical skills before those patterns become costly habits.

Users do not chat with an AI. They write about their day in their own words. The
AI works in the background to organize events, emotions, decisions, relationships,
goals, and repeated behaviors. When there is enough evidence, Within presents a
short, timely observation, shows the journal entries that support it, and offers a
relevant life skill or a small action to try.

Example:

> You have described seeing this person six times in nine days, cancelling two
> existing plans, and feeling anxious when replies take longer than usual. This
> may be a useful moment to check whether the pace still matches what you want.

Within must not declare that a relationship is bad or instruct the user to end it.
It helps the user slow down, compare behavior with their stated values, and make
their own decision.

## 2. Product Vision

Give people the pattern recognition and life skills that often arrive only after
years of avoidable mistakes, while preserving their autonomy and acknowledging
that an AI can be wrong.

The product should feel like a journal with an unusually good memory, not a
therapist, chatbot, oracle, surveillance system, or judgmental life coach.

## 3. Problem

People often recognize an unhealthy pattern only in retrospect:

- Moving faster in a relationship than they intended
- Abandoning routines or friendships when dating someone new
- Avoiding difficult conversations until resentment builds
- Repeatedly ignoring boundaries to gain approval
- Overcommitting during high-energy periods and burning out later
- Making the same decision under the same emotional trigger
- Staying in situations that repeatedly conflict with their stated values

Traditional journaling helps with expression but relies on the writer to remember,
compare, and interpret weeks or months of entries. Generic self-help content is
usually disconnected from the moment when a skill would be useful. Chatbots create
a conversation, but the user does not need another conversational relationship.
They need a reliable record, longitudinal analysis, and timely teaching.

## 4. Target User

### Primary user

An adult who wants to make better personal decisions, already reflects on their
life occasionally, and is comfortable writing a short daily entry. They may be
navigating dating, friendships, work, family, habits, or personal boundaries.

### Initial constraints

- Adults aged 18 and above
- English language
- India-first launch, without making the product India-specific
- Consumer self-development product
- No clinical diagnosis, treatment, or medication guidance

## 5. Positioning

**Category:** Private journal and life-skills companion  
**Promise:** Notice your patterns earlier. Practice a better response.  
**Not:** AI therapy, autonomous counseling, relationship verdicts, or guaranteed
prevention of harmful experiences

The product may say, "This pattern may be worth checking." It must not say, "This
person is toxic," "You are manic," or "This will end badly."

## 6. Product Principles

1. **Journal first.** Writing is the primary interaction. No general-purpose AI
   chat surface is included in the core product.
2. **Evidence before advice.** Every personal insight links to the user's own
   entries and explains why it appeared.
3. **Patterns, not isolated sentences.** Ordinary guidance should require repeated
   signals or a meaningful conflict with a user-defined boundary or goal.
4. **Teach, do not command.** Guidance gives the user a skill, question, or
   experiment. The user retains the decision.
5. **Uncertainty is visible.** Insights use calibrated language and confidence.
   Users can mark them inaccurate, premature, or irrelevant.
6. **Privacy is part of the product.** Entries are sensitive by default, easy to
   delete, and never used for advertising.
7. **Fewer, better interventions.** A quiet product that raises one useful pattern
   is better than a feed of generic AI observations.
8. **No diagnosis by inference.** The system does not infer disorders, attachment
   styles, personality types, abuse, or intent from journal text.
9. **The user may write freely; the AI may not respond freely.** User input can be
   open-ended, but all AI outputs must conform to reviewed schemas, evidence rules,
   and approved skill formats. There is no general-purpose advice endpoint.

## 7. Core Product Loop

1. **Write:** The user records what happened today in free-form text and may add
   mood, energy, people, and life-area tags.
2. **Understand:** AI converts the entry into private structured signals without
   replacing or rewriting the original entry.
3. **Accumulate:** The pattern engine compares new signals with recent history,
   user goals, boundaries, routines, and previous insights.
4. **Surface:** When evidence crosses a threshold, Within shows a concise insight
   or pace check on the Today screen.
5. **Teach:** The insight recommends one relevant life skill and a small action.
6. **Learn:** The user rates the insight and optionally records what they did. This
   feedback adjusts future sensitivity and prevents repetitive warnings.

## 8. Information Architecture

### Today

- Daily writing prompt and entry status
- Continue unfinished entry
- At most one priority insight or check-in
- Current skill practice
- No conversational hero or "start a chat" action

### Journal

- Chronological entry list and calendar
- New entry composer
- Search and filters by person, life area, mood, and date
- Entry detail with edit, export, and delete controls
- AI analysis is secondary and never changes the user's words

### Patterns

- Emerging patterns that need more evidence
- Confirmed recurring patterns
- Strengths and improvements, not only risks
- Evidence timeline for each pattern
- Controls to confirm, dismiss, mute, or correct a pattern

### Skills

- Short practices attached to real patterns
- Initial areas: pacing, boundaries, conflict, emotional regulation, decision
  hygiene, burnout prevention, and maintaining routines
- Saved and completed skills
- No generic infinite content feed in the MVP

### You

- Goals and values
- Personal boundaries and routines to protect
- Insight sensitivity and notification settings
- AI/privacy disclosure
- Export all data and delete account/data

## 9. Onboarding

The onboarding should take less than three minutes and establish context that the
AI cannot safely guess.

1. Explain that Within is a private journal using AI to find patterns and that AI
   observations may be wrong.
2. Obtain explicit permission before journal text is processed by the AI provider.
3. Confirm age 18 or above.
4. Ask which areas the user wants help noticing: dating, relationships, work,
   family, habits, confidence, boundaries, or general reflection.
5. Let the user define up to three goals, values, boundaries, or routines, such as
   "Keep seeing friends while dating" or "Do not make major commitments quickly."
6. Choose insight style: gentle, direct, or factual.
7. Choose notification privacy and frequency.
8. Create the first journal entry.

Users can skip goals and configure them later. Optional fields must not block the
first entry.

## 10. Journal Entry Experience

### Required

- Free-form entry title and body
- Automatic draft saving
- Entry date and time
- Create, edit, and delete
- Offline drafting with later synchronization
- Processing state: private draft, analyzing, analyzed, or analysis failed

### Optional context

- Mood and intensity
- Energy level
- Life areas
- People mentioned, confirmed by the user before becoming persistent identities
- "What mattered most today?" prompt
- "Is there a decision you are considering?" prompt

### Explicit exclusions from MVP

- AI replying beneath every entry
- Chat-style follow-up questions
- Public or social journals
- Automatic access to contacts, messages, photos, or location
- Passive microphone or background monitoring

## 11. Pattern System

### Pattern categories for MVP

- **Pacing:** Rapid escalation, compressed decision timelines, or repeated urgency
- **Boundaries:** Stated limits repeatedly overridden or abandoned
- **Balance:** Important routines, friendships, sleep, or priorities being displaced
- **Conflict:** Avoidance, escalation, repair attempts, and recurring triggers
- **Decision loops:** Repeated choices made under similar emotions or circumstances
- **Burnout:** Cycles of overcommitment followed by exhaustion or withdrawal
- **Strengths:** Behaviors that repeatedly help, including pausing, asking directly,
  maintaining routines, and repairing conflict

### Evidence requirements

An ordinary pattern insight should normally require:

- Signals from at least two separate entries, and
- A repeated behavior, accelerating trend, or conflict with a user-stated goal,
  and
- Sufficient confidence that the evidence refers to the same topic or person

A single entry can trigger a neutral reflection prompt when it describes a major
decision, but it must not be presented as a recurring pattern.

### Insight anatomy

Every insight contains:

- Neutral title
- One- or two-sentence observation
- Confidence label: early signal, recurring pattern, or strong pattern
- Specific evidence with dates and links to source entries
- Why it may matter, tied to the user's stated goal where possible
- One suggested skill or small action
- Feedback actions: helpful, not accurate, too soon, do not show this again

### Example: dating pace check

**Title:** Is the pace still working for you?  
**Observation:** You have written about six dates in nine days and twice changed
plans with friends. You also said keeping your existing routines matters to you.  
**Skill:** Use a 24-hour pause before making the next commitment. Write what pace
would feel exciting and sustainable.  
**Evidence:** Links to the relevant dated entries.  
**Actions:** Check my pace / This feels inaccurate / Mute dating insights

## 12. Guidance and Life Skills

Skills are short protocols, not articles or AI conversations. Each should take
between one and five minutes and end with a concrete choice or practice.

Initial skill templates:

- Pace check: facts, feelings, values, next commitment
- Boundary builder: desired limit, wording, consequence, follow-through
- Decision pause: urgency, reversibility, missing information, waiting period
- Conflict repair: observation, feeling, need, specific request
- Assumption check: known facts, interpretation, alternative explanations
- Routine protection: what changed, what matters, one calendar action
- Burnout check: commitments added, recovery removed, one item to renegotiate

Skills can use relevant facts already extracted from entries, but users must be
able to edit those facts before saving a result.

## 13. Notifications

Notifications are optional, discreet, and never expose sensitive details on the
lock screen by default.

Allowed notification types:

- Daily journal reminder at a user-selected time
- "A new pattern is ready to review"
- Reminder for a user-chosen skill or action

The app must not send alarming messages such as "Your relationship may be
unhealthy" or "Warning: risky behavior detected" as push notification text.

## 14. AI and Pattern Architecture

The AI is an analysis component, not the product interface.

### Processing pipeline

1. Validate and safety-scan the journal entry.
2. Extract structured signals using a low-cost model.
3. Resolve people/topics only against user-confirmed entities.
4. Update longitudinal aggregates and candidate patterns.
5. Apply deterministic thresholds and suppression rules.
6. Use the primary model to draft an insight only when a candidate qualifies.
7. Validate the draft for evidence, unsupported claims, clinical language, and
   prohibited instructions.
8. Store the insight with source references, model version, prompt version, and
   confidence.

### Example structured extraction

```json
{
  "entry_id": "entry_123",
  "events": [
    {
      "life_area": "dating",
      "event": "third date this week",
      "person_ref": "person_7",
      "certainty": 0.91
    }
  ],
  "emotions": [{ "label": "excitement", "intensity": 0.8 }],
  "decisions": [{ "decision": "cancelled dinner with friends", "status": "made" }],
  "goal_conflicts": [{ "goal_id": "goal_keep_friendships", "certainty": 0.84 }],
  "candidate_signals": ["dating_pace", "routine_displacement"]
}
```

### Model behavior requirements

- Structured JSON outputs validated against a schema
- No insight without source entry IDs
- No fabricated dates, counts, quotes, people, or causality
- Separate extraction from interpretation
- Deterministic rules control whether an insight may be shown
- Model and prompt versions recorded for evaluation
- User feedback incorporated into suppression and threshold tuning

## 15. Data Model

Minimum entities:

- User
- Consent record
- Journal entry and revisions
- Goal/value/boundary
- Person reference with user-confirmed label
- Extracted signal with source and confidence
- Pattern candidate
- Published insight with evidence references
- Skill template and skill attempt
- Insight feedback
- Notification preference
- Model/prompt audit record

Raw entries and extracted memories must have independent retention controls so a
user can delete an entry and all signals derived from it.

## 16. Safety and Ethical Boundaries

Within is a self-development product and can make mistakes.

The system must not:

- Diagnose mental-health or medical conditions
- Label another person as abusive, narcissistic, toxic, or dangerous
- Predict relationship success, infidelity, violence, or future behavior
- Recommend medication changes
- Direct major financial, legal, medical, or safety decisions
- Present inference as fact
- Encourage dependency on the app or discourage human support

Explicit self-harm, violence, abuse, or medical-emergency content bypasses normal
pattern coaching and displays deterministic, region-appropriate support options.
Safety routing must not silently create a profile or "risk score" visible to staff.

Potential abuse or coercion indicators may justify a gentle safety check and access
to resources, but not a definitive label or an instruction to confront someone.

## 17. Privacy and Security Requirements

- Explicit AI-processing consent before the first analyzed entry
- Encryption in transit and at rest
- Authentication before cloud journal storage
- No API keys in the mobile application
- No advertising use or sale of journal data
- Minimal provider retention and no model training where provider controls allow
- Per-entry exclusion from AI analysis
- Export and permanent deletion controls
- Derived signals deleted when their source entries are deleted
- Sensitive logs redacted; raw journal text excluded from routine observability
- Session/device protection using platform authentication where available
- Documented incident response and access audit trail

The current no-account, non-persistent prototype backend does not meet these
requirements and must be replaced before a public journal beta.

## 18. Functional Requirements

### MVP must have

- **FR-01:** Users can create, edit, autosave, search, and delete journal entries.
- **FR-02:** Users can explicitly opt an entry in or out of AI analysis.
- **FR-03:** Users can define goals, values, boundaries, and routines.
- **FR-04:** The system extracts validated structured signals from analyzed entries.
- **FR-05:** The pattern engine accumulates signals across entries.
- **FR-06:** Every published insight cites its supporting entries.
- **FR-07:** Users can confirm, correct, dismiss, or mute an insight.
- **FR-08:** Each actionable insight offers one relevant skill.
- **FR-09:** Users can export and permanently delete their data.
- **FR-10:** Crisis and emergency language follows deterministic safety routing.
- **FR-11:** AI failures never block saving or reading a journal entry.
- **FR-12:** Notifications protect sensitive content by default.
- **FR-13:** Every insight records the knowledge-pack and skill versions used to
  produce it.

### Post-MVP

- Voice journaling with explicit recording consent
- Weekly and monthly pattern summaries
- User-controlled therapist/coach export
- On-device extraction for selected signals
- More languages
- Relationship timelines and routine trend charts
- Paid skill programs and advanced pattern history
- Expert-authored knowledge packs
- White-label tenant branding and configuration

## 19. White-Label and Expert Knowledge Platform

Within should be designed so qualified psychotherapists, relationship educators,
coaches, and other domain experts can eventually publish their own reviewed
curriculum without creating an unrestricted chatbot.

This is a platform direction, not part of the first consumer MVP. The MVP should
still establish the content boundaries and version identifiers needed to support
it later.

### Platform layers

1. **Within core:** Journal storage contracts, consent, extraction schema, evidence
   engine, safety policies, privacy controls, feedback, and audit records.
2. **Knowledge pack:** Expert-authored pattern definitions, qualifying and
   disqualifying signals, skill protocols, examples, tone guidance, and escalation
   boundaries.
3. **Tenant configuration:** Brand name, visual tokens, enabled knowledge packs,
   support information, locale, notification defaults, and subscription settings.
4. **User context:** The individual user's entries, goals, boundaries, feedback,
   and derived patterns, isolated from other users and tenants.

### Knowledge-pack contract

Each pack must contain structured, versioned content rather than a single large
prompt:

- Pack ID, semantic version, author, credentials, ownership, and review status
- Intended audience and supported life areas
- Pattern definitions and minimum evidence requirements
- Signals that support, weaken, or exclude a pattern
- Approved user-facing terminology and prohibited claims
- Skill modules with purpose, steps, completion criteria, and contraindications
- Example inputs, expected outputs, false-positive cases, and safety test cases
- Locale and language variants
- Change log and rollback target

### Expert authoring workflow

1. Expert creates or imports a structured draft.
2. The platform validates required fields and prohibited claims.
3. A reviewer runs the pack against the shared evaluation dataset plus pack-specific
   cases.
4. The pack is approved and published as an immutable version.
5. A tenant opts into that version; upgrades are explicit and reversible.
6. User insights retain the exact pack and skill version for auditability.

Experts may write educational content and define when a skill is relevant. They do
not receive unrestricted access to user journals, and their content cannot override
Within's core evidence, privacy, crisis, or non-diagnosis rules.

### White-label requirements

- Strong tenant isolation for users, data, configuration, keys, and analytics
- Tenant-specific consent, privacy policy, support contact, and data-controller
  disclosures
- Theme tokens and assets without forked application code
- Configurable app name, copy, enabled life areas, and knowledge packs
- Separate App Store binaries only when commercially required; otherwise prefer a
  multi-tenant branded experience to reduce operational complexity
- Per-tenant model budgets, retention policy, feature flags, and audit logs
- No cross-tenant use of journal content for model training or evaluation without
  separate explicit consent
- Pack-level analytics based on aggregate outcomes, never raw journal access by
  default

### Governance requirements

- Clearly display the source expert and version for premium or branded curricula
- Define which credentials are verified and avoid implying clinical endorsement
- Require human review before a pack can make health-adjacent claims
- Provide an emergency kill switch and version rollback
- Re-evaluate packs when the extraction schema, model, or safety policy changes
- Prevent tenants from enabling manipulative engagement, alarmist warnings, covert
  advertising, or advice outside the declared scope

### Commercial hypothesis

Potential customers include independent experts, group practices, coaching
programs, employee-development providers, and education communities. Revenue may
come from platform subscriptions, per-active-user pricing, or a marketplace share
on paid knowledge packs. Commercial design must follow demonstrated consumer value
and must not weaken user data rights.

## 20. MVP Acceptance Criteria

The MVP is ready for a private beta when:

1. A user can journal for 14 days without encountering a chat interface.
2. Entries remain usable when AI processing fails or is disabled.
3. A seeded multi-entry dataset produces the expected evidence-backed pattern.
4. A single ambiguous entry does not produce a strong warning.
5. Every insight opens the exact entries used as evidence.
6. Deleting an entry removes its extracted signals and recalculates affected patterns.
7. Incorrect-pattern feedback prevents the same insight from immediately returning.
8. Crisis test cases bypass ordinary coaching with 100% recall on the approved
   deterministic test set.
9. No evaluated insight contains a diagnosis, unsupported claim, invented evidence,
   or directive about a major life decision.
10. Export and account deletion work end to end.

## 21. Success Metrics

### North-star metric

Percentage of weekly journalers who review an evidence-backed insight and mark it
helpful or complete its recommended skill.

### Supporting metrics

- First journal entry completion
- Entries per active user per week
- Day 7 and day 30 journaling retention
- Time from first entry to first qualified insight
- Insight helpful, inaccurate, and too-soon rates
- Skill start and completion rates
- Pattern mute rate and notification disable rate
- Entry deletion/export success rate
- AI extraction and insight validation failure rates

Raw time in app and number of AI messages are not success metrics.

## 22. Monetization Hypothesis

Do not charge for basic journaling, data export, deletion, privacy, or safety
resources.

Potential paid value:

- Longer pattern history
- Weekly and monthly reviews
- Multiple active life areas and goals
- Advanced skill programs
- Rich exports and trend comparisons

Monetization should be tested only after the product demonstrates that users find
its insights accurate and useful.

## 23. Launch Plan

### Phase 0: Pattern evaluation

- Build a synthetic and expert-reviewed dataset of at least 300 journal sequences
- Define expected signals, non-patterns, and prohibited outputs
- Measure false positives before exposing warnings to users

### Phase 1: Private journal beta

- 20-50 invited adults
- Journaling, goals, evidence-backed patterns, feedback, and deletion
- Human review of de-identified failures only with explicit participant consent

### Phase 2: TestFlight external beta

- 100-500 testers
- Add notifications and skills
- Monitor false-positive, mute, and retention metrics

### Phase 3: Public launch

- Launch only after privacy/security review, safety review, and reliable deletion
- Position in Lifestyle rather than as a medical or therapy product

## 24. Key Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| AI confidently misreads an event | Evidence links, thresholds, uncertainty labels, correction controls |
| Product becomes judgmental or paternalistic | Neutral language, user-defined goals, no commands, easy muting |
| Too many false warnings | Multi-entry evidence, deterministic gating, frequency caps |
| Users treat guidance as prediction | Clear positioning and no future-outcome claims |
| Sensitive journal data is exposed | Authentication, encryption, minimal logging, deletion, security review |
| AI creates clinical or relationship labels | Prohibited-output validator and evaluation suite |
| Important nuance is lost in extraction | Preserve original text and let users correct entities and signals |
| Engagement incentives reward anxiety | Do not use streak shame, alarmist notifications, or warning counts |
| Expert content bypasses product safeguards | Structured pack contract, review workflow, immutable versions, core rules that tenants cannot override |
| White-label data leaks across customers | Tenant-scoped authorization, encryption boundaries, isolation tests, per-tenant audit logs |

## 25. Open Product Decisions

1. Should the first release cover all life areas or focus narrowly on dating and
   relationships to improve pattern quality?
2. Should entries be cloud-synced by default or stored locally until AI analysis is
   requested?
3. How much extracted structure should users be able to inspect and edit?
4. What is the minimum evidence threshold for each pattern category?
5. Who reviews the life-skill protocols and safety language before beta?
6. Should users be allowed to create custom "watch for this" rules?
7. What paid feature provides value without holding user history hostage?
8. Which expert credentials can Within verify and display responsibly?
9. Is the first white-label offer a separate binary, a branded tenant inside
   Within, or both?
10. Who is the legal data controller in each white-label deployment?

## 26. Immediate Product Changes From the Current Prototype

- Replace the Reflect/chat tab with Journal.
- Remove the chat screen, conversation API contract, chat consent copy, and all
  "start a reflection" calls to action.
- Make the daily entry composer the primary Today action.
- Replace static journey cards with evidence-backed pattern states.
- Add onboarding for goals, boundaries, life areas, and AI-analysis consent.
- Design persistent authenticated journal storage and derived-signal deletion.
- Replace the conversational backend with entry ingestion, extraction, pattern,
  insight, feedback, and deletion APIs.
- Rewrite App Store metadata around journaling and life skills.
- Introduce knowledge-pack and skill version fields now, even though the MVP ships
  with only the first-party `within.relationships` pack.
