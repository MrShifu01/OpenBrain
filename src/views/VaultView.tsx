// Vault — top-level router. The hook owns all state and crypto; this
// file picks which screen to render based on `status`.
//
// Sub-views live in sibling files:
//   - VaultLoading.tsx   → loading state
//   - VaultSetup.tsx     → setup form + recovery-key display
//   - VaultGate.tsx      → locked screen + recovery-key entry
//   - VaultUnlocked.tsx  → main unlocked view + add-secret modal
//
// States: loading → setup → show-recovery → locked | recovery | unlocked

import { useVaultOps } from "../hooks/useVaultOps";
import type { Entry } from "../types";
import { VaultLoading } from "./VaultLoading";
import { VaultLockedScreen, VaultRecoveryEntry } from "./VaultGate";
import { VaultRecoveryKeyDisplay, VaultSetupForm } from "./VaultSetup";
import { VaultUnlocked } from "./VaultUnlocked";

interface VaultViewProps {
  entries: Entry[];
  onSelect: (entry: Entry) => void;
  cryptoKey: CryptoKey | null;
  onVaultUnlock: (key: CryptoKey | null) => void;
  brainId?: string;
  onEntryCreated?: (entry: Entry) => void;
}

export default function VaultView({
  entries,
  onSelect,
  cryptoKey,
  onVaultUnlock,
  brainId,
  onEntryCreated,
}: VaultViewProps) {
  const ops = useVaultOps({ entries, cryptoKey, onVaultUnlock, brainId, onEntryCreated });

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

  return <VaultUnlocked ops={ops} onSelect={onSelect} />;
}
