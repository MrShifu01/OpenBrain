  Architectural Friction Candidates

  1. Three Search Mechanisms with No Unifying Interface
  - Cluster: searchIndex.ts (token-based), chatContext.ts (keyword scoring), semanticSearch() (pgvector fallback)
  - Why coupled: All three rank entries against a query, but callers must know which one to call and where it lives. OpenBrain.tsx
   picks token, connectionFinder.ts picks semantic, DetailModal.tsx picks scoring
  - Dependency category: Logical (shared concept — "find relevant entries") but structurally scattered
  - Test impact: Today you test each scorer in isolation. With a SearchStrategy interface, one boundary test verifies routing +   
  fallback together

  2. aiFetch.ts — Three Concerns in One Module
  - Cluster: aiFetch.ts mixes (a) localStorage read/write for 8 AI settings, (b) task→model routing, (c) embed header generation. 
  Used by 6 modules
  - Why coupled: Every feature touching AI must import aiFetch just to get headers, even if it doesn't care about settings        
  - Dependency category: Configuration (cross-cutting, not domain logic)
  - Test impact: Currently tested piecemeal. A deep AIConfig module would let callers test "what headers do I send?" without      
  caring how keys are stored

  3. Entry Save Pipeline (5-step shattered operation)
  - Cluster: OpenBrain.tsx → offlineQueue.ts → useOfflineSync.ts → /api/capture.ts → cache update. No single "save entry" seam    
  - Why coupled: Each step assumes the previous step's state. Silent degradation at every boundary (unembedded saves, lost temp   
  IDs, queued failures)
  - Dependency category: Cross-boundary I/O (IndexedDB → network → Supabase)
  - Test impact: No end-to-end test exists. A EntryRepository interface would let you test the full save path with a fake backend 

  4. Learning Engine → Silent System Prompt Injection
  - Cluster: learningEngine.ts buffers decisions → summarizes via LLM → result is silently appended to every AI call in ai.ts     
  - Why coupled: callAI() callers don't know they're injecting learnings. If learnings are corrupted, AI behavior changes
  mysteriously with no observable signal
  - Dependency category: Implicit cross-cutting (learnings bleed into unrelated AI calls)
  - Test impact: Zero test coverage. A SystemPromptBuilder module with an explicit withLearnings(brainId) call makes injection    
  testable and auditable

  5. LocalStorage Key Management (64 direct accesses, 8 modules)
  - Cluster: aiFetch.ts, offlineQueue.ts, learningEngine.ts, entriesCache.ts all reach into localStorage with hardcoded keys      
  - Why coupled: No migration path, no per-brain namespacing discipline, no quota handling
  - Dependency category: Infrastructure (cross-cutting, stateful)
  - Test impact: Modules that write localStorage are hard to test in isolation. A StorageAdapter would let tests swap to in-memory
   without polyfills

  6. AI Provider Routing Split Across Frontend + Backend
  - Cluster: ai.ts routes by provider on the frontend, but there are 4 separate API handlers (/api/anthropic, /api/openai,        
  /api/openrouter, /api/llm). Adding a provider requires touching 5+ places
  - Dependency category: Cross-boundary (frontend routing + backend handlers must stay in sync)
  - Test impact: Currently no test verifies that frontend routing reaches the right backend handler