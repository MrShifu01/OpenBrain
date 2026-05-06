import { describe, it, expect, beforeEach } from "vitest";
import {
  isAppLockEnabled,
  setAppLockEnabled,
  getAppLockTimeoutMinutes,
  setAppLockTimeoutMinutes,
} from "../../src/lib/appLockSettings";

beforeEach(() => {
  localStorage.clear();
});

describe("appLockSettings", () => {
  it("disabled by default", () => {
    expect(isAppLockEnabled()).toBe(false);
  });
  it("toggle round-trips", () => {
    setAppLockEnabled(true);
    expect(isAppLockEnabled()).toBe(true);
    setAppLockEnabled(false);
    expect(isAppLockEnabled()).toBe(false);
  });
  it("timeout default is 15 min", () => {
    expect(getAppLockTimeoutMinutes()).toBe(15);
  });
  it("timeout round-trip for allowed values", () => {
    setAppLockTimeoutMinutes(5);
    expect(getAppLockTimeoutMinutes()).toBe(5);
    setAppLockTimeoutMinutes(60);
    expect(getAppLockTimeoutMinutes()).toBe(60);
  });
  it("timeout falls back to default for invalid stored values", () => {
    localStorage.setItem("em_app_lock_timeout_min_v1", "7");
    expect(getAppLockTimeoutMinutes()).toBe(15);
    localStorage.setItem("em_app_lock_timeout_min_v1", "junk");
    expect(getAppLockTimeoutMinutes()).toBe(15);
  });
});
