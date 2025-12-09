import { useState, useEffect, useCallback } from 'react';
import { supabase, Room, Player } from './lib/supabase';
import { createRoom, joinRoom, getPlayers, updateRoomState } from './lib/roomService';
import {
  initImposterGame,
  initBluffGame,
  initTeamGame,
  initWavelengthGame,
  initWordGuessGame,
  initChainGame,
  initBoilingWaterGame,
  initMemoryGameState,
  initHerdGame,
  initChameleonGame,
  initCoupGame,
} from './lib/gameLogic';

import Home from './components/Home';
import Lobby from './components/Lobby';
import ImposterGame from './components/games/ImposterGame';
import BluffGame from './components/games/BluffGame';
import TeamGame from './components/games/TeamGame';
import WavelengthGame from './components/games/WavelengthGame';
import WordGuessGame from './components/games/WordGuessGame';
import ChainGame from './components/games/ChainGame';
import BoilingGame from './components/games/BoilingGame';
import MemoryGame from './components/games/MemoryGame';
import HerdGame from './components/games/HerdGame';
import ChameleonGame from './components/games/ChameleonGame';
import CoupGame from './components/games/CoupGame';

function App() {

  // ======================
  // PROFILE LOADING
  // ======================
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem("funora_profile");
    return saved ? JSON.parse(saved) : null;
  });

  // ==================================================
  // UPDATE PROFILE STATS
  // ==================================================
  const updateProfileStats = (gameId: string, didWin: boolean = false) => {
    if (!profile) return;

    const updated = {
      ...profile,
      games_played: (profile.games_played || 0) + 1,
      wins: (profile.wins || 0) + (didWin ? 1 : 0),
      xp: (profile.xp || 0) + 10,               // give +10 xp per game
      last_game: gameId,
      favorite_game: profile.favorite_game || gameId,
    };

    setProfile(updated);
    localStorage.setItem("funora_profile", JSON.stringify(updated));

    // OPTIONAL: Save to Supabase
    /*
    await supabase.from("profiles").update(updated).eq("id", profile.id);
    */
  };

  // ======================
  // PLAYER + ROOM STATE
  // ======================
  const [playerId] = useState(
    () => `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );

  const [room, setRoom] = useState<Room | null>(() => {
    const saved = localStorage.getItem('funora_room');
    return saved ? JSON.parse(saved) : null;
  });

  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(() => {
    const saved = localStorage.getItem('funora_player');
    return saved ? JSON.parse(saved) : null;
  });

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasPlayedGame, setHasPlayedGame] = useState(false);

  // ==================================================
  // EMOJI THROWER SYSTEM
  // ==================================================
  const [emojiEvents, setEmojiEvents] = useState<{ id: string; emoji: string }[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const EMOJI_LIST = ["😂","💀","😡","😎","😭","🔥","🤯","✨","🤡","🙌","🎉","😱","❤️","🫡","🧠"];

  const throwEmoji = async (emoji: string) => {
    if (!room) return;

    await supabase.from("emoji_events").insert({
      room_id: room.id,
      emoji,
    });

    setShowEmojiPicker(false);
  };

  // ==================================================
  // LOAD REAL FRESH ROOM
  // ==================================================
  useEffect(() => {
    const loadFreshRoom = async () => {
      if (!room) return;

      const { data: fresh } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", room.id)
        .single();

      if (fresh) setRoom(fresh);
    };

    loadFreshRoom();
  }, []);

  // ==================================================
  // FETCH PLAYERS
  // ==================================================
  const fetchPlayers = useCallback(async (roomId: string) => {
    try {
      const data = await getPlayers(roomId);
      setPlayers(data);
    } catch (error) {
      console.error("Error fetching players:", error);
    }
  }, []);

  // ==================================================
  // LEAVE ROOM LOGIC
  // ==================================================
  const handleLeave = async () => {
    if (!room || !currentPlayer) return;

    await supabase.from("players").delete().eq("player_id", currentPlayer.player_id);

    if (currentPlayer.player_id === room.host_id) {
      const { data: remaining } = await supabase
        .from("players")
        .select("*")
        .eq("room_id", room.id);

      if (remaining && remaining.length > 0) {
        await supabase
          .from("rooms")
          .update({ host_id: remaining[0].player_id })
          .eq("id", room.id);
      }
    }

    setRoom(null);
    setCurrentPlayer(null);
    setPlayers([]);

    localStorage.removeItem("funora_room");
    localStorage.removeItem("funora_player");
  };

  // ==================================================
  // REALTIME LISTENERS
  // ==================================================
  useEffect(() => {
    if (!room?.id) return;

    fetchPlayers(room.id);

    const playersSubscription = supabase
      .channel(`players-room-${room.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_id=eq.${room.id}` },
        async (payload) => {
          const updated = await getPlayers(room.id);
          setPlayers(updated);

          if (currentPlayer && !updated.some(p => p.player_id === currentPlayer.player_id)) {
            handleLeave();
          }
        }
      )
      .subscribe();

    const roomSubscription = supabase
      .channel(`room-${room.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${room.id}` },
        (payload) => {
          if (payload.new) setRoom(payload.new as Room);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(playersSubscription);
      supabase.removeChannel(roomSubscription);
    };
  }, [room?.id, currentPlayer, fetchPlayers]);

  // ==================================================
  // EMOJI REALTIME LISTENER
  // ==================================================
  useEffect(() => {
    if (!room?.id) return;

    const channel = supabase
      .channel(`emoji-${room.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "emoji_events", filter: `room_id=eq.${room.id}` },
        (payload) => {
          const emoji = payload.new.emoji;

          setEmojiEvents(prev => [...prev, { id: payload.new.id, emoji }]);

          setTimeout(() => {
            setEmojiEvents(prev => prev.filter(e => e.id !== payload.new.id));
          }, 3000);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [room?.id]);

  // ==================================================
  // CREATE + JOIN ROOM
  // ==================================================
  const handleCreateRoom = async (name: string, avatar: string) => {
    setLoading(true);
    try {
      const newRoom = await createRoom(playerId);
      const { player } = await joinRoom(newRoom.code, playerId, name, avatar);

      setRoom(newRoom);
      setCurrentPlayer(player);
      localStorage.setItem("funora_room", JSON.stringify(newRoom));
      localStorage.setItem("funora_player", JSON.stringify(player));

      await fetchPlayers(newRoom.id);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (code: string, name: string, avatar: string) => {
    setLoading(true);
    try {
      const { room: joinedRoom, player } = await joinRoom(code, playerId, name, avatar);

      setRoom(joinedRoom);
      setCurrentPlayer(player);
      localStorage.setItem("funora_room", JSON.stringify(joinedRoom));
      localStorage.setItem("funora_player", JSON.stringify(player));

      await fetchPlayers(joinedRoom.id);
    } finally {
      setLoading(false);
    }
  };

  // ==================================================
  // GAME START + STATE UPDATE
  // ==================================================
  const handleStartGame = async (gameId: string) => {
    if (!room || !currentPlayer || currentPlayer.player_id !== room.host_id) return;

    const ids = players.map(p => p.player_id);
    const map: Record<string, any> = {
      imposter: initImposterGame,
      bluff: initBluffGame,
      team: initTeamGame,
      wavelength: initWavelengthGame,
      wordguess: initWordGuessGame,
      chain: initChainGame,
      boilingWater: initBoilingWaterGame,
      memory: initMemoryGameState,
      herd: initHerdGame,
      cham: initChameleonGame,
      coup: initCoupGame,
    };

    const gameState = map[gameId]?.(ids);
    if (!gameState) return;

    setHasPlayedGame(true);

    await updateRoomState(room.id, {
      current_game: gameId,
      game_state: gameState,
      status: "playing",
    });
  };

  const handleUpdateGameState = async (updates: any) => {
    if (!room) return;
    await updateRoomState(room.id, {
      game_state: { ...room.game_state, ...updates },
    });
  };

  const handleEndGame = async () => {
    if (!room) return;

    // ⭐⭐ UPDATE PROFILE STATS WHEN A GAME ENDS ⭐⭐
    updateProfileStats(room.current_game!, false);

    await updateRoomState(room.id, {
      current_game: null,
      game_state: {},
      status: "lobby",
    });
  };

  // ==================================================
  // RENDER UI
  // ==================================================
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!room || !currentPlayer) {
    return <Home onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />;
  }

  // ==================================================
  // MAIN RETURN
  // ==================================================
  return (
    <>
      {/* FLOATING EMOJI LAYER */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-[9999]">
        {emojiEvents.map((e) => (
          <div
            key={e.id}
            className="absolute text-5xl animate-floating-emoji"
            style={{ left: Math.random() * 80 + "%", top: "100%" }}
          >
            {e.emoji}
          </div>
        ))}
      </div>

      {/* EMOJI BUTTON */}
      <>
        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="fixed bottom-6 right-6 bg-white shadow-xl rounded-full p-4 text-2xl hover:scale-110 transition z-[10000]"
        >
          🎉
        </button>

        {showEmojiPicker && (
          <div className="fixed bottom-20 right-6 bg-white p-4 rounded-2xl shadow-xl grid grid-cols-5 gap-3 z-[10000]">
            {EMOJI_LIST.map((em) => (
              <button
                key={em}
                onClick={() => throwEmoji(em)}
                className="text-3xl hover:scale-125 transition"
              >
                {em}
              </button>
            ))}
          </div>
        )}
      </>

      {/* GAME OR LOBBY */}
      {room.status === "lobby" || !room.current_game ? (
        <Lobby
          room={room}
          players={players}
          currentPlayer={currentPlayer}
          onStartGame={handleStartGame}
          onLeave={handleLeave}
          hasPlayedGame={hasPlayedGame}
        />
      ) : (
        (() => {
          const props = {
            room,
            players,
            currentPlayer,
            gameState: room.game_state,
            onUpdateState: handleUpdateGameState,
            onEndGame: handleEndGame,
          };

          switch (room.current_game) {
            case "imposter": return <ImposterGame {...props} />;
            case "bluff": return <BluffGame {...props} />;
            case "team": return <TeamGame {...props} />;
            case "wavelength": return <WavelengthGame {...props} />;
            case "wordguess": return <WordGuessGame {...props} />;
            case "chain": return <ChainGame {...props} />;
            case "boilingWater": return <BoilingGame {...props} />;
            case "memory": return <MemoryGame {...props} />;
            case "herd": return <HerdGame {...props} />;
            case "cham": return <ChameleonGame {...props} />;
            case "coup": return <CoupGame {...props} />;
            default:
              return (
                <Lobby
                  room={room}
                  players={players}
                  currentPlayer={currentPlayer}
                  onStartGame={handleStartGame}
                  onLeave={handleLeave}
                  hasPlayedGame={hasPlayedGame}
                />
              );
          }
        })()
      )}
    </>
  );
}

export default App;
