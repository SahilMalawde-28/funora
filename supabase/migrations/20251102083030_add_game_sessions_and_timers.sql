/*
  # Enhance Funora Schema for Persistent Game Sessions

  ## Changes
  - Add game_round table to track rounds and timers server-side
  - Add game_session table to store completed games for replay functionality
  - Add columns for persistent timer tracking
  - Track player progress within rounds

  ## New Tables

  ### `game_sessions`
  Stores completed game sessions for "play again" functionality
  - `id` (uuid, primary key)
  - `room_id` (uuid, foreign key)
  - `game_type` (text) - Type of game played
  - `completed_at` (timestamptz)

  ### `game_rounds`
  Tracks rounds with server-side timers
  - `id` (uuid, primary key)
  - `room_id` (uuid, foreign key)
  - `game_type` (text)
  - `round_number` (integer)
  - `phase` (text) - current phase
  - `timer_end_at` (timestamptz) - when timer expires server-side
  - `round_state` (jsonb) - round-specific data
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
*/

CREATE TABLE IF NOT EXISTS game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  game_type text NOT NULL,
  completed_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  game_type text NOT NULL,
  round_number integer NOT NULL,
  phase text NOT NULL,
  timer_end_at timestamptz,
  round_state jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_room ON game_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_game_rounds_room ON game_rounds(room_id);
CREATE INDEX IF NOT EXISTS idx_game_rounds_timer ON game_rounds(timer_end_at);

ALTER TABLE game_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view game sessions"
  ON game_sessions FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can create game sessions"
  ON game_sessions FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can view game rounds"
  ON game_rounds FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can create game rounds"
  ON game_rounds FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update game rounds"
  ON game_rounds FOR UPDATE
  TO public
  USING (true);