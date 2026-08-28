import { createClient } from "@supabase/supabase-js";

const fallbackUrl = "https://fixfjchpjaqqwjxkickj.supabase.co";
const fallbackKey = "sb_publishable_k3XGOSOiZ2iUzibMP0tXOw_lBd8ndWu";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackUrl;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || fallbackKey;

export const isSupabaseConfigured = Boolean(url && key);

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export function employeeEmail(employeeNo: string) {
  return `${employeeNo.trim().toLowerCase()}@sharkattend.local`;
}
