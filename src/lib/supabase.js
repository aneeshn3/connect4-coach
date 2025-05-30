import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://onvyehpfjjuhbkkpnekp.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9udnllaHBmamp1aGJra3BuZWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5NzI1OTgsImV4cCI6MjA2MzU0ODU5OH0.A8dlRTV2IaU4K08axbF3BVSmv7CLTF5-Nb0yjl0i3OY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
