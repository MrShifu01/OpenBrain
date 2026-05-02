// Settings section for the app-level lock (sub-project 4 of 5 in EML
// "Vault — beyond V3 narrow scope"). Reuses the same vault PIN /
// biometric records — no second PIN to manage.
//
// Hidden entirely when:
//   - the appLock feature flag is off, OR
//   - no vault PIN has been set on this device (nothing to verify against)

import { useState } from "react";
import SettingsRow from "./SettingsRow";
import { Button } from "../ui/button";
import { isFeatureEnabled, getAdminFlags } from "../../lib/featureFlags";
import {
  isAppLockEnabled,
  setAppLockEnabled,
  getAppLockTimeoutMinutes,
  setAppLockTimeoutMinutes,
  type AppLockTimeoutMinutes,
} from "../../lib/appLockSettings";
import { loadPinRecord, loadBiometricRecord } from "../../lib/vaultPinKey";

const TIMEOUT_OPTIONS: AppLockTimeoutMinutes[] = [5, 15, 30, 60];

export function AppLockSection() {
  const flagOn = isFeatureEnabled("appLock", getAdminFlags());
  const [enabled, setEnabledLocal] = useState(() => isAppLockEnabled());
  const [timeout, setTimeoutLocal] = useState<AppLockTimeoutMinutes>(() =>
    getAppLockTimeoutMinutes(),
  );
  const hasVaultPin = !!loadPinRecord();
  const hasBio = !!loadBiometricRecord();

  if (!flagOn) return null;

  const onToggle = (next: boolean) => {
    setAppLockEnabled(next);
    setEnabledLocal(next);
  };

  const onTimeout = (next: AppLockTimeoutMinutes) => {
    setAppLockTimeoutMinutes(next);
    setTimeoutLocal(next);
  };

  return (
    <div className="space-y-4 border-t pt-4" style={{ borderColor: "var(--line-soft)" }}>
      <SettingsRow
        label="App lock"
        hint={
          hasVaultPin
            ? "Hide the entire app behind your vault PIN or biometric after idle. Useful on shared devices."
            : "Set up Quick Unlock on the Vault first — app lock reuses that PIN/biometric."
        }
      >
        {hasVaultPin ? (
          <Button
            size="sm"
            variant={enabled ? "outline" : "default"}
            onClick={() => onToggle(!enabled)}
            style={enabled ? { color: "var(--ember)", borderColor: "var(--ember)" } : undefined}
          >
            {enabled ? "Disable" : "Enable"}
          </Button>
        ) : (
          <span
            className="text-xs italic"
            style={{ color: "var(--ink-faint)", fontFamily: "var(--f-serif)" }}
          >
            requires Vault Quick Unlock
          </span>
        )}
      </SettingsRow>

      {hasVaultPin && enabled && (
        <SettingsRow
          label="Lock after"
          hint="Idle minutes before the lock screen appears. Resets on any keypress, click, or scroll."
        >
          <div className="flex gap-1">
            {TIMEOUT_OPTIONS.map((m) => (
              <Button
                key={m}
                size="sm"
                variant={m === timeout ? "default" : "outline"}
                onClick={() => onTimeout(m)}
                style={
                  m === timeout
                    ? { background: "var(--ember)", color: "white", borderColor: "var(--ember)" }
                    : undefined
                }
              >
                {m}m
              </Button>
            ))}
          </div>
        </SettingsRow>
      )}

      {hasVaultPin && enabled && hasBio && (
        <p className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
          Biometric (Face ID / Touch ID / Windows Hello) available on the lock screen.
        </p>
      )}
    </div>
  );
}
