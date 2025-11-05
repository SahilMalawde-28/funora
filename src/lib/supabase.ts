import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Room {
  id: string;
  code: string;
  host_id: string;
  current_game: string | null;
  game_state: any;
  status: 'lobby' | 'playing' | 'finished';
  created_at: string;
  updated_at: string;
}

export interface Player {
  id: string;
  room_id: string;
  player_id: string;
  name: string;
  avatar: string;
  score: number;
  is_active: boolean;
  joined_at: string;
  last_seen: string;
}
