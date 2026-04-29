import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor wrap for Everion Mind. Single TS source, native shells per store.
// Bundle ID locked in LAUNCH_CHECKLIST.md (M0 — 2026-04-29 decisions).
//
// `webDir` points at Vite's build output. Run `npm run build && npx cap sync`
// before opening the native projects to refresh the bundled web assets.
//
// `androidScheme: 'https'` keeps Service-Worker + secure-context features
// working inside the Android WebView (default `http` blocks them).
const config: CapacitorConfig = {
  appId: "com.everionmind.app",
  appName: "Everion Mind",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  ios: {
    contentInset: "automatic",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#FAF6EF",
      androidScaleType: "CENTER_CROP",
      splashImmersive: false,
    },
  },
};

export default config;
