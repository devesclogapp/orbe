import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('lancamentos_diaristas').select('*').limit(1);
  if (data && data.length > 0) {
     console.log(Object.keys(data[0]));
  } else {
     console.log("No data or error:", error);
  }
}
test();
