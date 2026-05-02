import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useVaultLockTimer,
  getLockTimeoutMinutes,
  setLockTimeoutMinutes,
} from "../../src/hooks/useVaultLockTimer";

beforeEach(() => {
  vi.useFakeTimers();
  if (typeof localStorage !== "undefined") localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useVaultLockTimer", () => {
  it("calls onLock after timeoutMinutes when enabled", () => {
    const onLock = vi.fn();
    renderHook(() => useVaultLockTimer({ enabled: true, timeoutMinutes: 5, onLock }));
    expect(onLock).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(5 * 60_000 - 1);
    });
    expect(onLock).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(onLock).toHaveBeenCalledTimes(1);
  });

  it("bump() resets the countdown", () => {
    const onLock = vi.fn();
    const { result } = renderHook(() =>
      useVaultLockTimer({ enabled: true, timeoutMinutes: 5, onLock }),
    );
    act(() => {
      vi.advanceTimersByTime(4 * 60_000);
    });
    act(() => {
      result.current.bump();
    });
    act(() => {
      vi.advanceTimersByTime(4 * 60_000);
    });
    expect(onLock).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2 * 60_000);
    });
    expect(onLock).toHaveBeenCalledTimes(1);
  });

  it("disabled never fires", () => {
    const onLock = vi.fn();
    renderHook(() => useVaultLockTimer({ enabled: false, timeoutMinutes: 5, onLock }));
    act(() => {
      vi.advanceTimersByTime(60 * 60_000);
    });
    expect(onLock).not.toHaveBeenCalled();
  });

  it("flipping enabled false → true starts the timer", () => {
    const onLock = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useVaultLockTimer({ enabled, timeoutMinutes: 5, onLock }),
      { initialProps: { enabled: false } },
    );
    act(() => {
      vi.advanceTimersByTime(10 * 60_000);
    });
    expect(onLock).not.toHaveBeenCalled();
    rerender({ enabled: true });
    act(() => {
      vi.advanceTimersByTime(5 * 60_000 + 1);
    });
    expect(onLock).toHaveBeenCalledTimes(1);
  });
});

describe("getLockTimeoutMinutes / setLockTimeoutMinutes", () => {
  it("default is 15 when nothing stored", () => {
    expect(getLockTimeoutMinutes()).toBe(15);
  });
  it("round-trips valid values", () => {
    setLockTimeoutMinutes(5);
    expect(getLockTimeoutMinutes()).toBe(5);
    setLockTimeoutMinutes(30);
    expect(getLockTimeoutMinutes()).toBe(30);
    setLockTimeoutMinutes(60);
    expect(getLockTimeoutMinutes()).toBe(60);
  });
  it("ignores non-allowed values from storage", () => {
    localStorage.setItem("em_vault_lock_timeout_min", "7");
    expect(getLockTimeoutMinutes()).toBe(15);
    localStorage.setItem("em_vault_lock_timeout_min", "junk");
    expect(getLockTimeoutMinutes()).toBe(15);
  });
});
