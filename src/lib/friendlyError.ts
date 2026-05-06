export function friendlyError(msg: unknown): string {
  const raw = msg instanceof Error ? msg.message : String(msg ?? "");
  const m = raw.toLowerCase();

  if (m.includes("database error saving new user"))
    return "Account setup failed. Please try again in a moment.";
  if (m.includes("invalid login credentials") || m.includes("invalid email or password"))
    return "That email and password didn't match. Please try again.";
  if (m.includes("email not confirmed"))
    return "Check your email and click the confirmation link before signing in.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "There's already an account with that email. Try signing in instead.";
  if (m.includes("rate limit") || m.includes("for security purposes"))
    return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("token has expired") || m.includes("otp expired") || m.includes("invalid token"))
    return "That code has expired. Please request a new one.";
  if (m.includes("password should be at least"))
    return "Pick a password with at least 6 characters.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled"))
    return "Sign-ups are temporarily paused. Please try again later.";
  if (
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("load failed") ||
    m.includes("network request failed")
  )
    return "We couldn't reach the server. Check your connection and try again.";
  if (/^http \d{3}$/i.test(raw.trim()))
    return "Something went wrong on our side. Please try again.";

  return raw || "Something went wrong. Please try again.";
}
