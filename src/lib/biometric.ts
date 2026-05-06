// WebAuthn biometric wrapper for the vault PIN/biometric flow.
//
// Sub-project 3 of 5 in EML "Vault — beyond V3 narrow scope".
//
// Uses the WebAuthn `prf` extension to derive deterministic key material
// from a platform authenticator (Touch ID / Face ID / Windows Hello /
// Android fingerprint via the browser). The PRF output wraps the raw
// vault key — see src/lib/vaultPinKey.ts.
//
// Capacitor native biometric (Face ID / Touch ID via plugin) is deferred
// until Capacitor is installed (per LAUNCH_CHECKLIST line 718). Until then
// this module is web-only and falls back to PIN if WebAuthn / prf is
// unsupported.

const RP_ID = typeof window !== "undefined" ? window.location.hostname : "localhost";
const RP_NAME = "Everion Mind";

// 32-byte fixed salt for the prf evaluation — the same input always
// produces the same output for a given credential, which is what we need
// for deterministic key derivation. Public, embedded in the JS bundle.
const PRF_SALT = new Uint8Array([
  0x65, 0x76, 0x65, 0x72, 0x69, 0x6f, 0x6e, 0x2d, 0x76, 0x61, 0x75, 0x6c, 0x74, 0x2d, 0x70, 0x72,
  0x66, 0x2d, 0x73, 0x61, 0x6c, 0x74, 0x2d, 0x76, 0x31, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

function bytesToB64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function b64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!window.PublicKeyCredential) return false;
  try {
    const available =
      await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return !!available;
  } catch {
    return false;
  }
}

export interface EnrollmentResult {
  credentialIdB64: string;
  prfOutput: Uint8Array;
  prfSupported: boolean;
}

/**
 * Register a new platform authenticator credential and return the prf
 * output for key derivation.
 *
 * @param userId  Stable per-user identifier (use Supabase user.id).
 * @param userEmail Display name for the OS keychain entry.
 *
 * @returns prfOutput is non-null only when the browser supports the prf
 *          extension AND the authenticator returned a value. If
 *          prfSupported is false, the caller MUST fall back to PIN-only
 *          and not store a biometric record (we have no key material).
 */
export async function enrollBiometric(
  userId: string,
  userEmail: string,
): Promise<EnrollmentResult | null> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return null;

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userIdBytes = new TextEncoder().encode(userId);

  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: challenge as BufferSource,
      rp: { id: RP_ID, name: RP_NAME },
      user: { id: userIdBytes as BufferSource, name: userEmail, displayName: userEmail },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" }, // ES256
        { alg: -257, type: "public-key" }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "required",
        userVerification: "required",
      },
      timeout: 60_000,
      extensions: {
        prf: { eval: { first: PRF_SALT as BufferSource } },
      } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;

  if (!cred) return null;
  const credentialIdB64 = bytesToB64Url(new Uint8Array(cred.rawId));

  // Try to read the prf output from the registration response.
  // Some browsers return it here; others require a follow-up assertion.
  const ext = cred.getClientExtensionResults() as unknown as {
    prf?: { results?: { first?: ArrayBuffer } };
  };
  const prfFirst = ext?.prf?.results?.first;
  if (prfFirst) {
    return {
      credentialIdB64,
      prfOutput: new Uint8Array(prfFirst),
      prfSupported: true,
    };
  }

  // Follow-up assertion to fetch prf output for this credential.
  const assertion = await assertBiometric(credentialIdB64);
  if (assertion?.prfOutput) {
    return { credentialIdB64, prfOutput: assertion.prfOutput, prfSupported: true };
  }
  return { credentialIdB64, prfOutput: new Uint8Array(0), prfSupported: false };
}

export interface AssertionResult {
  prfOutput: Uint8Array | null;
}

export async function assertBiometric(credentialIdB64: string): Promise<AssertionResult | null> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return null;
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const credentialIdBytes = b64UrlToBytes(credentialIdB64);
  try {
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: challenge as BufferSource,
        rpId: RP_ID,
        allowCredentials: [
          {
            id: credentialIdBytes as BufferSource,
            type: "public-key",
            transports: ["internal"],
          },
        ],
        userVerification: "required",
        timeout: 60_000,
        extensions: {
          prf: { eval: { first: PRF_SALT as BufferSource } },
        } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential | null;
    if (!assertion) return null;
    const ext = assertion.getClientExtensionResults() as unknown as {
      prf?: { results?: { first?: ArrayBuffer } };
    };
    const prfFirst = ext?.prf?.results?.first;
    return { prfOutput: prfFirst ? new Uint8Array(prfFirst) : null };
  } catch {
    return null;
  }
}
