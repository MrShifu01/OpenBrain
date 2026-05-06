# /.well-known/

Static well-known files served by Vercel from `public/.well-known/`. Specific
OAuth discovery routes are rewritten to `api/mcp` in `vercel.json`; everything
else here is plain static.

## `assetlinks.json`

Android App Links — proves to the OS that `everionmind.com` is owned by the same
party that signed the production AAB. Without this file, the App Link
intent-filter in `android/app/src/main/AndroidManifest.xml` cannot use
`android:autoVerify="true"`, so Android prompts the user to choose between the
app and the browser on every magic-link tap (worse UX, higher drop-off).

### Fingerprint extraction

Replace `REPLACE_WITH_PRODUCTION_KEYSTORE_SHA256_FINGERPRINT` with the SHA-256
fingerprint from the production keystore:

```bash
cd android
keytool -list -v -keystore everion-release.jks -alias everion \
  | grep "SHA256:" \
  | head -1 \
  | awk '{print $2}'
```

Output looks like `AB:CD:EF:12:34:...:99:00`. Paste it verbatim (colons and
all) into `sha256_cert_fingerprints[0]`.

### Verifying the file is reachable

After deploying:

```bash
curl https://everionmind.com/.well-known/assetlinks.json
```

Expected: 200 OK, `Content-Type: application/json`, the JSON above.

### Verifying with Google's tester

Google provides an official validator:
https://developers.google.com/digital-asset-links/tools/generator

Paste `https://everionmind.com` + `com.everionmind.app` + the SHA-256
fingerprint. The "Test statement" button hits the live URL and confirms the
fingerprint matches.

### Flipping autoVerify=true

Once the file is reachable AND the fingerprint matches the keystore, change
`android:autoVerify="false"` to `android:autoVerify="true"` on the App Link
intent-filter in `AndroidManifest.xml`. Rebuild + reinstall on a real device:

```bash
adb shell pm verify-app-links --re-verify com.everionmind.app
adb shell pm get-app-links com.everionmind.app
```

`STATE_VERIFIED` means it worked. `STATE_FAIL` means the fingerprint is wrong
or the file isn't reachable.

## `apple-app-site-association` (iOS — DEFERRED)

When the iOS app ships, add `apple-app-site-association` (no extension) here.
See `EverionMindLaunch/LAUNCH_CHECKLIST.md` § Post-launch — iOS launch sprint.

## OAuth discovery endpoints

The following are NOT static files — they're handled dynamically by
`api/mcp.ts`:

- `/.well-known/oauth-authorization-server`
- `/.well-known/openid-configuration`

These are wired via explicit rewrites in `vercel.json`.
