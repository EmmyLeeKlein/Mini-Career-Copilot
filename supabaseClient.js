// supabaseClient.js — initializes the Supabase JS client.
//
// The anon key is meant to be public: it identifies the project, not a
// user, and every table is locked down with row-level security policies
// scoped to auth.uid(). It is safe to ship in client-side code.
//
// Connects to: auth.js, db.js (both read window.supabaseClient)

const SUPABASE_URL = 'https://rnmftiwgkgehzmqctsfg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJubWZ0aXdna2dlaHptcWN0c2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMjkxMjIsImV4cCI6MjA5NzgwNTEyMn0.lIba4aKL7ELYw9xWCaguJAUPLJKrNmOe82EmgiG_17E';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
