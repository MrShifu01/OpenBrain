/**
 * events.ts owns the funnel taxonomy. The names land in the PostHog
 * dashboard as-is, so renaming an event silently is a regression — these
 * tests pin the wire format. The track() helper is mocked so we can assert
 * what would have been sent without spinning up posthog-js.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../posthog", () => ({
  track: vi.fn(),
}));

import { track } from "../posthog";
import {
  EVENT,
  trackSignupCompleted,
  trackFirstCapture,
  trackFirstChat,
  trackFirstInsightViewed,
  trackDay7ReturnIfDue,
  trackTierChange,
  trackCaptureMethod,
  trackNavViewActive,
} from "../events";

const trackMock = track as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  trackMock.mockClear();
});

describe("EVENT taxonomy", () => {
  it("exposes the 8 funnel event names with stable wire strings", () => {
    expect(EVENT).toEqual({
      signupCompleted: "signup_completed",
      firstCapture: "first_capture",
      firstChat: "first_chat",
      firstInsightViewed: "first_insight_viewed",
      day7Return: "day_7_return",
      tierUpgraded: "tier_upgraded",
      tierDowngraded: "tier_downgraded",
      captureMethod: "capture_method",
      navViewActive: "nav_view_active",
    });
  });
});

describe("one-shot helpers", () => {
  it("fires first_capture once per device, with method", () => {
    trackFirstCapture({ method: "text" });
    trackFirstCapture({ method: "voice" });
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith("first_capture", { method: "text" });
  });

  it("fires first_chat once", () => {
    trackFirstChat();
    trackFirstChat();
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith("first_chat");
  });

  it("fires signup_completed once", () => {
    trackSignupCompleted({ email: "x@y" });
    trackSignupCompleted({ email: "x@y" });
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith("signup_completed", { email: "x@y" });
  });

  it("fires first_insight_viewed once", () => {
    trackFirstInsightViewed({ entry_id: "e1" });
    trackFirstInsightViewed({ entry_id: "e2" });
    expect(trackMock).toHaveBeenCalledTimes(1);
  });
});

describe("trackDay7ReturnIfDue", () => {
  it("skips when user is younger than 7 days", () => {
    const fresh = new Date(Date.now() - 2 * 86_400_000).toISOString();
    trackDay7ReturnIfDue({ signup_at: fresh });
    expect(trackMock).not.toHaveBeenCalled();
  });

  it("fires when user is 7+ days old, once per device", () => {
    const old = new Date(Date.now() - 10 * 86_400_000).toISOString();
    trackDay7ReturnIfDue({ signup_at: old });
    trackDay7ReturnIfDue({ signup_at: old });
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith(
      "day_7_return",
      expect.objectContaining({ age_days: expect.any(Number) }),
    );
  });

  it("ignores invalid timestamps without throwing", () => {
    expect(() => trackDay7ReturnIfDue({ signup_at: "not-a-date" })).not.toThrow();
    expect(trackMock).not.toHaveBeenCalled();
  });
});

describe("trackTierChange", () => {
  it("fires tier_upgraded when rank increases", () => {
    trackTierChange("free", "pro");
    expect(trackMock).toHaveBeenCalledWith("tier_upgraded", { from: "free", to: "pro" });
  });

  it("fires tier_downgraded when rank decreases", () => {
    trackTierChange("pro", "starter");
    expect(trackMock).toHaveBeenCalledWith("tier_downgraded", { from: "pro", to: "starter" });
  });

  it("is a no-op when prev/next match", () => {
    trackTierChange("pro", "pro");
    expect(trackMock).not.toHaveBeenCalled();
  });

  it("is a no-op when either side is missing", () => {
    trackTierChange(undefined, "pro");
    trackTierChange("pro", undefined);
    expect(trackMock).not.toHaveBeenCalled();
  });

  it("ignores unknown tiers rather than guessing direction", () => {
    trackTierChange("legacy-plan", "pro");
    expect(trackMock).not.toHaveBeenCalled();
  });
});

describe("repeating helpers", () => {
  it("trackCaptureMethod fires every call", () => {
    trackCaptureMethod({ method: "text" });
    trackCaptureMethod({ method: "file" });
    trackCaptureMethod({ method: "text" });
    expect(trackMock).toHaveBeenCalledTimes(3);
  });

  it("trackNavViewActive includes from when provided", () => {
    trackNavViewActive({ view: "memory" });
    trackNavViewActive({ view: "settings", from: "memory" });
    expect(trackMock).toHaveBeenNthCalledWith(1, "nav_view_active", { view: "memory" });
    expect(trackMock).toHaveBeenNthCalledWith(2, "nav_view_active", {
      view: "settings",
      from: "memory",
    });
  });
});
