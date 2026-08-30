const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

let supabase = null;

if (env.supabaseUrl && env.supabaseServiceRoleKey) {
  try {
    supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey);
    console.log('[Database] Connected to Supabase Client');
  } catch (err) {
    console.warn('[Database] Failed to connect to Supabase, falling back to local store:', err.message);
  }
}

// In-Memory Stateful DB for local fallback testing
const localDb = {
  users: [],
  documents: [],
  document_chunks: [],
  conversations: [],
  messages: []
};

module.exports = {
  supabase,
  localDb,
  isSupabaseConfigured: () => !!supabase
};
