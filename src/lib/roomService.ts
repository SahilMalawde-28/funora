import { supabase } from './supabase';

export const generateRoomCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export async function sendEmoji(roomId: string, emoji: string) {
  await supabase.from("emoji_events").insert({
    room_id: roomId,
    emoji
  });
}


export const createRoom = async (hostId: string) => {
  const code = generateRoomCode();
  const { data, error } = await supabase
    .from('rooms')
    .insert({
      code,
      host_id: hostId,
      status: 'lobby',
      game_state: {}
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const joinRoom = async (code: string, playerId: string, name: string, avatar: string) => {
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .maybeSingle();

  if (roomError || !room) throw new Error('Room not found');

  const { data: player, error: playerError } = await supabase
    .from('players')
    .insert({
      room_id: room.id,
      player_id: playerId,
      name,
      avatar,
      is_active: true
    })
    .select()
    .maybeSingle();

  if (playerError) throw playerError;

  return { room, player };
};

export const getRoom = async (roomId: string) => {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const getPlayers = async (roomId: string) => {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('room_id', roomId)
    .eq('is_active', true)
    .order('joined_at', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const updateRoomState = async (roomId: string, updates: any) => {
  const { error } = await supabase
    .from('rooms')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', roomId);

  if (error) throw error;
};

export const updatePlayerScore = async (playerId: string, score: number) => {
  const { error } = await supabase
    .from('players')
    .update({ score })
    .eq('id', playerId);

  if (error) throw error;
};
