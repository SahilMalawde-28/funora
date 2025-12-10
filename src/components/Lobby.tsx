import { useState } from "react";
import { Users, Copy, Play, LogOut, RotateCw, Crown, Globe2, Lock } from "lucide-react";
import { Room, Player, supabase } from "../lib/supabase";
import { GAMES } from "../lib/gameLogic";

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
  hasPlayedGame,
}: LobbyProps) {
  const isHost = currentPlayer.player_id === room.host_id;

  // For player profile modal
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  // For room mode toggle loading
  const [modeUpdating, setModeUpdating] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(room.code);
    alert("Room code copied!");
  };

  const openPlayerProfile = (p: Player) => {
    setSelectedPlayer(p);
    setShowProfile(true);
  };

  const closeProfile = () => {
    setShowProfile(false);
    setSelectedPlayer(null);
  };

  const isPublic = room.mode === "public";

  const toggleRoomMode = async () => {
    if (!isHost) return;
    setModeUpdating(true);
    const newMode = isPublic ? "private" : "public";

    await supabase
      .from("rooms")
      .update({ flag: newMode })
      .eq("id", room.id);

    // We trust realtime to update room in App, but locally this
    // ensures instant UI feedback if needed.
    setModeUpdating(false);
  };

  return (
    <div className="w-full px-4 py-6">
      <div className="max-w-5xl mx-auto space-y-10">
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-600" />
            <div>
              <h1 className="text-3xl font-black text-gray-800">Lobby</h1>
              <p className="text-sm text-gray-500">Waiting for players to join…</p>
            </div>
          </div>

          <button
            onClick={onLeave}
            className="px-4 py-2 text-red-600 bg-red-50 rounded-xl hover:bg-red-100 flex items-center gap-2 font-semibold"
          >
            <LogOut className="w-4 h-4" /> Leave
          </button>
        </div>

        {/* ROOM CODE + MODE TOGGLE */}
        <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-500">Room Code</p>
            <p className="text-4xl font-black tracking-widest text-gray-800">{room.code}</p>
          </div>

          <div className="flex flex-col items-end gap-3">
            {/* Mode toggle (host only) */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                {isPublic ? (
                  <>
                    <Globe2 className="w-4 h-4 text-green-600" /> Public
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-gray-600" /> Private
                  </>
                )}
              </span>

              {isHost && (
                <button
                  disabled={modeUpdating}
                  onClick={toggleRoomMode}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    isPublic ? "bg-green-500" : "bg-gray-400"
                  } ${modeUpdating ? "opacity-60" : ""}`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                      isPublic ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              )}
            </div>

            <button
              onClick={copyCode}
              className="p-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 shadow transition"
            >
              <Copy className="w-6 h-6 text-indigo-600" />
            </button>
          </div>
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
                className={`flex items-center gap-3 p-4 rounded-xl border transition cursor-pointer
                  ${
                    p.player_id === currentPlayer.player_id
                      ? "border-indigo-400 bg-indigo-50/50"
                      : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                  }`}
                onClick={() => openPlayerProfile(p)}
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
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
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
                        ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed"
                        : "border-indigo-200 hover:border-indigo-500 hover:shadow-lg bg-white"
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

                  {!disabled && <Play className="w-6 h-6 text-indigo-600" />}
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

      {/* PLAYER PROFILE MODAL */}
      {showProfile && selectedPlayer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-gray-800">Player Profile</h3>
              <button
                onClick={closeProfile}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="text-center space-y-3">
              <div className="text-6xl">{selectedPlayer.avatar}</div>
              <div className="text-2xl font-black text-gray-800">
                {selectedPlayer.name}
              </div>
              {selectedPlayer.player_id === room.host_id && (
                <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
                  <Crown className="w-3 h-3" /> Host
                </div>
              )}
            </div>

            <p className="text-xs text-gray-500 text-center">
              Full cross-room stats coming soon — for now, profiles show name & avatar so you can see who&apos;s who.
            </p>

            <button
              onClick={closeProfile}
              className="w-full mt-2 py-3 bg-indigo-500 text-white rounded-xl font-bold hover:scale-105 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
