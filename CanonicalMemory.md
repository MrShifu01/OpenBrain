# Everion Mind — Canonical Memory System  
## Final Boss Implementation Spec for Claude Code

**Product:** Everion Mind  
**Feature:** Canonical Memory / Important Memories  
**Purpose:** Turn enriched entries into a reliable, visible, source-backed long-term memory layer.

---

# 0. Read This First

Everion Mind already has an entry enrichment pipeline.

Existing system already does this per entry:

- Parses entry type
- Generates title
- Extracts tags
- Extracts metadata
- Extracts concepts
- Creates embeddings
- Stores enriched entry data

Do **not** rebuild that.

This spec adds the missing layer:

> Entry enrichment understands each individual entry.  
> Canonical Memory understands the user, brain, project, family, or business over time.

The new system must consolidate, merge, retire, and expose durable memories without damaging raw entries or slowing down capture.

---

# 1. Core Principle

```txt
Raw entries are the diary.
Enrichment is the index.
Canonical Memory is long-term memory.
```

Raw entries should remain untouched.

Canonical memories should be:

- durable
- useful
- source-backed
- editable
- reviewable
- retrievable
- safe
- brain-scoped

---

# 2. What We Are Building

Build a new layer called:

## Engineering name

```txt
canonical_memories
```

## User-facing name

```txt
Important Memories
```

This layer stores the most useful, durable things Everion has learned from entries.

Examples:

```txt
User prefers copyable Claude Code prompts in Markdown.
```

```txt
The project formerly called OpenBrain is now Everion Mind.
```

```txt
Smash Burger Bar has strong food feedback but struggles with sit-down traffic.
```

```txt
Driver's licence expires on 12 July 2027.
```

---

# 3. What We Are NOT Building

Do **not** build:

- a second entry enrichment pipeline
- a giant nightly summarizer
- a full database scan every night
- a single “summary of everything”
- LLM-controlled database writes
- automatic deletion of raw entries
- automatic cross-brain memory sharing
- graph visualisation in this phase
- memory decay in this phase
- fully automated reminders in this phase
- sensitive memory auto-approval

This v1 should be boring, safe, traceable, and useful.

---

# 4. Architecture Overview

```txt
Entry Created / Edited
        ↓
Existing Enrichment Pipeline
        ↓
Memory Reconciliation Queue
        ↓
Deterministic Memory Candidate Filter
        ↓
Related Canonical Memory Search
        ↓
LLM Semantic Decision
        ↓
Strict Deterministic Write Rules
        ↓
Canonical Memories
        ↓
Important Memories UI + Ask Everion Retrieval + Suggested Actions
```

Important:

Capture must remain fast.

Do not run slow consolidation directly inside the capture path.

---

# 5. Core Data Model

## 5.1 canonical_memories

Create a new table:

```sql
create table if not exists canonical_memories (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null,
  brain_id uuid not null,

  memory_key text not null,

  type text not null,
  -- v1 allowed values:
  -- preference
  -- person
  -- obligation
  -- project_context
  -- business_context
  -- life_fact
  -- pattern

  title text not null,
  summary text not null,

  structured_data jsonb default '{}'::jsonb,

  confidence numeric not null default 0.7,
  importance numeric not null default 0.5,

  status text not null default 'active',
  -- active | needs_review | retired | rejected

  requires_review boolean not null default false,

  source_entry_ids uuid[] not null default '{}',
  source_enrichment_ids uuid[] not null default '{}',

  supersedes_memory_ids uuid[] not null default '{}',
  superseded_by_memory_id uuid null,

  last_seen_at timestamptz,
  last_confirmed_at timestamptz,

  archived_reason text,

  created_by text not null default 'system',
  -- system | user | review_acceptance | import

  updated_by text not null default 'system',
  -- system | user | review_acceptance | import

  embedding vector(1536),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint canonical_memories_status_check
    check (status in ('active', 'needs_review', 'retired', 'rejected')),

  constraint canonical_memories_type_check
    check (type in (
      'preference',
      'person',
      'obligation',
      'project_context',
      'business_context',
      'life_fact',
      'pattern'
    )),

  constraint canonical_memories_confidence_check
    check (confidence >= 0 and confidence <= 1),

  constraint canonical_memories_importance_check
    check (importance >= 0 and importance <= 1)
);
```

### Important uniqueness rule

A user should not have duplicate active canonical memories for the same brain and key.

```sql
create unique index if not exists canonical_memories_unique_active_key_idx
on canonical_memories (user_id, brain_id, memory_key)
where status in ('active', 'needs_review');
```

---

## 5.2 canonical_memories indexes

```sql
create index if not exists canonical_memories_user_brain_idx
on canonical_memories (user_id, brain_id);

create index if not exists canonical_memories_status_idx
on canonical_memories (status);

create index if not exists canonical_memories_type_idx
on canonical_memories (type);

create index if not exists canonical_memories_memory_key_idx
on canonical_memories (memory_key);

create index if not exists canonical_memories_updated_at_idx
on canonical_memories (updated_at desc);
```

If pgvector is available:

```sql
create index if not exists canonical_memories_embedding_idx
on canonical_memories
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);
```

---

## 5.3 memory_reconciliation_queue

Create a queue table:

```sql
create table if not exists memory_reconciliation_queue (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null,
  brain_id uuid not null,

  entry_id uuid not null,
  enrichment_id uuid,

  reason text not null,
  -- new_entry | edited_entry | manual_reprocess | failed_retry

  status text not null default 'pending',
  -- pending | processing | completed | failed | ignored

  attempts int not null default 0,
  error text,

  locked_at timestamptz,
  locked_by text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint memory_reconciliation_queue_status_check
    check (status in ('pending', 'processing', 'completed', 'failed', 'ignored')),

  constraint memory_reconciliation_queue_reason_check
    check (reason in ('new_entry', 'edited_entry', 'manual_reprocess', 'failed_retry'))
);
```

### Queue idempotency

The same entry/enrichment should not create infinite duplicate queue items.

```sql
create unique index if not exists memory_reconciliation_queue_unique_pending_idx
on memory_reconciliation_queue (user_id, brain_id, entry_id, coalesce(enrichment_id, '00000000-0000-0000-0000-000000000000'::uuid))
where status in ('pending', 'processing');
```

---

## 5.4 memory_review_items

Create a review queue for uncertain or sensitive memory decisions.

```sql
create table if not exists memory_review_items (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null,
  brain_id uuid not null,

  proposed_action text not null,
  -- create | update | merge | retire | ignore | suggest_action

  existing_memory_id uuid null references canonical_memories(id) on delete set null,

  proposed_memory jsonb not null,

  reason text,
  confidence numeric not null default 0.5,

  status text not null default 'pending',
  -- pending | accepted | edited | rejected

  source_entry_ids uuid[] not null default '{}',
  source_enrichment_ids uuid[] not null default '{}',

  created_at timestamptz not null default now(),
  resolved_at timestamptz,

  constraint memory_review_items_status_check
    check (status in ('pending', 'accepted', 'edited', 'rejected')),

  constraint memory_review_items_action_check
    check (proposed_action in ('create', 'update', 'merge', 'retire', 'ignore', 'suggest_action')),

  constraint memory_review_items_confidence_check
    check (confidence >= 0 and confidence <= 1)
);
```

---

## 5.5 memory_events

Create a full audit log.

This is critical.

Every create, update, merge, retire, reject, review acceptance, or user edit must be logged.

```sql
create table if not exists memory_events (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null,
  brain_id uuid not null,

  canonical_memory_id uuid references canonical_memories(id) on delete set null,

  event_type text not null,
  -- created
  -- updated
  -- merged
  -- retired
  -- rejected
  -- review_created
  -- review_accepted
  -- review_rejected
  -- user_edited
  -- user_retired
  -- source_added
  -- retrieval_used

  previous_value jsonb,
  new_value jsonb,

  source_entry_id uuid,
  source_enrichment_id uuid,

  actor text not null default 'system',
  -- system | user | llm_reconciliation | review_acceptance

  reason text,

  created_at timestamptz not null default now()
);
```

Indexes:

```sql
create index if not exists memory_events_user_brain_idx
on memory_events (user_id, brain_id);

create index if not exists memory_events_memory_idx
on memory_events (canonical_memory_id);

create index if not exists memory_events_created_at_idx
on memory_events (created_at desc);
```

---

# 6. RLS and Security Rules

Enable RLS on all new tables:

```sql
alter table canonical_memories enable row level security;
alter table memory_reconciliation_queue enable row level security;
alter table memory_review_items enable row level security;
alter table memory_events enable row level security;
```

Implement policies based on your existing user/brain membership model.

Minimum required behavior:

```txt
Users can read canonical memories for brains they have access to.
Users can edit/retire canonical memories for brains where they have write permission.
Users can read review items for brains they have access to.
Users can accept/reject review items for brains where they have write permission.
Users can read memory events for brains they have access to.
Service role can process queue items.
```

Critical rule:

```txt
Never consolidate across brain_id boundaries.
```

A memory from a business brain must not appear in a family brain.

A memory from a personal brain must not appear in a community brain.

---

# 7. Memory Types for V1

Keep v1 deliberately small.

Allowed memory types:

## preference

Stable user preference.

Example:

```txt
User prefers complete copyable Markdown prompts for Claude Code.
```

## person

Important person or relationship information.

Example:

```txt
Henk is the user's father.
```

Be careful with sensitive data.

## obligation

Dates, renewals, deadlines, responsibilities.

Example:

```txt
Driver's licence expires on 12 July 2027.
```

## project_context

Stable project information.

Example:

```txt
OpenBrain was renamed Everion Mind.
```

## business_context

Stable business information.

Example:

```txt
Smash Burger Bar has struggled with sit-down foot traffic despite strong food feedback.
```

## life_fact

Useful personal fact that is not a preference, person, or obligation.

Example:

```txt
User is based in South Africa.
```

## pattern

Repeated behavior or recurring preference inferred from multiple entries.

Example:

```txt
User often wants prompts that Claude Code can implement directly.
```

Pattern memories should require stronger evidence than direct facts.

---

# 8. Memory Key Rules

Every canonical memory must have a stable `memory_key`.

The key prevents duplicates.

Examples:

```txt
preference:claude_code_markdown_prompts
project_context:openbrain_renamed_everion_mind
obligation:drivers_licence_expiry
business_context:smash_burger_bar_sit_down_traffic
person:henk_relationship
```

Rules:

```txt
Use lowercase.
Use snake_case.
Prefix with type.
Make the key stable.
Do not include random IDs unless necessary.
Do not create a new key for a minor wording change.
```

Before creating a memory, always check:

```txt
same user_id
same brain_id
same memory_key
status active or needs_review
```

If found, update or merge instead of creating duplicate.

---

# 9. Queue Hook

After existing enrichment completes, insert a queue item.

Pseudo-code:

```ts
await supabase
  .from('memory_reconciliation_queue')
  .upsert(
    {
      user_id,
      brain_id,
      entry_id,
      enrichment_id,
      reason: isEdit ? 'edited_entry' : 'new_entry',
      status: 'pending'
    },
    {
      onConflict: 'user_id,brain_id,entry_id,enrichment_id'
    }
  );
```

Do not block capture completion on reconciliation.

If queue insert fails, log error but do not fail entry capture.

---

# 10. Worker Overview

Build a worker:

```txt
process-memory-reconciliation
```

This can be:

- Supabase Edge Function
- Serverless API route
- Background worker depending on current app architecture

The worker should process a small batch.

Recommended v1 batch size:

```txt
10 to 20 queue items per run
```

---

# 11. Worker Steps

For each pending queue item:

```txt
1. Lock queue item.
2. Load entry and enrichment.
3. Run deterministic memory candidate filter.
4. If low-value, mark ignored.
5. Find related canonical memories.
6. Call LLM only if needed.
7. Validate LLM JSON with Zod.
8. Apply deterministic write rules.
9. Create memory_events audit record.
10. Mark queue item completed.
```

---

# 12. Queue Locking

Avoid two workers processing the same queue item.

Pseudo-code:

```ts
async function claimQueueItems(limit = 20) {
  // Select pending rows ordered by created_at.
  // Mark them processing with locked_at and locked_by.
  // Return claimed rows.
}
```

Rules:

```txt
Only process status = pending.
If status = processing and locked_at older than 15 minutes, allow retry.
Increment attempts.
If attempts > 3, mark failed.
```

---

# 13. Deterministic Memory Candidate Filter

Do not call the LLM for every enriched entry.

First run a cheap filter.

An entry is a good candidate if it contains one or more of:

```txt
durable preference
important person/relationship
expiry date
deadline
renewal
obligation
business fact
project fact
stable personal fact
repeated pattern
explicit correction
explicit rename
```

Skip or ignore:

```txt
temporary task
one-off mood
random short note
low-information entry
duplicate with no new information
pure journal reflection with no reusable fact
```

Pseudo-code:

```ts
function shouldConsiderForCanonicalMemory(enrichedEntry): CandidateDecision {
  const text = combineEntryAndEnrichment(enrichedEntry);

  if (containsExpiryDate(text)) return { shouldConsider: true, reason: 'obligation_date' };
  if (containsExplicitPreference(text)) return { shouldConsider: true, reason: 'preference' };
  if (containsProjectRename(text)) return { shouldConsider: true, reason: 'project_context_update' };
  if (containsImportantPersonFact(text)) return { shouldConsider: true, reason: 'person_fact' };
  if (containsBusinessContext(text)) return { shouldConsider: true, reason: 'business_context' };

  if (isTemporaryTask(text)) return { shouldConsider: false, reason: 'temporary_task' };
  if (isLowInformation(text)) return { shouldConsider: false, reason: 'low_information' };

  return { shouldConsider: true, reason: 'llm_judgment_needed' };
}
```

If skipped:

```txt
mark queue item as ignored
write memory_event only if useful for debugging
do not call LLM
```

---

# 14. Related Memory Search

Before LLM call, find related canonical memories.

Function:

```ts
findRelatedCanonicalMemories(enrichedEntry)
```

Search by:

```txt
same user_id
same brain_id
active or needs_review status
same/similar type
overlapping tags
overlapping concepts
similar title
similar memory_key if generated
vector similarity if available
```

Limit:

```txt
max 10 related canonical memories
```

Never pass the entire brain to the LLM.

---

# 15. LLM Responsibility

The LLM may recommend:

```txt
create
update
merge
retire
ignore
flag_for_review
suggest_action
```

The LLM must not directly write to the database.

The LLM is only a semantic judge.

The application code is the authority.

---

# 16. LLM System Prompt

Use this prompt.

```md
You are the Memory Reconciliation Engine for Everion Mind.

Everion Mind stores raw entries and enriched metadata. Your job is to decide whether a newly enriched entry should affect the brain's Canonical Memory layer.

Canonical Memory is a durable, trusted, source-backed layer used for future retrieval, personalization, reminders, and user-visible Important Memories.

Be conservative.

Do NOT create canonical memories for:
- random one-off notes
- temporary tasks
- temporary moods
- low-confidence guesses
- duplicate information
- information already captured well
- sensitive inferred information
- anything better handled only as a short-term task, calendar item, or reminder

You may recommend exactly one action:
- create
- update
- merge
- retire
- ignore
- flag_for_review
- suggest_action

Definitions:
create = create a new canonical memory
update = update one existing canonical memory
merge = combine duplicate memories into one
retire = mark an old memory as outdated
ignore = no canonical memory change needed
flag_for_review = user should confirm before applying
suggest_action = create a suggested reminder/task/action, not necessarily a memory

Rules:
- Never invent facts.
- Use only the provided entry, enrichment, and related memories.
- Preserve source traceability.
- Prefer fewer, higher-quality memories.
- If unsure, flag_for_review.
- Sensitive information should usually be flag_for_review unless explicitly stated and clearly useful.
- Do not create a pattern memory from one weak signal.
- Do not create duplicate memories.
- Do not retire an important memory unless the new entry explicitly supersedes it.

Return JSON only.
```

---

# 17. LLM Input Shape

Pass the LLM a compact object:

```json
{
  "new_entry": {
    "entry_id": "",
    "enrichment_id": "",
    "created_at": "",
    "raw_text": "",
    "enriched": {
      "type": "",
      "title": "",
      "tags": [],
      "concepts": [],
      "metadata": {}
    }
  },
  "related_canonical_memories": [
    {
      "id": "",
      "memory_key": "",
      "type": "",
      "title": "",
      "summary": "",
      "structured_data": {},
      "confidence": 0.9,
      "importance": 0.7,
      "status": "active",
      "source_entry_ids": []
    }
  ],
  "brain_context": {
    "brain_id": "",
    "brain_name": "",
    "brain_type": "personal|family|business|community|unknown"
  }
}
```

---

# 18. LLM Output Schema

Validate with Zod.

```ts
const MemoryDecisionSchema = z.object({
  action: z.enum([
    'create',
    'update',
    'merge',
    'retire',
    'ignore',
    'flag_for_review',
    'suggest_action'
  ]),

  confidence: z.number().min(0).max(1),

  reason: z.string().min(1),

  existing_memory_ids: z.array(z.string().uuid()).default([]),

  canonical_memory: z.object({
    memory_key: z.string().min(3).nullable(),
    type: z.enum([
      'preference',
      'person',
      'obligation',
      'project_context',
      'business_context',
      'life_fact',
      'pattern'
    ]).nullable(),
    title: z.string().nullable(),
    summary: z.string().nullable(),
    structured_data: z.record(z.any()).default({}),
    importance: z.number().min(0).max(1).nullable(),
    confidence: z.number().min(0).max(1).nullable()
  }).nullable(),

  supersedes_memory_ids: z.array(z.string().uuid()).default([]),

  suggested_action: z.object({
    title: z.string().nullable(),
    description: z.string().nullable(),
    action_type: z.enum(['reminder', 'task', 'calendar', 'review', 'none']),
    due_date: z.string().nullable()
  }).nullable()
});
```

If JSON is invalid:

```txt
retry once
if still invalid, create failed queue state or review item
do not write canonical memory
```

---

# 19. Deterministic Write Rules

The LLM decision is not enough.

Application code must enforce rules.

## 19.1 Confidence thresholds

```txt
confidence >= 0.85
→ may auto-apply if no safety rule blocks it

confidence >= 0.65 and < 0.85
→ create memory_review_item

confidence < 0.65
→ ignore unless suggest_action is clearly useful
```

## 19.2 Confidence is necessary but not sufficient

Some cases always require review.

Always create review item for:

```txt
sensitive personal data
identity documents
legal information
financial information
health information
children/family sensitive details
relationship inferences
retiring high-importance memory
pattern created from weak evidence
cross-brain ambiguity
```

## 19.3 Never delete

Never delete:

```txt
raw entries
enrichment records
canonical memories
memory events
```

Use status:

```txt
retired
rejected
```

---

# 20. Action Handling

## create

Allowed if:

```txt
confidence >= 0.85
not sensitive requiring review
memory_key not already active
has source_entry_ids
```

Otherwise review.

## update

Allowed if:

```txt
confidence >= 0.85
exactly one existing memory id
same user_id
same brain_id
not blocked by safety rules
```

Must log memory_event.

## merge

Allowed if:

```txt
confidence >= 0.9
all memories same user_id and brain_id
not sensitive requiring review
```

Recommended v1 behavior:

```txt
Create/update primary memory.
Mark duplicates as retired.
Set superseded_by_memory_id.
Log memory_events for all affected memories.
```

## retire

Allowed only if:

```txt
confidence >= 0.92
new entry explicitly supersedes old memory
not high importance unless user review
```

Otherwise review.

## ignore

Mark queue item ignored.

## flag_for_review

Create memory_review_item.

## suggest_action

For v1:

```txt
Create suggested action only if your app already has a suggested-actions table.
Otherwise create a memory_review_item with proposed_action = suggest_action.
```

Do not automatically create reminders in v1 unless the user explicitly confirms.

---

# 21. Idempotency Rules

This is critical.

Reprocessing the same entry must be safe.

Before creating a canonical memory:

```txt
Check memory_key.
Check source_entry_ids.
Check semantic duplicate related memories.
```

If memory already exists:

```txt
update source_entry_ids if needed
update last_seen_at
increase confidence carefully if appropriate
do not create duplicate
```

If the user rejected a memory:

```txt
Do not recreate the same memory from the same source_entry_ids.
```

If the user retired a memory:

```txt
Do not auto-reactivate it unless a new explicit source supports it and review is created.
```

---

# 22. User Edit / Forget / Retire Behavior

## User edits a memory

When user edits Important Memory:

```txt
Update canonical_memories only.
Do not rewrite raw entries.
Set updated_by = user.
Update updated_at.
Log memory_event event_type = user_edited.
```

## User retires a memory

When user retires:

```txt
Set status = retired.
Set archived_reason.
Set updated_by = user.
Do not inject into retrieval.
Log memory_event event_type = user_retired.
```

## User rejects a proposed memory

When user rejects review item:

```txt
Set memory_review_items.status = rejected.
If memory exists, set canonical_memories.status = rejected only if appropriate.
Log memory_event event_type = review_rejected.
Do not recreate same memory from same source without new evidence.
```

## User asks to forget

If user says forget/remove this memory:

```txt
Set canonical memory status = rejected.
Do not inject into retrieval.
Do not recreate from same sources.
Do not delete raw entries unless user explicitly asks to delete source entries.
```

---

# 23. Embeddings

When creating or updating a canonical memory, generate an embedding from:

```txt
Type: {type}
Title: {title}
Summary: {summary}
Structured Data: {important structured fields}
```

Store in:

```txt
canonical_memories.embedding
```

If embedding generation fails:

```txt
Do not fail memory creation.
Store memory without embedding.
Retry embedding later.
```

---

# 24. Retrieval Integration

Canonical memory is an additional high-priority source.

Do not remove existing retrieval.

When Ask Everion runs, include relevant canonical memories before raw entry retrieval.

Recommended order:

```txt
1. Personality profile
2. Relevant active canonical memories
3. Recent entries
4. Existing semantic entry search
5. Concept graph relationships
6. Raw source entries
```

Only inject:

```txt
status = active
same user_id
same brain_id
relevant by query/type/similarity
```

Do not inject:

```txt
retired
rejected
needs_review
other brain memories
```

Recommended limit:

```txt
Top 5 to 12 canonical memories
```

Prompt context format:

```txt
Relevant Important Memories:
- [preference] User prefers copyable Claude Code prompts in Markdown.
- [project_context] The project formerly called OpenBrain is now Everion Mind.
- [business_context] Smash Burger Bar struggles with sit-down traffic despite strong food feedback.
```

If answer uses a canonical memory, optionally log:

```txt
memory_events.event_type = retrieval_used
```

Do this only if not too noisy.

---

# 25. UI Requirements

Add or update Memory tab.

Recommended structure:

```txt
Memory
├── All Entries
├── Important Memories
├── People
├── Preferences
├── Obligations
├── Business Context
├── Needs Review
└── Retired
```

If this is too much for current UI, start with:

```txt
All Entries
Important Memories
Needs Review
```

---

# 26. Important Memory Card

Each card should show:

```txt
Title
Type badge
Summary
Confidence label
Source count
Last updated
Actions
```

Actions:

```txt
Edit
View Sources
Confirm
Retire
Add Reminder
```

Only show Add Reminder for obligation/date memories.

---

# 27. Confidence Labels

Do not show raw decimal by default.

Use:

```txt
High confidence: >= 0.85
Medium confidence: 0.65–0.85
Needs review: status = needs_review or requires_review = true
```

---

# 28. View Sources UI

When user clicks View Sources, show:

```txt
Source entry title
Date
Short snippet
Why this source supports the memory
Open original entry button
```

This is critical for trust.

Do not create hidden AI memory with no visible source trail.

---

# 29. Needs Review UI

Create a Needs Review section.

Example:

```txt
Everion found a possible memory update.

Existing memory:
"Your project is called OpenBrain."

Suggested update:
"Your project formerly called OpenBrain is now Everion Mind."

Reason:
The new entry explicitly says the project was renamed.

Actions:
Accept
Edit
Reject
```

When accepted:

```txt
apply proposed action
set review status = accepted
log memory_event
```

When edited:

```txt
apply edited version
set review status = edited
log memory_event
```

When rejected:

```txt
set review status = rejected
log memory_event
prevent same source from recreating it
```

---

# 30. Suggested Actions

For obligations and expiry dates, the LLM may suggest action.

Example:

```txt
Driver's licence expires on 12 July 2027.
Suggested action: Add reminder 90 days before expiry.
```

V1 rule:

```txt
Do not automatically create reminder.
Show suggestion.
User confirms.
```

---

# 31. Sensitive Information Policy

Be conservative.

Sensitive categories include:

```txt
health
legal
financial
identity documents
children/family details
private relationships
precise address
highly personal information
```

Rules:

```txt
Do not infer sensitive facts.
Only store if explicitly stated.
Prefer review queue.
Always preserve source.
Always allow edit/forget.
Never expose across brains.
```

---

# 32. Brain Boundary Rules

Every query and write must include:

```txt
user_id
brain_id
```

Do not consolidate across brains.

Do not retrieve across brains.

Do not merge across brains.

Do not use memories from one brain in another brain's Ask Everion context.

Future cross-brain memory should require explicit product design and permissions.

Not part of v1.

---

# 33. Implementation Plan

## Phase 1 — Database

Create:

```txt
canonical_memories
memory_reconciliation_queue
memory_review_items
memory_events
```

Add:

```txt
indexes
constraints
RLS policies
updated_at triggers if project uses them
```

Test RLS before proceeding.

---

## Phase 2 — Queue Hook

Modify existing enrichment completion logic.

After enrichment succeeds:

```txt
insert/upsert memory_reconciliation_queue item
```

Do not block capture if queue insert fails.

---

## Phase 3 — Worker

Create:

```txt
process-memory-reconciliation
```

Worker responsibilities:

```txt
claim pending queue items
process batch
handle lock timeout
increment attempts
mark completed/ignored/failed
```

---

## Phase 4 — Candidate Filter

Implement:

```ts
shouldConsiderForCanonicalMemory(enrichedEntry)
```

Skip obvious low-value entries before LLM call.

---

## Phase 5 — Related Memory Search

Implement:

```ts
findRelatedCanonicalMemories(enrichedEntry)
```

Use:

```txt
memory_key
type
tags
concepts
title similarity
embedding similarity if available
```

Limit 10.

---

## Phase 6 — LLM Reconciliation

Implement:

```ts
askMemoryReconciliationLLM(input)
```

Requirements:

```txt
strict JSON
Zod validation
one retry on invalid JSON
safe failure
no DB writes inside this function
```

---

## Phase 7 — Deterministic Write Layer

Implement:

```ts
applyMemoryDecision(decision, context)
```

This function owns all DB writes.

It must enforce:

```txt
confidence thresholds
safety rules
idempotency
brain boundaries
source traceability
audit events
```

---

## Phase 8 — UI: Important Memories

Build UI list for active canonical memories.

Filters:

```txt
type
confidence
last updated
source count
```

Actions:

```txt
edit
view sources
retire
confirm
add reminder
```

---

## Phase 9 — UI: Needs Review

Build review queue.

Actions:

```txt
accept
edit
reject
```

---

## Phase 10 — Retrieval Integration

Modify Ask Everion retrieval.

Add canonical memories as high-priority context.

Do not remove existing retrieval pipeline.

---

## Phase 11 — Suggested Actions

If existing app has tasks/reminders:

```txt
connect obligation memories to reminder suggestions
```

If not:

```txt
store as review/suggestion only
```

---

# 34. Worker Pseudocode

```ts
export async function processMemoryReconciliation() {
  const workerId = crypto.randomUUID();

  const items = await claimQueueItems({
    limit: 20,
    workerId
  });

  for (const item of items) {
    try {
      const enrichedEntry = await loadEnrichedEntry({
        userId: item.user_id,
        brainId: item.brain_id,
        entryId: item.entry_id,
        enrichmentId: item.enrichment_id
      });

      const candidateDecision = shouldConsiderForCanonicalMemory(enrichedEntry);

      if (!candidateDecision.shouldConsider) {
        await markQueueIgnored(item.id, candidateDecision.reason);
        continue;
      }

      const relatedMemories = await findRelatedCanonicalMemories(enrichedEntry);

      const llmDecision = await askMemoryReconciliationLLM({
        enrichedEntry,
        relatedMemories
      });

      await applyMemoryDecision({
        queueItem: item,
        enrichedEntry,
        relatedMemories,
        decision: llmDecision
      });

      await markQueueCompleted(item.id);
    } catch (error) {
      await markQueueFailedOrRetry(item.id, error);
    }
  }
}
```

---

# 35. applyMemoryDecision Pseudocode

```ts
async function applyMemoryDecision({
  queueItem,
  enrichedEntry,
  relatedMemories,
  decision
}) {
  validateBrainBoundary(queueItem, enrichedEntry, relatedMemories);

  if (decision.action === 'ignore') {
    return;
  }

  const blockedBySafety = requiresHumanReview(decision, enrichedEntry);

  if (blockedBySafety || decision.confidence < 0.85) {
    if (decision.confidence >= 0.65 || blockedBySafety) {
      await createReviewItem(decision, enrichedEntry);
    }
    return;
  }

  switch (decision.action) {
    case 'create':
      await createCanonicalMemorySafely(decision, enrichedEntry);
      break;

    case 'update':
      await updateCanonicalMemorySafely(decision, enrichedEntry);
      break;

    case 'merge':
      await mergeCanonicalMemoriesSafely(decision, enrichedEntry);
      break;

    case 'retire':
      await retireCanonicalMemorySafely(decision, enrichedEntry);
      break;

    case 'suggest_action':
      await createSuggestedActionOrReviewItem(decision, enrichedEntry);
      break;

    case 'flag_for_review':
      await createReviewItem(decision, enrichedEntry);
      break;
  }
}
```

---

# 36. Testing Requirements

## Database / RLS

Test:

```txt
user cannot read another user's canonical memories
user cannot read another brain's canonical memories without access
service role can process queue
retired memories do not appear in default active query
```

## Queue

Test:

```txt
enrichment creates queue item
same enrichment does not create duplicate pending item
worker claims item once
failed item retries up to max attempts
```

## Candidate Filter

Test ignored:

```txt
Buy milk tomorrow.
Feeling tired today.
Random short low-info note.
```

Test considered:

```txt
My driver's licence expires on 12 July 2027.
OpenBrain is now Everion Mind.
Please always give me Claude Code prompts in Markdown.
```

## Reconciliation

Test:

```txt
duplicate does not create duplicate canonical memory
project rename updates old memory
low-confidence creates review item
sensitive memory creates review item
temporary task is ignored
expiry date creates obligation memory
```

## Retrieval

Test:

```txt
active canonical memories are injected
retired memories are not injected
rejected memories are not injected
other brain memories are not injected
source entries can be viewed
```

## User Actions

Test:

```txt
user edit updates canonical memory only
user retire removes memory from retrieval
user reject prevents recreation from same source
```

---

# 37. Example Test Cases

## Test 1 — Project Rename

Existing memory:

```txt
User is building OpenBrain.
```

New entry:

```txt
OpenBrain is now called Everion Mind.
```

Expected:

```txt
Update existing canonical memory.
Summary: The user's project formerly called OpenBrain is now Everion Mind.
Retire or supersede old OpenBrain-only wording.
Log memory_event.
```

---

## Test 2 — Preference

Entry:

```txt
Please always give me Claude Code prompts in copyable Markdown.
```

Expected:

```txt
Create memory.
type = preference
memory_key = preference:claude_code_markdown_prompts
confidence high
```

---

## Test 3 — Temporary Task

Entry:

```txt
Buy milk tomorrow.
```

Expected:

```txt
No canonical memory.
Queue item ignored.
Optional task suggestion only if task system exists.
```

---

## Test 4 — Obligation

Entry:

```txt
My driver's licence expires on 12 July 2027.
```

Expected:

```txt
Create obligation memory.
structured_data.date = 2027-07-12
suggest reminder
do not automatically create reminder unless user confirms
```

---

## Test 5 — Rejected Memory

User rejects proposed memory:

```txt
User likes extreme UI redesigns.
```

Expected:

```txt
Review item rejected.
Do not create canonical memory.
Do not recreate from same source entry.
```

---

# 38. UX Copy

Use this copy.

## Important Memories

```txt
Important Memories are the durable things Everion has learned from your entries.
They help Everion answer better, remember context, and surface useful reminders.
```

## Needs Review

```txt
Everion found possible memory updates that need your confirmation.
```

## Retired Memories

```txt
These memories are no longer active. They may have been replaced, corrected, or manually retired.
```

## View Sources

```txt
Sources show where this memory came from.
```

---

# 39. Future Plan — Cleanup Job

Do not build nightly summarization in v1.

Later, add a maintenance job:

```txt
memory-maintenance-cleanup
```

Purpose:

```txt
retry failed queue items
unlock stale processing items
refresh missing embeddings
find obvious duplicate canonical memories
expire stale review items
generate admin diagnostics
```

This future job must NOT:

```txt
summarize all user memories nightly
rewrite all canonical memories
scan every raw entry
delete data
cross brain boundaries
```

Suggested schedule later:

```txt
nightly or every few hours depending on volume
```

This is maintenance only.

---

# 40. Anti-Regression Rules

Do not break:

```txt
entry capture
existing enrichment
existing memory tab
existing Ask Everion retrieval
existing concept graph
existing embeddings
existing brain permissions
```

Any new canonical memory functionality must be additive.

---

# 41. Success Criteria

The system is successful when:

```txt
Ask Everion gives cleaner answers.
Important memories are visible and editable.
Users can trace memories back to sources.
Duplicate durable facts decrease.
Old/outdated memories can be retired.
Obligations become visible.
The app feels like it learns without feeling creepy.
Raw entries remain untouched and safe.
```

---

# 42. Final Build Instruction

Implement this incrementally.

Do not attempt one massive refactor.

Recommended order:

```txt
1. Database
2. Queue hook
3. Worker skeleton
4. Candidate filter
5. Related memory search
6. LLM decision with validation
7. Deterministic write layer
8. Important Memories UI
9. Needs Review UI
10. Retrieval integration
11. Suggested action support
12. Tests
```

Keep the first version conservative.

A boring, safe memory system is better than a magical unreliable one.

---

# 43. Final Mental Model

```txt
Entries = what the user said.
Enrichment = what each entry means.
Canonical Memory = what Everion should keep using.
Review Queue = what Everion is unsure about.
Memory Events = why memory changed.
Retrieval Injection = how memory becomes useful.
```

Build that.
