import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const AVATARS_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_AVATARS_BUCKET || "avatars"

export function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Thiếu cấu hình Supabase. Vui lòng thêm NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY vào .env.local rồi restart frontend.")
  }

  return createClient(supabaseUrl, supabaseAnonKey)
}
