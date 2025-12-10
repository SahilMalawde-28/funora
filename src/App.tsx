import { useState, useEffect, useCallback } from "react";
import { supabase, Room, Player } from "./lib/supabase";
import { createRoom, joinRoom, getPlayers, updateRoomState } from "./lib/roomService";

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
} from "./lib/gameLogic";

import Home from "./components/Home";
import Lobby from "./components/Lobby";
import ImposterGame from "./components/games/ImposterGame";
import BluffGame from "./components/games/BluffGame";
import TeamGame from "./components/games/TeamGame";
import WavelengthGame from "./components/games/WavelengthGame";
import WordGuessGame from "./components/games/WordGuessGame";
import ChainGame from "./components/games/ChainGame";
import BoilingGame from "./components/games/BoilingGame";
import MemoryGame from "./components/games/MemoryGame";
import HerdGame from "./components/games/HerdGame";
import ChameleonGame from "./components/games/ChameleonGame";
import CoupGame from "./components/games/CoupGame";

function App() {
  // =============================================
  // PROFILE LOADING
  // =============================================
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem("funora_profile");
    return saved ? JSON.parse(saved) : null;
  });

  // Create or sync profile with Supabase
  useEffect(() => {
    const ensureProfile = async () => {
      const local = localStorage.getItem("funora_profile");

      // CASE 1: Local exists
      if (local) {
        const parsed = JSON.parse(local);

        // Local exists but no Supabase ID → create a new DB entry
        if (!parsed.id) {
          const { data, error } = await supabase
            .from("profiles")
            .insert({
              name: parsed.name || "Player",
              avatar: parsed.avatar || "🙂",
              games_played: parsed.games_played || 0,
              wins: parsed.wins || 0,
              xp: parsed.xp || 0,
              favorite_game: parsed.favorite_game || null,
              last_game: parsed.last_game || null,
              emoji_used: parsed.emoji_used || 0,
            })
            .select()
            .single();

          if (!error && data) {
            localStorage.setItem("funora_profile", JSON.stringify(data));
            setProfile(data);
          }
        } else {
          // Already has DB ID → trust local
          setProfile(parsed);
        }
        return;
      }

      // CASE 2: No profile at all → create new one
      const { data, error } = await supabase
        .from("profiles")
        .insert({
          name: "Player",
          avatar: "🙂",
          games_played: 0,
          wins: 0,
          xp: 0,
          emoji_used: 0,
        })
        .select()
        .single();

      if (!error && data) {
        localStorage.setItem("funora_profile", JSON.stringify(data));
        setProfile(data);
      }
    };

    ensureProfile();
  }, []);

  // =============================================
  // UPDATE PROFILE STATS
  // =============================================
  const updateProfileStats = async (gameId: string, didWin: boolean = false) => {
  if (!profile) return;

  // Name dynamic keys
  const playedKey = `${gameId}_played`;
  const winKey = `${gameId}_wins`;

  const updated = {
    ...profile,

    // GLOBAL STATS
    xp: Number(profile.xp || 0) + 10,
    games_played: Number(profile.games_played || 0) + 1,
    wins: Number(profile.wins || 0) + (didWin ? 1 : 0),
    last_game: gameId,

    // PER-GAME STATS
    [playedKey]: Number(profile[playedKey] || 0) + 1,
    [winKey]: Number(profile[winKey] || 0) + (didWin ? 1 : 0),
  };

  // Save locally
  localStorage.setItem("funora_profile", JSON.stringify(updated));
  setProfile(updated);

  // Save in DB (only known fields → avoid column errors)
  if (profile.id) {
    await supabase
      .from("profiles")
      .update({
        xp: updated.xp,
        games_played: updated.games_played,
        wins: updated.wins,
        last_game: gameId,

        // spread only allowed columns
        [playedKey]: updated[playedKey],
        [winKey]: updated[winKey],
      })
      .eq("id", profile.id);
  }
};



  // =============================================
  // ROOM + PLAYER STATE
  // =============================================
  const [playerId] = useState(
    () => `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );

  const [room, setRoom] = useState<Room | null>(() => {
    const saved = localStorage.getItem("funora_room");
    return saved ? JSON.parse(saved) : null;
  });

  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(() => {
    const saved = localStorage.getItem("funora_player");
    return saved ? JSON.parse(saved) : null;
  });

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasPlayedGame, setHasPlayedGame] = useState(false);

  // =============================================
  // EMOJI THROWER SYSTEM
  // =============================================
  const [emojiEvents, setEmojiEvents] = useState<{ id: string; emoji: string }[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const EMOJI_LIST = ["😂", "💀", "😡", "😎", "😭", "🔥", "🤯", "✨", "🤡", "🙌", "🎉", "😱", "❤️", "🫡", "🧠"];

  const throwEmoji = async (emoji: string) => {
  if (!room) return;

  await supabase.from("emoji_events").insert({
    room_id: room.id,
    emoji,
  });

  // increase emoji_used count
  if (profile) {
    const updated = {
      ...profile,
      emoji_used: (profile.emoji_used || 0) + 1,
      last_seen: new Date().toISOString(),
    };

    localStorage.setItem("funora_profile", JSON.stringify(updated));
    setProfile(updated);

    await supabase
      .from("profiles")
      .update({
        emoji_used: updated.emoji_used,
        last_seen: updated.last_seen
      })
      .eq("id", profile.id);
  }

  setShowEmojiPicker(false);
};


  // =============================================
  // FRESH ROOM LOAD (fixes stale host)
  // =============================================
  useEffect(() => {
    const loadFresh = async () => {
      if (!room) return;

      const { data } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", room.id)
        .single();

      if (data) setRoom(data);
    };

    loadFresh();
  }, []);

  // =============================================
  // FETCH PLAYERS
  // =============================================
  const fetchPlayers = useCallback(async (roomId: string) => {
    const data = await getPlayers(roomId);
    setPlayers(data);
  }, []);

  // =============================================
  // LEAVE ROOM
  // =============================================
  const handleLeave = async () => {
    if (!room || !currentPlayer) return;

    await supabase.from("players").delete().eq("player_id", currentPlayer.player_id);

    if (currentPlayer.player_id === room.host_id) {
      const { data: remaining } = await supabase
        .from("players")
        .select("*")
        .eq("room_id", room.id);

      if (remaining?.length > 0) {
        await supabase.from("rooms").update({ host_id: remaining[0].player_id }).eq("id", room.id);
      }
    }

    setRoom(null);
    setCurrentPlayer(null);
    setPlayers([]);
    localStorage.removeItem("funora_room");
    localStorage.removeItem("funora_player");
  };

  // =============================================
  // REALTIME LISTENERS
  // =============================================
  useEffect(() => {
    if (!room?.id) return;
    fetchPlayers(room.id);

    const playersSub = supabase
      .channel(`players-${room.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_id=eq.${room.id}` }, async () => {
        const updated = await getPlayers(room.id);
        setPlayers(updated);

        if (currentPlayer && !updated.some((p) => p.player_id === currentPlayer.player_id)) {
          handleLeave();
        }
      })
      .subscribe();

    const roomSub = supabase
      .channel(`room-${room.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${room.id}` }, (payload) => {
        if (payload.new) setRoom(payload.new as Room);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(playersSub);
      supabase.removeChannel(roomSub);
    };
  }, [room?.id, currentPlayer]);

  // =============================================
  // EMOJI REALTIME LISTENER
  // =============================================
  useEffect(() => {
    if (!room?.id) return;

    const channel = supabase
      .channel(`emoji-${room.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "emoji_events", filter: `room_id=eq.${room.id}` },
        (payload) => {
          const emoji = payload.new.emoji;
          setEmojiEvents((prev) => [...prev, { id: payload.new.id, emoji }]);

          setTimeout(() => {
            setEmojiEvents((prev) => prev.filter((e) => e.id !== payload.new.id));
          }, 3000);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [room?.id]);

  // =============================================
  // CREATE ROOM
  // =============================================
  const handleCreateRoom = async (name: string, avatar: string) => {
    setLoading(true);
    const newRoom = await createRoom(playerId);
    const { player } = await joinRoom(newRoom.code, playerId, name, avatar);

    setRoom(newRoom);
    setCurrentPlayer(player);

    localStorage.setItem("funora_room", JSON.stringify(newRoom));
    localStorage.setItem("funora_player", JSON.stringify(player));

    await fetchPlayers(newRoom.id);
    setLoading(false);
  };

  // =============================================
  // JOIN ROOM
  // =============================================
  const handleJoinRoom = async (code: string, name: string, avatar: string) => {
    setLoading(true);
    const { room: joinedRoom, player } = await joinRoom(code, playerId, name, avatar);

    setRoom(joinedRoom);
    setCurrentPlayer(player);

    localStorage.setItem("funora_room", JSON.stringify(joinedRoom));
    localStorage.setItem("funora_player", JSON.stringify(player));

    await fetchPlayers(joinedRoom.id);
    setLoading(false);
  };

  // =============================================
  // START GAME
  // =============================================
  const handleStartGame = async (gameId: string) => {
    if (!room || !currentPlayer || currentPlayer.player_id !== room.host_id) return;

    const ids = players.map((p) => p.player_id);

    const map: any = {
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

  // =============================================
  // UPDATE GAME STATE
  // =============================================
  const handleUpdateGameState = async (updates: any) => {
    if (!room) return;

    await updateRoomState(room.id, {
      game_state: { ...room.game_state, ...updates },
    });
  };

  // =============================================
  // END GAME → UPDATE PROFILE STATS
  // =============================================
const handleEndGame = async (results?: Record<string, boolean>) => {
  if (!room) return;

  // If results exist → update stats
  if (results) {
    for (const pid of Object.keys(results)) {
      const didWin = results[pid];

      // Update ONLY stats for the player who is using this device
      if (profile && profile.id === pid) {
        await updateProfileStats(room.current_game!, didWin);
      }
    }
  }

  // Reset room (for everyone)
  await updateRoomState(room.id, {
    current_game: null,
    game_state: {},
    status: "lobby",
  });
};



  // =============================================
  // RENDER
  // =============================================
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!room || !currentPlayer) {
    return <Home onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} profile={profile} />;
  }

  return (
    <>
      {/* FLOATING EMOJI LAYER */}
      <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
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

      {/* EMOJI PICKER */}
      <>
        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="fixed bottom-6 right-6 bg-white rounded-full p-4 text-2xl shadow-xl hover:scale-110 transition z-[10000]"
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
          profile={profile}
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
            onGameFinished:{handleGameFinished},

            
          };

          switch (room.current_game) {
            case "imposter":
              return <ImposterGame {...props} />;
            case "bluff":
              return <BluffGame {...props} />;
            case "team":
              return <TeamGame {...props} />;
            case "wavelength":
              return <WavelengthGame {...props} />;
            case "wordguess":
              return <WordGuessGame {...props} />;
            case "chain":
              return <ChainGame {...props} />;
            case "boilingWater":
              return <BoilingGame {...props} />;
            case "memory":
              return <MemoryGame {...props} />;
            case "herd":
              return <HerdGame {...props} />;
            case "cham":
              return <ChameleonGame {...props} />;
            case "coup":
              return <CoupGame {...props} />;
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
