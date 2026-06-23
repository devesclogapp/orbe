import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkAccount(email, password) {
  const result = { email };
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    result.error = authError.message;
    return result;
  }

  const { data: perfil, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (profileError) {
    result.error = profileError.message;
  } else {
    result.profile = perfil;
  }

  await supabase.auth.signOut();
  return result;
}

async function main() {
  const account1 = await checkAccount("suport.orbitalabs@gmail.com", "123456");
  const account2 = await checkAccount("dev.esclog@gmail.com", "123456");
  fs.writeFileSync(".agent/profiles_out.json", JSON.stringify([account1, account2], null, 2));
  console.log("Wrote to .agent/profiles_out.json");
}

main();
