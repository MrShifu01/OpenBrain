// Vault — top-level router. The hook owns all state and crypto; this
// file picks which screen to render based on `status`.
//
// Sub-views live in sibling files:
//   - VaultLoading.tsx                       → loading state
//   - VaultSetup.tsx                         → setup form + recovery-key display
//   - VaultGate.tsx                          → locked screen + recovery-key entry
//   - VaultUnlocked.tsx                      → main unlocked view + add-secret modal
//   - components/vault/VaultPinScreen.tsx    → quick PIN unlock (sub-project 3)
//   - components/vault/VaultPinSetup.tsx     → first-time PIN/biometric enrolment
//
// States: loading → setup → show-recovery → locked | recovery | pin | pin-setup | unlocked

import { useEffect, useState } from "react";
import { useVaultOps } from "../hooks/useVaultOps";
import { useVaultLockTimer, getLockTimeoutMinutes } from "../hooks/useVaultLockTimer";
import { supabase } from "../lib/supabase";
import type { Entry } from "../types";
import { VaultLoading } from "./VaultLoading";
import { VaultLockedScreen, VaultRecoveryEntry } from "./VaultGate";
import { VaultRecoveryKeyDisplay, VaultSetupForm } from "./VaultSetup";
import { VaultUnlocked } from "./VaultUnlocked";
import { VaultPinScreen } from "../components/vault/VaultPinScreen";
import { VaultPinSetup } from "../components/vault/VaultPinSetup";

interface VaultViewProps {
  entries: Entry[];
  onSelect: (entry: Entry) => void;
  cryptoKey: CryptoKey | null;
  onVaultUnlock: (key: CryptoKey | null) => void;
  brainId?: string;
}

// SECURITY: vault entries are deliberately ISOLATED from the global memory
// `entries` array. There is no `onEntryCreated` prop — vault adds must NOT
// bubble up to a parent that could leak them into the memory grid (which
// renders both personal and shared brain feeds). Vault state lives entirely
// inside useVaultOps; the rest of the app never sees plaintext secrets.
export default function VaultView({
  entries,
  onSelect,
  cryptoKey,
  onVaultUnlock,
  brainId,
}: VaultViewProps) {
  const ops = useVaultOps({ entries, cryptoKey, onVaultUnlock, brainId });

  // WebAuthn enrolment needs a stable per-user identifier. Fetched lazily
  // on mount; only consumed during the rare PIN-setup flow.
  const [authUser, setAuthUser] = useState<{ id: string; email: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return;
      setAuthUser({ id: data.user.id, email: data.user.email ?? data.user.id });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Dormant auto-lock — wipes the in-memory key after N idle minutes.
  // Bumped on any decryption-class action (reveal, copy, add). Disabled
  // when the PIN/biometric flag is off (no quick way back in, so locking
  // would force a passphrase prompt every time).
  const { bump } = useVaultLockTimer({
    enabled: ops.pinFlagEnabled && ops.status === "unlocked",
    timeoutMinutes: getLockTimeoutMinutes(),
    onLock: ops.lockVault,
  });

  useEffect(() => {
    if (ops.status === "unlocked") bump();
    // Bump on any visible activity-counter change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ops.status, ops.revealedIds.size, ops.decryptedSecrets.length]);

  if (ops.status === "loading") {
    return <VaultLoading />;
  }

  if (ops.status === "setup") {
    return (
      <VaultSetupForm
        inputRef={ops.inputRef}
        passphrase={ops.passphrase}
        setPassphrase={ops.setPassphrase}
        confirmPhrase={ops.confirmPhrase}
        setConfirmPhrase={ops.setConfirmPhrase}
        error={ops.error}
        setError={ops.setError}
        busy={ops.busy}
        onSubmit={ops.handleSetup}
      />
    );
  }

  if (ops.status === "show-recovery") {
    return (
      <VaultRecoveryKeyDisplay
        recoveryKey={ops.generatedRecoveryKey}
        copied={ops.recoveryCopied}
        setCopied={ops.setRecoveryCopied}
        onDismiss={ops.dismissRecoveryKey}
      />
    );
  }

  if (ops.status === "locked") {
    return (
      <VaultLockedScreen
        inputRef={ops.inputRef}
        passphrase={ops.passphrase}
        setPassphrase={ops.setPassphrase}
        error={ops.error}
        setError={ops.setError}
        busy={ops.busy}
        secretsCount={ops.secrets.length}
        onUnlock={ops.handleUnlock}
        onUseRecoveryKey={ops.goToRecovery}
      />
    );
  }

  if (ops.status === "recovery") {
    return (
      <VaultRecoveryEntry
        inputRef={ops.inputRef}
        recoveryInput={ops.recoveryInput}
        setRecoveryInput={ops.setRecoveryInput}
        error={ops.error}
        setError={ops.setError}
        busy={ops.busy}
        onSubmit={ops.handleRecoveryUnlock}
        onBackToPassphrase={ops.backToPassphrase}
      />
    );
  }

  if (ops.status === "pin") {
    return (
      <VaultPinScreen
        busy={ops.pinBusy}
        error={ops.pinError}
        biometricEnrolled={!!ops.bioRecord}
        onSubmit={ops.handlePinUnlock}
        onBiometric={ops.handleBiometricUnlock}
        onUsePassphrase={ops.goToPassphraseFromPin}
      />
    );
  }

  if (ops.status === "pin-setup") {
    return (
      <VaultPinSetup
        busy={ops.pinBusy}
        error={ops.pinError}
        onSubmit={(params) => ops.handlePinSetup(params, authUser?.id, authUser?.email)}
        onSkip={ops.skipPinSetup}
      />
    );
  }

  return <VaultUnlocked ops={ops} onSelect={onSelect} />;
}
