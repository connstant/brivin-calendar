// Our Week connection settings. These are safe to be public: the database itself only
// lets the planner login read or change anything (see supabase/setup.sql).
window.OUR_WEEK_CONFIG = {
  supabaseUrl: "https://ktrsnsnbbffzgpskhtwg.supabase.co",   // Supabase > Project Settings > API > Project URL
  supabaseAnonKey: "sb_publishable_ENztcMTezCmmK1SsZPxFEQ_-gJuENPt",                    // Supabase > Project Settings > API > anon public key
  // The planner's login name. Must match the user in Supabase > Authentication and the email in
  // supabase/setup.sql (planner_members).
  loginEmail: "plan@brivin.com",
};
