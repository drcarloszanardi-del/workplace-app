import { createClient } from '@supabase/supabase-js';

const url = 'https://ieznwnrhbroiaobheoan.supabase.co';
const anonKey = 'sb_publishable_plB4ZCERvl1im3-lMkjyZg_s79LO58M';

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});
