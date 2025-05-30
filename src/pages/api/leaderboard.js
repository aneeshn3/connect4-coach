import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('wins', { ascending: false })
      .limit(10)

    if (error) {
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    const { user_id, username, wins } = req.body
    
    const { data, error } = await supabase
      .from('leaderboard')
      .upsert([
        {
          user_id,
          username,
          wins: wins
        }
      ])

    if (error) {
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json(data)
  }

  return res.status(405).json({ error: 'Method not allowed' })
} 