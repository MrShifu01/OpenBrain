import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/lib/offlineQueue", () => ({
  enqueue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/lib/entriesCache", () => ({
  writeEntriesCache: vi.fn().mockResolvedValue(undefined),
  readEntriesCache: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../src/lib/crypto", () => ({
  encryptEntry: vi.fn((entry: unknown) => entry),
}));

import { enqueue } from "../../src/lib/offlineQueue";
import { writeEntriesCache, readEntriesCache } from "../../src/lib/entriesCache";
import { encryptEntry } from "../../src/lib/crypto";
import { saveEntry } from "../../src/lib/entryOps";
import type { Entry } from "../../src/types";

const mockEnqueue = enqueue as ReturnType<typeof vi.fn>;
const mockWriteCache = writeEntriesCache as ReturnType<typeof vi.fn>;
const mockReadCache = readEntriesCache as ReturnType<typeof vi.fn>;
const mockEncrypt = encryptEntry as ReturnType<typeof vi.fn>;

const baseEntry: Entry = {
  id: "tmp-123",
  title: "Test entry",
  type: "note",
  tags: ["test"],
  content: "Hello",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockEncrypt.mockImplementation((entry: unknown) => entry);
  mockReadCache.mockResolvedValue([]);
});

describe("saveEntry", () => {
  it("calls enqueue with the entry and brainId", async () => {
    await saveEntry(baseEntry, { brainId: "brain-1" });
    expect(mockEnqueue).toHaveBeenCalledOnce();
    const op = mockEnqueue.mock.calls[0][0];
    expect(op.body).toContain("brain-1");
  });

  it("updates the entries cache optimistically", async () => {
    await saveEntry(baseEntry, { brainId: "brain-1" });
    expect(mockWriteCache).toHaveBeenCalledOnce();
  });

  it("returns the entry id", async () => {
    const result = await saveEntry(baseEntry, { brainId: "brain-1" });
    expect(result.entryId).toBe("tmp-123");
  });

  it("encrypts entry when vaultKey is provided", async () => {
    const encryptedEntry = { ...baseEntry, content: "ENCRYPTED" };
    mockEncrypt.mockReturnValue(encryptedEntry);
    await saveEntry(baseEntry, { brainId: "brain-1", vaultKey: "vault-secret" });
    expect(mockEncrypt).toHaveBeenCalledWith(baseEntry, "vault-secret");
  });

  it("does not encrypt when vaultKey is null", async () => {
    await saveEntry(baseEntry, { brainId: "brain-1", vaultKey: null });
    expect(mockEncrypt).not.toHaveBeenCalled();
  });

  it("inserts new entry at front of cache", async () => {
    const existing: Entry = { id: "existing", title: "Old", type: "note", tags: [] };
    mockReadCache.mockResolvedValue([existing]);
    await saveEntry(baseEntry, { brainId: "brain-1" });
    const writtenCache = mockWriteCache.mock.calls[0][0] as Entry[];
    expect(writtenCache[0].id).toBe("tmp-123");
    expect(writtenCache[1].id).toBe("existing");
  });

  it("updates existing entry in cache instead of prepending", async () => {
    const existingVersion: Entry = { id: "tmp-123", title: "Old title", type: "note", tags: [] };
    mockReadCache.mockResolvedValue([existingVersion]);
    await saveEntry(baseEntry, { brainId: "brain-1" });
    const writtenCache = mockWriteCache.mock.calls[0][0] as Entry[];
    expect(writtenCache).toHaveLength(1);
    expect(writtenCache[0].title).toBe("Test entry");
  });
});
