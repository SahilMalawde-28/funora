import { useState, useEffect, useCallback } from 'react';
import { supabase, Room, Player } from './lib/supabase';
import { createRoom, joinRoom, getPlayers, updateRoomState } from './lib/roomService';
import { initImposterGame, initBluffGame, initTeamGame, initWavelengthGame, initWordGuessGame, initChainGame, initBoilingWaterGame,initUnoGame,initMemoryGameState,initHerdGame } from './lib/gameLogic';
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


function App() {
  const [playerId] = useState(() => `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
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

  const fetchPlayers = useCallback(async (roomId: string) => {
    try {
      const data = await getPlayers(roomId);
      setPlayers(data);
    } catch (error) {
      console.error('Error fetching players:', error);
    }
  }, []);

  // ✅ Realtime updates for rooms + players
  useEffect(() => {
    if (!room?.id) return;

    // Initial load
    fetchPlayers(room.id);

    // 🔥 Subscribe to players joining/leaving (Bolt Supabase style)
    const playersSubscription = supabase
      .channel(`players-room-${room.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${room.id}`,
        },
        async () => {
          await fetchPlayers(room.id);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log('Listening to player changes...');
      });

    // 🔥 Subscribe to room updates (e.g., game start or end)
    const roomSubscription = supabase
      .channel(`room-${room.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          if (payload.new) setRoom(payload.new as Room);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(playersSubscription);
      supabase.removeChannel(roomSubscription);
    };
  }, [room?.id, fetchPlayers]);

  // Ensures refetch if new room is created or joined
  useEffect(() => {
    if (room?.id) fetchPlayers(room.id);
  }, [room?.id, fetchPlayers]);

  const handleCreateRoom = async (name: string, avatar: string) => {
    setLoading(true);
    try {
      const newRoom = await createRoom(playerId);
      const { player } = await joinRoom(newRoom.code, playerId, name, avatar);
      setRoom(newRoom);
      setCurrentPlayer(player);
      localStorage.setItem('funora_room', JSON.stringify(newRoom));
      localStorage.setItem('funora_player', JSON.stringify(player));
      await fetchPlayers(newRoom.id);
    } catch (error) {
      console.error('Error creating room:', error);
      alert('Failed to create room');
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
      localStorage.setItem('funora_room', JSON.stringify(joinedRoom));
      localStorage.setItem('funora_player', JSON.stringify(player));
      await fetchPlayers(joinedRoom.id);
    } catch (error) {
      console.error('Error joining room:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleStartGame = async (gameId: string) => {
    if (!room || !currentPlayer || currentPlayer.player_id !== room.host_id) return;

    const playerIds = players.map(p => p.player_id);
    let gameState;

    switch (gameId) {
      case 'imposter':
        gameState = initImposterGame(playerIds);
        break;
      case 'bluff':
        gameState = initBluffGame(playerIds);
        break;
      case 'team':
        gameState = initTeamGame(playerIds);
        break;
      case 'wavelength':
        gameState = initWavelengthGame(playerIds);
        break;
      case 'wordguess':
        gameState = initWordGuessGame(playerIds);
        break;
      case 'chain':
        gameState = initChainGame(playerIds);
        break;
      case 'boilingWater':
        gameState = initBoilingWaterGame(playerIds);
        break;
      case 'memory':
        gameState = initMemoryGameState(playerIds);
        break;
        case 'herd':
        gameState = initHerdGame(playerIds);
        break;
      default:
        return;
    }
    setHasPlayedGame(true);

    await updateRoomState(room.id, {
      current_game: gameId,
      game_state: gameState,
      status: 'playing',
    });
  };

  const handleUpdateGameState = async (updates: any) => {
    if (!room) return;
    const newGameState = { ...room.game_state, ...updates };
    await updateRoomState(room.id, { game_state: newGameState });
  };

  const handleEndGame = async () => {
    if (!room) return;
    await updateRoomState(room.id, {
      current_game: null,
      game_state: {},
      status: 'lobby',
    });
  };

  const handleLeave = () => {
    setRoom(null);
    setCurrentPlayer(null);
    setPlayers([]);
    setHasPlayedGame(false);
    localStorage.removeItem('funora_room');
    localStorage.removeItem('funora_player');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  if (!room || !currentPlayer) {
    return <Home onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />;
  }

  if (room.status === 'lobby' || !room.current_game) {
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

  const gameProps = {
    room,
    players,
    currentPlayer,
    gameState: room.game_state,
    onUpdateState: handleUpdateGameState,
    onEndGame: handleEndGame,
  };

  switch (room.current_game) {
    case 'imposter':
      return <ImposterGame {...gameProps} />;
    case 'bluff':
      return <BluffGame {...gameProps} />;
    case 'team':
      return <TeamGame {...gameProps} />;
    case 'wavelength':
      return <WavelengthGame {...gameProps} />;
    case 'wordguess':
      return <WordGuessGame {...gameProps} />;
    case 'chain':
      return <ChainGame {...gameProps} />;
    case 'boilingWater':                      // ✅ NEW
      return <BoilingGame {...gameProps} />;
    case 'memory':                      // ✅ NEW
      return <MemoryGame {...gameProps} />;
    case 'herd':                      // ✅ NEW
      return <HerdGame {...gameProps} />;
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
}

export default App;
