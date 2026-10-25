import { createClient } from '@supabase/supabase-js';

// The anon key is public by design (it ships to every browser). Security comes from the
// Row Level Security policies in supabase/schema.sql. NEVER use the service_role key here.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configured = !!(url && key);
export const supabase = configured ? createClient(url, key) : null;
