import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function fixAccount(email, password, newRole) {
  const result = { email };
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    result.error = authError.message;
    return result;
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('user_id', authData.user.id);

  if (profileError) {
    result.error = profileError.message;
  } else {
    result.success = true;
    result.role = newRole;
  }

  await supabase.auth.signOut();
  return result;
}

async function main() {
  const fix1 = await fixAccount("suport.orbitalabs@gmail.com", "123456", "admin");
  console.log(fix1);
}

main();
