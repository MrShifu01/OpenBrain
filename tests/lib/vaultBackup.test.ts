import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/lib/authFetch", () => ({
  authFetch: vi.fn(),
}));

import { authFetch } from "../../src/lib/authFetch";
import { buildVaultBackup } from "../../src/lib/vaultBackup";

const mockAuthFetch = authFetch as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildVaultBackup", () => {
  it("bundles vault setup + entries into the v1 shape", async () => {
    mockAuthFetch.mockImplementation(async (url: string) => {
      if (url === "/api/vault") {
        return new Response(
          JSON.stringify({
            exists: true,
            salt: "deadbeef",
            verify_token: "v1:00:zzz",
            recovery_blob: "00:v1:00:yyy",
          }),
          { status: 200 },
        );
      }
      if (url === "/api/vault-entries") {
        return new Response(
          JSON.stringify([
            {
              id: "e1",
              title: "Gmail",
              content: "v1:01:aa",
              metadata: "v1:01:bb",
              tags: ["work"],
              brain_id: null,
              created_at: "2026-04-30T00:00:00.000Z",
            },
          ]),
          { status: 200 },
        );
      }
      throw new Error("unexpected url " + url);
    });

    const backup = await buildVaultBackup();
    expect(backup.version).toBe("everion-vault-export-v1");
    expect(backup.vault.salt).toBe("deadbeef");
    expect(backup.vault.verify_token).toBe("v1:00:zzz");
    expect(backup.vault.recovery_blob).toBe("00:v1:00:yyy");
    expect(backup.entries).toHaveLength(1);
    expect(backup.entries[0]).toMatchObject({
      id: "e1",
      title: "Gmail",
      content: "v1:01:aa",
      metadata: "v1:01:bb",
      tags: ["work"],
    });
    expect(typeof backup.exported_at).toBe("string");
  });

  it("throws if vault fetch fails", async () => {
    mockAuthFetch.mockResolvedValue(new Response("err", { status: 500 }));
    await expect(buildVaultBackup()).rejects.toThrow(/vault setup fetch failed/i);
  });

  it("throws if account has no vault setup", async () => {
    mockAuthFetch.mockImplementation(async (url: string) => {
      if (url === "/api/vault") {
        return new Response("null", { status: 200 });
      }
      return new Response("[]", { status: 200 });
    });
    await expect(buildVaultBackup()).rejects.toThrow(/no vault setup/i);
  });

  it("handles missing recovery_blob (older accounts)", async () => {
    mockAuthFetch.mockImplementation(async (url: string) => {
      if (url === "/api/vault") {
        return new Response(JSON.stringify({ exists: true, salt: "ab", verify_token: "v1:00:x" }), {
          status: 200,
        });
      }
      return new Response("[]", { status: 200 });
    });
    const backup = await buildVaultBackup();
    expect(backup.vault.recovery_blob).toBe("");
    expect(backup.entries).toEqual([]);
  });
});
