import { useState, useEffect, useRef, useCallback } from "react";
import { authFetch } from "../lib/authFetch";
import { friendlyError } from "../lib/friendlyError";
import {
  setupVault,
  unlockVault,
  decryptEntry,
  encryptEntry,
  generateRecoveryKey,
  encryptVaultKeyForRecovery,
  decryptVaultKeyFromRecovery,
} from "../lib/crypto";
import type { TemplateId } from "../lib/vaultTemplates";
import {
  loadPinRecord,
  savePinRecord,
  clearPinRecord,
  loadBiometricRecord,
  saveBiometricRecord,
  clearBiometricRecord,
  unwrapVaultKeyWithPin,
  wrapVaultKeyWithPin,
  unwrapVaultKeyWithBiometricMaterial,
  wrapVaultKeyWithBiometricMaterial,
  isValidPin,
  type PinRecord,
  type BiometricRecord,
} from "../lib/vaultPinKey";
import { assertBiometric, enrollBiometric, isBiometricAvailable } from "../lib/biometric";
import { isFeatureEnabled, getAdminFlags } from "../lib/featureFlags";
import type { Entry } from "../types";

interface VaultData {
  exists: boolean;
  salt: string;
  verify_token: string;
  recovery_blob: string;
}

interface UseVaultOpsOptions {
  entries?: Entry[]; // kept for backward compat (legacy secrets in entries table)
  cryptoKey: CryptoKey | null;
  onVaultUnlock: (key: CryptoKey | null) => void;
  brainId?: string;
  onEntryCreated?: (entry: Entry) => void;
}

export function useVaultOps({
  entries = [],
  cryptoKey,
  onVaultUnlock,
  brainId,
  onEntryCreated,
}: UseVaultOpsOptions) {
  const [status, setStatus] = useState("loading");
  const [passphrase, setPassphrase] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [recoveryInput, setRecoveryInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [vaultData, setVaultData] = useState<VaultData | null>(null);
  const [generatedRecoveryKey, setGeneratedRecoveryKey] = useState("");
  const [recoveryCopied, setRecoveryCopied] = useState(false);
  const [decryptedSecrets, setDecryptedSecrets] = useState<Entry[]>([]);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const [showAddSecret, setShowAddSecret] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addContent, setAddContent] = useState("");
  const [addTags, setAddTags] = useState("");
  const [addMetaRows, setAddMetaRows] = useState<{ key: string; value: string }[]>([]);
  const [addError, setAddError] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  // Vault entries from the dedicated vault_entries table
  const [vaultEntries, setVaultEntries] = useState<Entry[]>([]);

  // PIN + biometric (sub-project 3). Behind feature flag; no-op when off.
  const pinFlagEnabled = isFeatureEnabled("vaultPinBiometric", getAdminFlags());
  const [pinRecord, setPinRecord] = useState<PinRecord | null>(() =>
    pinFlagEnabled ? loadPinRecord() : null,
  );
  const [bioRecord, setBioRecord] = useState<BiometricRecord | null>(() =>
    pinFlagEnabled ? loadBiometricRecord() : null,
  );
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinBusy, setPinBusy] = useState(false);

  const fetchVaultEntries = useCallback(async () => {
    try {
      const url = brainId
        ? `/api/vault-entries?brain_id=${encodeURIComponent(brainId)}`
        : "/api/vault-entries";
      const r = await authFetch(url);
      if (r.ok) {
        const data: Array<Record<string, unknown>> = await r.json();
        setVaultEntries(data.map((e) => ({ ...e, type: "secret" as const })) as Entry[]);
      }
    } catch (e) {
      console.error("[vault] fetch failed:", e);
    }
  }, [brainId]);

  // Legacy: secrets still in the entries table (before migration)
  const legacySecrets = entries.filter((e: Entry) => e.type === "secret" || e.encrypted === true);

  // Combined — vault_entries takes precedence; legacy fills gap
  const secrets = [
    ...vaultEntries,
    ...legacySecrets.filter((ls) => !vaultEntries.find((ve) => ve.id === ls.id)),
  ];

  useEffect(() => {
    if (cryptoKey) {
      setStatus("unlocked");
      fetchVaultEntries();
      return;
    }
    // Hard timeout so /api/vault hanging doesn't leave the user stuck
    // on "checking the seal…" forever. 6s is past p95 even on slow
    // mobile networks; if we haven't heard back by then, fall through
    // to "setup" — same outcome as a 5xx.
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        setStatus("setup");
      }
    }, 6000);
    authFetch("/api/vault")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        if (!data) {
          setStatus("setup");
          return;
        }
        if (data.exists) {
          setVaultData(data);
          // Prefer PIN/biometric if a wrapper record exists on this device.
          if (pinFlagEnabled && (loadPinRecord() || loadBiometricRecord())) {
            setStatus("pin");
          } else {
            setStatus("locked");
          }
          fetchVaultEntries();
        } else setStatus("setup");
      })
      .catch(() => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        setStatus("setup");
      });
    return () => window.clearTimeout(timeoutId);
  }, [cryptoKey, fetchVaultEntries, pinFlagEnabled]);

  useEffect(() => {
    if (status !== "unlocked" || !cryptoKey || secrets.length === 0) {
      setDecryptedSecrets([]);
      return;
    }
    Promise.all(secrets.map((e) => decryptEntry(e, cryptoKey)))
      .then((result) => setDecryptedSecrets(result as Entry[]))
      .catch(() => setDecryptedSecrets(secrets));
  }, [status, cryptoKey, secrets.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for cross-cutting deletes dispatched from useEntryActions
  // (e.g. DetailModal's delete button). Without this, deleting a vault
  // entry from the modal would hit the API and update useDataLayer's
  // entries / vaultEntries — but the visible Vault grid reads from this
  // hook's local copy, so the row would linger until the next refresh.
  useEffect(() => {
    function onEntryDeleted(ev: Event) {
      const detail = (ev as CustomEvent).detail as { id?: string; type?: string } | undefined;
      const id = detail?.id;
      if (!id) return;
      setVaultEntries((prev) => prev.filter((e) => e.id !== id));
      setDecryptedSecrets((prev) => prev.filter((e) => e.id !== id));
    }
    window.addEventListener("everion:entry-deleted", onEntryDeleted);
    return () => window.removeEventListener("everion:entry-deleted", onEntryDeleted);
  }, []);

  useEffect(() => {
    if (["setup", "locked", "recovery"].includes(status)) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [status]);

  const handleSetup = useCallback(async () => {
    if (passphrase.length < 8) {
      setError("Passphrase must be at least 8 characters");
      return;
    }
    if (passphrase !== confirmPhrase) {
      setError("Passphrases don't match");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { key, salt, verifyToken } = await setupVault(passphrase);
      const recoveryKey = generateRecoveryKey();
      const recoveryBlob = await encryptVaultKeyForRecovery(key, recoveryKey);
      const res = await authFetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salt, verify_token: verifyToken, recovery_blob: recoveryBlob }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setGeneratedRecoveryKey(recoveryKey);
      onVaultUnlock(key);
      setStatus("show-recovery");
    } catch (e) {
      setError(friendlyError(e));
    }
    setBusy(false);
  }, [passphrase, confirmPhrase, onVaultUnlock]);

  const handleUnlock = useCallback(async () => {
    if (!passphrase.trim()) return;
    setBusy(true);
    setError("");
    try {
      const key = await unlockVault(passphrase, vaultData!.salt, vaultData!.verify_token);
      if (!key) {
        setError("Wrong passphrase");
        setBusy(false);
        return;
      }
      onVaultUnlock(key);
      // If the PIN/biometric flag is on AND this device has no PIN record
      // yet, route to the one-time PIN setup screen so the next unlock
      // doesn't have to re-derive from the passphrase.
      if (pinFlagEnabled && !loadPinRecord()) {
        setStatus("pin-setup");
      } else {
        setStatus("unlocked");
      }
    } catch {
      setError("Decryption failed");
    }
    setBusy(false);
  }, [passphrase, vaultData, onVaultUnlock, pinFlagEnabled]);

  const handleRecoveryUnlock = useCallback(async () => {
    const cleaned = recoveryInput.trim().toUpperCase();
    if (!cleaned) return;
    setBusy(true);
    setError("");
    try {
      const key = await decryptVaultKeyFromRecovery(vaultData!.recovery_blob, cleaned);
      if (!key) {
        setError("Invalid recovery key");
        setBusy(false);
        return;
      }
      onVaultUnlock(key);
      if (pinFlagEnabled && !loadPinRecord()) {
        setStatus("pin-setup");
      } else {
        setStatus("unlocked");
      }
    } catch {
      setError("Recovery failed — check your key and try again");
    }
    setBusy(false);
  }, [recoveryInput, vaultData, onVaultUnlock, pinFlagEnabled]);

  // ── PIN + biometric (sub-project 3) ──

  const handlePinUnlock = useCallback(
    async (enteredPin: string) => {
      const record = loadPinRecord();
      if (!record) {
        setPinError("No PIN configured on this device.");
        return;
      }
      setPinBusy(true);
      setPinError("");
      const key = await unwrapVaultKeyWithPin(record, enteredPin);
      if (!key) {
        setPinError("Wrong PIN.");
        setPinBusy(false);
        return;
      }
      onVaultUnlock(key);
      setStatus("unlocked");
      setPin("");
      setPinBusy(false);
    },
    [onVaultUnlock],
  );

  const handleBiometricUnlock = useCallback(async () => {
    const bio = loadBiometricRecord();
    if (!bio) {
      setPinError("No biometric configured on this device.");
      return;
    }
    setPinBusy(true);
    setPinError("");
    const assertion = await assertBiometric(bio.credential_id_b64);
    if (!assertion?.prfOutput) {
      setPinError("Biometric unlock failed — try PIN.");
      setPinBusy(false);
      return;
    }
    const key = await unwrapVaultKeyWithBiometricMaterial(bio, assertion.prfOutput);
    if (!key) {
      setPinError("Biometric unlock failed — wrong credential?");
      setPinBusy(false);
      return;
    }
    onVaultUnlock(key);
    setStatus("unlocked");
    setPinBusy(false);
  }, [onVaultUnlock]);

  const handlePinSetup = useCallback(
    async (
      params: { pin: string; enableBiometric: boolean },
      userId?: string,
      userEmail?: string,
    ) => {
      if (!cryptoKey) {
        setPinError("Vault is locked — re-enter passphrase first.");
        return;
      }
      if (!isValidPin(params.pin)) {
        setPinError("PIN must be 4–8 digits.");
        return;
      }
      setPinBusy(true);
      setPinError("");
      try {
        const pinRec = await wrapVaultKeyWithPin(cryptoKey, params.pin);
        savePinRecord(pinRec);
        setPinRecord(pinRec);

        if (params.enableBiometric && (await isBiometricAvailable()) && userId) {
          const enrollment = await enrollBiometric(userId, userEmail || userId);
          if (enrollment?.prfSupported && enrollment.prfOutput.byteLength >= 32) {
            const bioRec = await wrapVaultKeyWithBiometricMaterial(
              cryptoKey,
              enrollment.prfOutput,
              enrollment.credentialIdB64,
            );
            saveBiometricRecord(bioRec);
            setBioRecord(bioRec);
          }
        }
        setStatus("unlocked");
      } catch (e) {
        setPinError(e instanceof Error ? e.message : "Setup failed");
      }
      setPinBusy(false);
    },
    [cryptoKey],
  );

  const skipPinSetup = useCallback(() => {
    setStatus("unlocked");
  }, []);

  const goToPassphraseFromPin = useCallback(() => {
    setPin("");
    setPinError("");
    setStatus("locked");
  }, []);

  const removePinAndBiometric = useCallback(() => {
    clearPinRecord();
    clearBiometricRecord();
    setPinRecord(null);
    setBioRecord(null);
  }, []);

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text: string, label?: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyMsg(label || "Copied");
      setTimeout(() => setCopyMsg(null), 2000);
    });
  };

  const resetAddForm = () => {
    setAddTitle("");
    setAddContent("");
    setAddTags("");
    setAddMetaRows([]);
    setAddError("");
  };

  const handleAddSecret = useCallback(async () => {
    if (!cryptoKey) {
      setAddError("Vault is locked");
      return;
    }
    if (!addTitle.trim() || !addContent.trim()) {
      setAddError("Title and content are required");
      return;
    }
    setAddBusy(true);
    setAddError("");
    try {
      const tagList = addTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const metadata: Record<string, string> = {};
      for (const row of addMetaRows) {
        const k = row.key.trim();
        const v = row.value.trim();
        if (k && v) metadata[k] = v;
      }
      const plain = {
        title: addTitle.trim(),
        content: addContent,
        type: "secret" as const,
        tags: tagList,
        metadata,
      };
      const encrypted = await encryptEntry(plain, cryptoKey);
      const res = await authFetch("/api/vault-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: plain.title,
          content: encrypted.content,
          metadata: typeof encrypted.metadata === "string" ? encrypted.metadata : "",
          tags: tagList,
          ...(brainId ? { brain_id: brainId } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const result = await res.json().catch(() => null);
      const newEntry: Entry = {
        id: result?.id || Date.now().toString(),
        title: plain.title,
        content: plain.content,
        type: "secret",
        tags: tagList,
        metadata,
      };
      setDecryptedSecrets((prev) => [newEntry, ...prev]);
      onEntryCreated?.(newEntry);
      resetAddForm();
      setShowAddSecret(false);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Failed to save secret");
    }
    setAddBusy(false);
  }, [addTitle, addContent, addTags, addMetaRows, cryptoKey, brainId, onEntryCreated]);

  // New path: template-shaped add. Coexists with handleAddSecret (legacy
  // free-form path) so flag-off keeps working unchanged. Spec:
  // docs/superpowers/specs/2026-05-02-vault-entry-templates-design.md
  const handleAddSecretWithTemplate = useCallback(
    async (payload: {
      templateId: TemplateId;
      title: string;
      content: string;
      metadataObj: Record<string, string>;
      tags: string[];
    }) => {
      if (!cryptoKey) {
        setAddError("Vault is locked");
        return;
      }
      if (!payload.title.trim() || !payload.content.trim()) {
        setAddError("Title and content are required");
        return;
      }
      setAddBusy(true);
      setAddError("");
      try {
        const metadata: Record<string, string> = {
          template_type: payload.templateId,
        };
        for (const [k, v] of Object.entries(payload.metadataObj)) {
          if (v && v.trim()) metadata[k] = v;
        }
        const plain = {
          title: payload.title.trim(),
          content: payload.content,
          type: "secret" as const,
          tags: payload.tags,
          metadata,
        };
        const encrypted = await encryptEntry(plain, cryptoKey);
        const res = await authFetch("/api/vault-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: plain.title,
            content: encrypted.content,
            metadata: typeof encrypted.metadata === "string" ? encrypted.metadata : "",
            tags: payload.tags,
            ...(brainId ? { brain_id: brainId } : {}),
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        const result = await res.json().catch(() => null);
        const newEntry: Entry = {
          id: result?.id || Date.now().toString(),
          title: plain.title,
          content: plain.content,
          type: "secret",
          tags: payload.tags,
          metadata,
        };
        setDecryptedSecrets((prev) => [newEntry, ...prev]);
        onEntryCreated?.(newEntry);
        resetAddForm();
        setShowAddSecret(false);
      } catch (e) {
        setAddError(e instanceof Error ? e.message : "Failed to save secret");
      }
      setAddBusy(false);
    },
    [cryptoKey, brainId, onEntryCreated],
  );

  const bulkDelete = useCallback(async () => {
    if (
      !confirm(
        `Permanently delete ${selectedIds.size} selected secret${selectedIds.size !== 1 ? "s" : ""}? This cannot be undone.`,
      )
    )
      return;
    const ids = Array.from(selectedIds);
    const legacyIds = new Set(legacySecrets.map((e) => e.id));
    for (const id of ids) {
      // Delete from appropriate table based on origin
      const endpoint = legacyIds.has(id) ? `/api/entries?id=${id}` : `/api/vault-entries?id=${id}`;
      const res = await authFetch(endpoint, { method: "DELETE" }).catch(() => null);
      if (res?.ok) {
        setDecryptedSecrets((prev) => prev.filter((e) => e.id !== id));
        setVaultEntries((prev) => prev.filter((e) => e.id !== id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }
    setBulkMode(false);
  }, [selectedIds, legacySecrets]);

  const lockVault = () => {
    setStatus("locked");
    setPassphrase("");
    setRecoveryInput("");
    setRevealedIds(new Set());
    setBulkMode(false);
    setSelectedIds(new Set());
    onVaultUnlock(null);
  };

  const startAddSecret = () => {
    resetAddForm();
    setShowAddSecret(true);
  };

  const goToRecovery = () => {
    setError("");
    setRecoveryInput("");
    setStatus("recovery");
  };

  const backToPassphrase = () => {
    setError("");
    setPassphrase("");
    setStatus("locked");
  };

  const dismissRecoveryKey = () => {
    setGeneratedRecoveryKey("");
    setStatus("unlocked");
  };

  return {
    // state
    status,
    setStatus,
    passphrase,
    setPassphrase,
    confirmPhrase,
    setConfirmPhrase,
    recoveryInput,
    setRecoveryInput,
    error,
    setError,
    busy,
    vaultData,
    generatedRecoveryKey,
    recoveryCopied,
    setRecoveryCopied,
    decryptedSecrets,
    revealedIds,
    copyMsg,
    bulkMode,
    setBulkMode,
    selectedIds,
    setSelectedIds,
    inputRef,
    showAddSecret,
    setShowAddSecret,
    addTitle,
    setAddTitle,
    addContent,
    setAddContent,
    addTags,
    setAddTags,
    addMetaRows,
    setAddMetaRows,
    addError,
    setAddError,
    addBusy,
    secrets,
    // handlers
    handleSetup,
    handleUnlock,
    handleRecoveryUnlock,
    handleAddSecret,
    handleAddSecretWithTemplate,
    bulkDelete,
    // PIN + biometric (sub-project 3)
    pinFlagEnabled,
    pinRecord,
    bioRecord,
    pin,
    setPin,
    pinError,
    pinBusy,
    handlePinUnlock,
    handleBiometricUnlock,
    handlePinSetup,
    skipPinSetup,
    goToPassphraseFromPin,
    removePinAndBiometric,
    toggleReveal,
    copyToClipboard,
    resetAddForm,
    lockVault,
    startAddSecret,
    goToRecovery,
    backToPassphrase,
    dismissRecoveryKey,
    refetchVaultEntries: fetchVaultEntries,
  };
}
