import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testEquipeNull() {
  // Check if we can find any foreign key or if any policies exist on equipes
  const { data, error } = await supabase.from('equipes').select('*').limit(5);
  console.log("Equipes atuais no banco:", data);
}

testEquipeNull();
