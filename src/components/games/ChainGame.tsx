import { useState, useEffect } from "react";
import { Room, Player } from "../../lib/supabase";
import { ChainGameState } from "../../lib/gameLogic";
import { Zap, Trophy, X } from "lucide-react";

interface ChainGameProps {
  room: Room;
  players: Player[];
  currentPlayer: Player;
  gameState: ChainGameState;
  onUpdateState: (newState: Partial<ChainGameState>) => void;
  onEndGame: () => void;
}

export default function ChainGame({
  room,
  players,
  currentPlayer,
  gameState,
  onUpdateState,
  onEndGame
}: ChainGameProps) {
  const [answer, setAnswer] = useState("");
  const [timeLeft, setTimeLeft] = useState(gameState.timePerAnswer);

  const currentPlayerId = gameState.activePlayers[gameState.currentPlayerIdx];
  const isMyTurn = currentPlayerId === currentPlayer.player_id;

  const currentPlayerObj = players.find(p => p.player_id === currentPlayerId);

  const chain = gameState.chain || [];

  // -------------------------
  // TIMER HANDLING
  // -------------------------
  useEffect(() => {
    if (!isMyTurn || gameState.phase !== "answering") return;

    setTimeLeft(gameState.timePerAnswer);

    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer);
          eliminatePlayer(currentPlayerId, "timeout");
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isMyTurn, gameState.phase, gameState.currentPlayerIdx]);

  // -------------------------
  // ELIMINATION LOGIC
  // -------------------------
 const eliminatePlayer = (pid: string, reason: string) => {
  // Remove eliminated player
  const newActive = gameState.activePlayers.filter(id => id !== pid);

  // If only 1 survivor → game ends
  if (newActive.length <= 1) {
    onUpdateState({
      activePlayers: newActive,
      phase: "reveal"
    });
    return;
  }

  // Fix turn order
  let nextIdx = gameState.currentPlayerIdx;

  // Case 1: eliminated player WAS the current turn holder → shift turn safely
  if (pid === currentPlayerId) {
    if (nextIdx >= newActive.length) nextIdx = 0;
  }

  // Case 2: eliminated someone else → recalc index of current turn holder
  else {
    nextIdx = newActive.indexOf(currentPlayerId);
    if (nextIdx === -1) nextIdx = 0; // safety
  }

  onUpdateState({
    activePlayers: newActive,
    currentPlayerIdx: nextIdx
  });
};


  // -------------------------
  // VALIDATIONS
  // -------------------------

  const isDuplicate = (word: string) => {
    return chain.some(item => item.answer.toLowerCase() === word.toLowerCase());
  };

  const handleSubmitAnswer = () => {
    if (!answer.trim()) return;

    const trimmed = answer.trim();

    if (isDuplicate(trimmed)) {
      eliminatePlayer(currentPlayerId, "duplicate");
      return;
    }

    const updatedChain = [
      ...chain,
      { playerId: currentPlayerId, answer: trimmed }
    ];

    let nextIdx =
      (gameState.currentPlayerIdx + 1) % gameState.activePlayers.length;

    onUpdateState({
      chain: updatedChain,
      currentPlayerIdx: nextIdx
    });

    setAnswer("");
    setTimeLeft(gameState.timePerAnswer);
  };

  // -------------------------
  // UI — ANSWERING PHASE
  // -------------------------
  if (gameState.phase === "answering") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-pink-50 p-6">
        <div className="max-w-4xl mx-auto space-y-6 py-8">

          {/* CHAIN AT TOP */}
          <div className="bg-white rounded-3xl shadow p-4 border border-red-200">
            <h2 className="text-sm font-bold mb-2 text-red-600">Chain So Far</h2>
            {chain.length === 0 ? (
              <p className="text-xs text-gray-500 italic">No answers yet…</p>
            ) : (
              <div className="flex flex-wrap gap-2 items-center">
                {chain.map((entry, idx) => {
                  const pl = players.find(p => p.player_id === entry.playerId);
                  return (
                    <div key={idx} className="flex items-center gap-1">
                      <span className="text-xl">{pl?.avatar}</span>
                      <span className="px-3 py-1 bg-red-100 border border-red-300 text-red-800 text-sm rounded-full font-bold">
                        {entry.answer}
                      </span>
                      {idx < chain.length - 1 && (
                        <span className="text-red-600 font-bold">→</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* MAIN CARD */}
          <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
            <div className="text-center">
              <Zap className="w-12 h-12 text-red-600 mx-auto mb-3" />
              <h1 className="text-3xl font-black text-gray-800 mb-2">
                ⚡ Chain Rapid Fire
              </h1>
              <p className="text-gray-600">
                Topic:{" "}
                <span className="text-lg font-bold text-red-600">
                  {gameState.topic}
                </span>
              </p>
            </div>

            {isMyTurn ? (
              <>
                <div className="p-6 rounded-2xl bg-gradient-to-r from-red-100 to-pink-100 border-2 border-red-300 animate-pulse">
                  <p className="text-center text-sm text-red-700 font-bold mb-1">
                    🎯 YOUR TURN
                  </p>
                  <p className="text-center text-3xl font-black text-gray-900">
                    Name a <span className="text-red-600">{gameState.topic}</span>
                  </p>
                </div>

                <div className="flex items-center gap-4 mt-4">
                  <div className="text-3xl font-black text-red-600">
                    {timeLeft}s
                  </div>
                  <div className="flex-1 bg-gray-200 h-4 rounded-full overflow-hidden">
                    <div
                      className="h-4 bg-gradient-to-r from-red-500 to-pink-500 transition-all duration-1000"
                      style={{
                        width: `${(timeLeft / gameState.timePerAnswer) * 100}%`
                      }}
                    ></div>
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  <input
                    type="text"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Type your answer..."
                    className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-red-500 outline-none text-lg font-bold"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleSubmitAnswer()}
                  />
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={!answer.trim()}
                    className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-bold hover:scale-105 transition disabled:opacity-50"
                  >
                    Submit
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center p-8 bg-gray-50 rounded-2xl">
                <div className="flex justify-center items-center gap-3">
                  <span className="text-4xl">{currentPlayerObj?.avatar}</span>
                  <div>
                    <p className="text-lg font-bold">{currentPlayerObj?.name}</p>
                    <p className="text-sm text-gray-500">is answering…</p>
                  </div>
                </div>

                <div className="text-3xl font-black text-red-600 mt-6 animate-pulse">
                  {timeLeft}s
                </div>
              </div>
            )}

            {/* ACTIVE PLAYERS */}
            <div>
              <h3 className="text-lg font-bold mb-3">
                Active Players ({gameState.activePlayers.length})
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {gameState.activePlayers.map(pid => {
                  const pl = players.find(p => p.player_id === pid);
                  const active = pid === currentPlayerId;
                  return (
                    <div
                      key={pid}
                      className={`p-3 rounded-xl border-2 flex items-center justify-between ${
                        active
                          ? "bg-red-100 border-red-300"
                          : "bg-gray-100 border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{pl?.avatar}</span>
                        <span className="font-bold">{pl?.name}</span>
                      </div>

                      {/* Host can eliminate */}
                      {room.host_id === currentPlayer.player_id && !active && (
                        <button
                          onClick={() => eliminatePlayer(pid, "host")}
                          className="p-1 hover:bg-red-200 rounded-lg"
                        >
                          <X className="w-4 h-4 text-red-600" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // -------------------------
  // REVEAL SCREEN
  // -------------------------
  if (gameState.phase === "reveal") {
    const winnerId = gameState.activePlayers[0];
    const winner = players.find(p => p.player_id === winnerId);

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-pink-50 p-6">
        <div className="bg-white p-10 rounded-3xl shadow-2xl text-center max-w-lg">

          <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-4xl font-black mb-4">🏆 Winner!</h1>

          {winner ? (
            <div className="p-6 bg-yellow-100 rounded-2xl border border-yellow-400">
              <p className="text-yellow-800 font-bold text-sm mb-2">Final Survivor</p>
              <div className="flex justify-center items-center gap-3">
                <span className="text-5xl">{winner.avatar}</span>
                <span className="text-3xl font-black">{winner.name}</span>
              </div>
            </div>
          ) : (
            <p>No one survived 😅</p>
          )}

          <button
            onClick={onEndGame}
            className="w-full mt-8 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-bold hover:scale-105 transition"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  return <div>Loading…</div>;
}
