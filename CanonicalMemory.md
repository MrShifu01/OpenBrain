# Everion Mind — Canonical Memory Architecture (Production Spec)

## Executive Summary

Everion Mind already has:

- Raw user entries
- Personality layer
- Memory tab
- Per-entry enrichment:
  - type extraction
  - title extraction
  - tags
  - metadata
  - concept extraction
  - embeddings

That means Everion already has **entry-level intelligence**.

What it does NOT yet have:

> Cross-entry memory intelligence

This document defines the missing layer:

```txt
raw entries
→ enrichment
→ memory candidates
→ canonical memory consolidation
→ retrieval injection
→ better answers / reminders / personalization
```

This is conceptually similar to how companies like OpenAI and Anthropic likely manage long-term memory:

```txt
raw interactions
→ extraction
→ memory candidates
→ consolidation
→ retrieval injection
```

But Everion goes further because it supports:

- Personal brains
- Family brains
- Business brains
- Community brains
- Source traceability
- Structured obligations
- Future AI interoperability

---

# Why This Exists

Without this layer:

Everion can search well.

But it does not truly "know" the user over time.

Example:

Raw entries may say:

- OpenBrain
- OpenBrain rename
- Everion Mind
- product changes

Without consolidation:
retrieval becomes noisy.

With canonical memory:

> The user's project formerly called OpenBrain is now named Everion Mind.

Much cleaner.

---

# What This Is NOT

Do NOT build:

- giant nightly summarization jobs
- full database scans
- autonomous rewriting of user memory
- deletion of raw entries
- uncontrolled LLM writes

This is NOT:

"Summarize everything every night"

This IS:

"Maintain high-quality durable memory"

---

# Architecture

```txt
Raw Entries
↓
Entry Enrichment Pipeline
↓
Memory Reconciliation Queue
↓
Related Memory Search
↓
LLM Semantic Decision
↓
Deterministic Write Rules
↓
Canonical Memories
↓
Retrieval + UI + Suggestions
```

---

# Database Schema

## canonical_memories

```sql
create table canonical_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  brain_id uuid not null,

  type text not null,
  title text not null,
  summary text not null,

  structured_data jsonb default '{}'::jsonb,

  confidence numeric default 0.7,
  importance numeric default 0.5,

  status text default 'active',

  source_entry_ids uuid[] default '{}',
  source_enrichment_ids uuid[] default '{}',

  supersedes_memory_ids uuid[] default '{}',
  superseded_by_memory_id uuid null,

  last_seen_at timestamptz,
  last_confirmed_at timestamptz,

  embedding vector(1536),

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

---

## memory_reconciliation_queue

```sql
create table memory_reconciliation_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  brain_id uuid not null,
  entry_id uuid,
  enrichment_id uuid,
  reason text not null,
  status text default 'pending',
  attempts int default 0,
  error text,
  created_at timestamptz default now()
);
```

---

## memory_review_items

```sql
create table memory_review_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  brain_id uuid not null,

  proposed_action text not null,
  existing_memory_id uuid,
  proposed_memory jsonb not null,

  confidence numeric default 0.5,
  status text default 'pending'
);
```

---

# Memory Types

- identity
- preference
- relationship
- routine
- goal
- obligation
- risk
- business_context
- life_fact
- project_context
- pattern
- reminder_candidate

---

# Event Flow

When user creates entry:

```txt
Entry Created
↓
Enrichment Runs
↓
Queue Reconciliation Job
```

This should NOT happen synchronously inside capture flow.

Capture must stay fast.

---

# Reconciliation Layer

This is where intelligence happens.

The system asks:

- Is this duplicate?
- Is this outdated?
- Is this more accurate?
- Is this durable?
- Should this become a reminder?
- Should this be ignored?

---

# LLM Role

The LLM should NOT directly write to database.

It should ONLY decide:

- create
- update
- merge
- retire
- ignore
- flag_for_review
- suggest_action

---

# Deterministic Rules

```txt
confidence >= 0.85
→ auto apply

0.65–0.85
→ review queue

<0.65
→ ignore
```

Never auto-delete.

Never delete raw entries.

---

# Example

## Rename

Entry:
"OpenBrain is now Everion Mind"

Action:
update canonical memory

---

## Preference

Entry:
"Please make Claude prompts fully copyable"

Action:
create preference memory

---

## Temporary note

Entry:
"Buy milk tomorrow"

Action:
ignore

---

## Obligation

Entry:
"My driver's licence expires July 2027"

Action:
create obligation memory + suggest reminder

---

# UI

Memory tab becomes:

```txt
All Entries
Important Memories
People
Preferences
Obligations
Business Context
Needs Review
Retired
```

---

# Memory Card Example

Driver's Licence Expiry

Type: Obligation  
Expires: July 2027  
Confidence: High  

Actions:

- Edit
- View Sources
- Add Reminder
- Retire

---

# Retrieval Order

```txt
1 Personality
2 Canonical Memory
3 Recent Entries
4 Semantic Search
5 Concept Graph
6 Raw Entries
```

This dramatically improves retrieval quality.

---

# Why This Matters

Without canonical memory:

Everion retrieves information

With canonical memory:

Everion understands users

That is a massive difference.

---

# How OpenAI / Anthropic Likely Work

They likely do:

```txt
raw chats
→ extraction
→ memory candidates
→ consolidation
→ retrieval injection
```

They likely do NOT:

- summarize everything nightly
- re-read all chat history every request

That would be too expensive.

Everion should follow similar principles.

---

# Why Everion Is More Powerful

Unlike ChatGPT memory:

Everion supports:

- personal brains
- family brains
- business brains
- community brains
- obligations
- traceability
- structured memory

This is significantly larger.

---

# Implementation Plan

## Phase 1

Build tables

## Phase 2

Queue system after enrichment

## Phase 3

Related memory search

## Phase 4

LLM reconciliation engine

## Phase 5

Deterministic write layer

## Phase 6

UI memory surfaces

## Phase 7

Retrieval integration

## Phase 8

Review system

---

# Future Plan (NOT NOW)

Do NOT build nightly cron summarization.

Later you may add:

## Nightly Cleanup Job

Responsibilities:

- process failed queue items
- detect obvious duplicates
- refresh embeddings
- clean stale review items

This should be maintenance only.

NOT:

"Rewrite user memory nightly"

---

# Success Criteria

This succeeds if:

- retrieval becomes cleaner
- users trust memory
- users can see what Everion knows
- duplicate memories decrease
- reminders improve
- Everion feels intelligent

---

# Final Principle

Raw entries are the diary.

Enrichment is the index.

Canonical memory is long-term memory.

This is the layer that makes Everion feel alive.
