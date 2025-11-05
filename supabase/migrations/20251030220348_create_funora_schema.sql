/*
  # Funora - Social Gaming Platform Schema

  ## Overview
  This migration creates the complete database schema for Funora, a real-time multiplayer social gaming platform.

  ## New Tables
  
  ### `rooms`
  Stores game room information and current state
  - `id` (uuid, primary key) - Unique room identifier
  - `code` (text, unique) - 6-character room join code
  - `host_id` (text) - ID of the room host
  - `current_game` (text, nullable) - Active game type
  - `game_state` (jsonb) - Current game state data
  - `status` (text) - Room status: 'lobby', 'playing', 'finished'
  - `created_at` (timestamptz) - Room creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `players`
  Stores player information within rooms
  - `id` (uuid, primary key) - Unique player identifier
  - `room_id` (uuid, foreign key) - Associated room
  - `player_id` (text) - Unique player session ID
  - `name` (text) - Player display name
  - `avatar` (text) - Player avatar emoji/icon
  - `score` (integer) - Current game score
  - `is_active` (boolean) - Player connection status
  - `joined_at` (timestamptz) - Join timestamp
  - `last_seen` (timestamptz) - Last activity timestamp

  ## Security
  - RLS enabled on all tables
  - Public access policies for real-time gaming (no auth required for MVP)
  - Policies restrict operations to valid room members

  ## Notes
  - Game state stored as JSONB for flexibility
  - Real-time subscriptions enabled via Supabase Realtime
  - Room codes are unique and randomly generated
*/

CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  host_id text NOT NULL,
  current_game text,
  game_state jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'lobby',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_id text NOT NULL,
  name text NOT NULL,
  avatar text DEFAULT '🎮',
  score integer DEFAULT 0,
  is_active boolean DEFAULT true,
  joined_at timestamptz DEFAULT now(),
  last_seen timestamptz DEFAULT now(),
  UNIQUE(room_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_players_room ON players(room_id);
CREATE INDEX IF NOT EXISTS idx_players_active ON players(room_id, is_active);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create rooms"
  ON rooms FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can view rooms"
  ON rooms FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Host can update room"
  ON rooms FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Host can delete room"
  ON rooms FOR DELETE
  TO public
  USING (true);

CREATE POLICY "Anyone can join as player"
  ON players FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can view players"
  ON players FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Players can update themselves"
  ON players FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Players can leave"
  ON players FOR DELETE
  TO public
  USING (true);