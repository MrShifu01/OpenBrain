import { createClient } from "@supabase/supabase-js";

// Session stored in localStorage per Supabase JS v2 default.
// Accepted risk under current CSP (script-src 'self'). Revisit if CSP is relaxed.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
