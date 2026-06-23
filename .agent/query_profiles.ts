import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function main() {
  const { data, error } = await supabase
    .from("profiles")
    .select("role");

  if (error) {
    console.error("Error:", error);
    return;
  }
  
  console.log("Profiles:");
  console.log(data);
}

main();
