import { describe, it, expect } from "vitest";
import { SHARED_PROMPTS } from "../../src/lib/sharedPrompts";
import { SERVER_PROMPTS } from "../../api/_lib/prompts";

// Why this test exists: 6 prompts are intentionally duplicated between
// the client (src/lib/sharedPrompts.ts) and the server (api/_lib/prompts.ts)
// because Vercel's function runtime can't import across the src/ boundary.
// They MUST stay in sync. They have already drifted in the past — server
// got injection-defense added to ENTRY_CONCEPTS / INSIGHT, client didn't.
//
// This test fails the moment the two copies diverge so drift gets caught
// in CI, not by users seeing inconsistent extraction quality between the
// browser-side enrichment path and the server-side enrichment path.
//
// To intentionally update a shared prompt: change BOTH files in the same
// commit. The test will pass again.

const SHARED_KEYS = [
  "ENTRY_AUDIT",
  "ENTRY_CONCEPTS",
  "INSIGHT",
  "BATCH_CONCEPTS",
  "BATCH_LINKS",
] as const;

describe("client/server prompt drift", () => {
  for (const key of SHARED_KEYS) {
    it(`${key} — client and server copies are identical`, () => {
      const client = (SHARED_PROMPTS as Record<string, string>)[key];
      const server = (SERVER_PROMPTS as Record<string, string>)[key];
      expect(client, `SHARED_PROMPTS.${key} missing from client`).toBeTruthy();
      expect(server, `SERVER_PROMPTS.${key} missing from server`).toBeTruthy();
      expect(client).toBe(server);
    });
  }

  it("CAPTURE is intentionally NOT shared (client has richer schema with confidence + icons)", () => {
    // Sanity check that we haven't accidentally synced these. If you ever
    // do unify them, delete this test — it documents the deliberate split.
    const clientCapture = (SHARED_PROMPTS as Record<string, string>).CAPTURE;
    const serverCapture = (SERVER_PROMPTS as Record<string, string>).CAPTURE;
    // Client may not have CAPTURE in SHARED_PROMPTS (it's in PROMPTS).
    // If they're both present, they differ on purpose — server is shorter
    // because the enrichment pipeline doesn't need confidence labels.
    if (clientCapture && serverCapture) {
      expect(clientCapture).not.toBe(serverCapture);
    }
  });
});
