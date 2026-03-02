import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const adminKey = Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !adminKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY");
}

export function createAdminClient() {
  return createClient(supabaseUrl, adminKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
