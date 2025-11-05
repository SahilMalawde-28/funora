import { Users, Copy, Play, LogOut, RotateCw } from 'lucide-react';
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

export default function Lobby({ room, players, currentPlayer, onStartGame, onLeave, hasPlayedGame }: LobbyProps) {
  const isHost = currentPlayer.player_id === room.host_id;

  const copyCode = () => {
    navigator.clipboard.writeText(room.code);
    alert('Room code copied!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6 py-8">
        <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-500" />
              <div>
                <h1 className="text-3xl font-black text-gray-800">Game Lobby</h1>
                <p className="text-gray-500">Waiting for players...</p>
              </div>
            </div>
            <button
              onClick={onLeave}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors font-semibold"
            >
              <LogOut className="w-4 h-4" />
              Leave
            </button>
          </div>

          <div className="flex items-center justify-center gap-4 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-2xl p-6">
            <div>
              <p className="text-sm text-gray-600 font-semibold mb-1">Room Code</p>
              <p className="text-4xl font-black text-gray-800 tracking-widest">{room.code}</p>
            </div>
            <button
              onClick={copyCode}
              className="p-3 bg-white rounded-xl hover:bg-gray-50 transition-colors shadow-lg"
            >
              <Copy className="w-6 h-6 text-blue-500" />
            </button>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Players ({players.length})
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {players.map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center gap-3 p-4 rounded-xl transition-all ${
                    player.player_id === currentPlayer.player_id
                      ? 'bg-gradient-to-r from-blue-100 to-cyan-100 ring-2 ring-blue-500'
                      : 'bg-gray-50'
                  }`}
                >
                  <span className="text-3xl">{player.avatar}</span>
                  <div className="flex-1">
                    <p className="font-bold text-gray-800">{player.name}</p>
                    {player.player_id === room.host_id && (
                      <p className="text-xs text-blue-600 font-semibold">HOST</p>
                    )}
                  </div>
                  {player.is_active && (
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-gray-800">Choose a Game</h2>
            {hasPlayedGame && (
              <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-700 font-bold flex items-center gap-1">
                <RotateCw className="w-3 h-3" />
                Play Again
              </span>
            )}
          </div>

          <div className="grid gap-4">
            {GAMES.map((game) => (
              <button
                key={game.id}
                onClick={() => isHost && onStartGame(game.id)}
                disabled={!isHost || players.length < game.minPlayers}
                className={`text-left p-6 rounded-2xl border-2 transition-all ${
                  isHost && players.length >= game.minPlayers
                    ? 'border-blue-200 hover:border-blue-500 hover:shadow-lg bg-gradient-to-r from-white to-blue-50 cursor-pointer'
                    : 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="text-4xl">{game.emoji}</span>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-800 mb-1">{game.name}</h3>
                    <p className="text-sm text-gray-600">{game.description}</p>
                    <p className="text-xs text-gray-500 mt-2">Min {game.minPlayers} players</p>
                  </div>
                  {isHost && players.length >= game.minPlayers && (
                    <Play className="w-6 h-6 text-blue-500" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {!isHost && (
            <p className="text-center text-gray-500 text-sm font-medium">
              Waiting for host to start the game...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
