import { Users, Copy, Play, LogOut, RotateCw, Crown } from 'lucide-react';
import { Room, Player } from '../lib/supabase';
import { GAMES } from '../lib/gameLogic';

interface LobbyProps {
  room: Room;
  players: Player[];
  currentPlayer: Player;
  onStartGame: (gameId: string) => void;
  onLeave: () => void;
  hasPlayedGame?: boolean;
}

export default function Lobby({
  room,
  players,
  currentPlayer,
  onStartGame,
  onLeave,
  hasPlayedGame
}: LobbyProps) {
  const isHost = currentPlayer.player_id === room.host_id;

  const copyCode = () => {
    navigator.clipboard.writeText(room.code);
    alert('Room code copied!');
  };

  return (
    <div className="w-full px-4 py-6">
      <div className="max-w-5xl mx-auto space-y-10">

        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-600" />
            <div>
              <h1 className="text-3xl font-black text-gray-800">
                Lobby
              </h1>
              <p className="text-sm text-gray-500">
                Waiting for players to join…
              </p>
            </div>
          </div>

          <button
            onClick={onLeave}
            className="px-4 py-2 text-red-600 bg-red-50 rounded-xl hover:bg-red-100 flex items-center gap-2 font-semibold"
          >
            <LogOut className="w-4 h-4" /> Leave
          </button>
        </div>

        {/* ROOM CODE */}
        <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-500">Room Code</p>
            <p className="text-4xl font-black tracking-widest text-gray-800">{room.code}</p>
          </div>

          <button
            onClick={copyCode}
            className="p-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 shadow transition"
          >
            <Copy className="w-6 h-6 text-indigo-600" />
          </button>
        </div>

        {/* PLAYERS GRID */}
        <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-200">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Players ({players.length})
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {players.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-3 p-4 rounded-xl border transition
                  ${
                    p.player_id === currentPlayer.player_id
                      ? 'border-indigo-400 bg-indigo-50/50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
              >
                <div className="text-3xl">{p.avatar}</div>

                <div className="flex-1">
                  <p className="font-bold text-gray-800">{p.name}</p>

                  {p.player_id === room.host_id && (
                    <p className="text-xs text-indigo-600 font-semibold flex items-center gap-1">
                      <Crown className="w-3 h-3" /> HOST
                    </p>
                  )}
                </div>

                {p.is_active && (
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* GAME SELECTOR */}
        <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-black text-gray-800">Choose a Game</h2>
            {hasPlayedGame && (
              <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-700 font-bold flex items-center gap-1">
                <RotateCw className="w-3 h-3" />
                Play Again
              </span>
            )}
          </div>

          <div className="grid gap-4">
            {GAMES.map((game) => {
              const disabled = players.length < game.minPlayers || !isHost;
              return (
                <button
                  key={game.id}
                  disabled={disabled}
                  onClick={() => !disabled && onStartGame(game.id)}
                  className={`p-5 rounded-2xl border-2 text-left transition-all flex items-center gap-4
                    ${
                      disabled
                        ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                        : 'border-indigo-200 hover:border-indigo-500 hover:shadow-lg bg-white'
                    }
                  `}
                >
                  <div className="text-4xl">{game.emoji}</div>

                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800">{game.name}</h3>
                    <p className="text-xs text-gray-500">{game.description}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Min {game.minPlayers} players
                    </p>
                  </div>

                  {!disabled && (
                    <Play className="w-6 h-6 text-indigo-600" />
                  )}
                </button>
              );
            })}
          </div>

          {!isHost && (
            <p className="text-center text-gray-500 text-sm mt-4 font-medium">
              Waiting for host to start a game…
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
