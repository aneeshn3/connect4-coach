import { supabase } from './src/lib/supabase.js';

const listUsers = async () => {
  const { data, error } = await supabase
    .from('players')
    .select('username, best_diagnostic_score')
    .order('username');
  
  console.log('All users:', { data, error });
};

listUsers(); 