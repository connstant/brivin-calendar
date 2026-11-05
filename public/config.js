// Our Week connection settings. These are safe to be public: the database itself only
// lets the planner login read or change anything (see supabase/setup.sql).
window.OUR_WEEK_CONFIG = {
  supabaseUrl: "https://ktrsnsnbbffzgpskhtwg.supabase.co",   // Supabase > Project Settings > API > Project URL
  supabaseAnonKey: "sb_publishable_ENztcMTezCmmK1SsZPxFEQ_-gJuENPt",                    // Supabase > Project Settings > API > anon public key
  // The planner's login name. Not a real inbox: example.com is reserved and never receives mail,
  // so no personal email is published. Create the Supabase login with this exact address.
  loginEmail: "plan@brivin.com",
};
