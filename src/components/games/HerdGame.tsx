import { useEffect, useState } from "react";
import { Room, Player } from "../../lib/supabase";
import { HerdGameState, initHerdGame, herdSubmitAnswer, herdEvaluateRound } from "../../lib/gameLogic";
import { Users, Cow, Trophy } from "lucide-react";

interface HerdGameProps {
  room: Room;
  players: Player[];
  currentPlayer: Player;
  gameState: HerdGameState;
  onUpdateState: (newState: Partial<HerdGameState>) => void;
  onEndGame: () => void;
}

export default function HerdGame({
  room,
  players,
  currentPlayer,
  gameState,
  onUpdateState,
  onEndGame,
}: HerdGameProps) {
  const [answer, setAnswer] = useState("");
  const [phase, setPhase] = useState(gameState.phase);

  const me = gameState.players.find(p => p.id === currentPlayer.player_id);
  const hasAnswered = !!me?.answer;
  const allAnswered = gameState.players.every(p => p.answer);

  useEffect(() => {
    setPhase(gameState.phase);
  }, [gameState.phase]);

  const handleSubmit = () => {
    if (!answer.trim() || hasAnswered) return;
    const newState = herdSubmitAnswer(gameState, currentPlayer.player_id, answer);
    onUpdateState(newState);
  };

  const handleHostNext = () => {
    const newState = herdEvaluateRound(gameState);
    onUpdateState(newState);
  };

  const activePlayers = gameState.players.filter(p => p.score > -6);

  if (gameState.phase === "ended") {
    const survivors = gameState.players.filter(p => p.score > -6);
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-yellow-50 p-6 text-center">
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl shadow-xl">
          <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
          <h1 className="text-3xl font-black mb-4">🐄 Herd Mentality Results</h1>
          <p className="text-lg text-gray-700 mb-4">
            {survivors.length > 0 ? (
              <>Winner: <b>{survivors.map(s => s.name).join(", ")}</b></>
            ) : (
              "Everyone got -6... The herd scattered! 😅"
            )}
          </p>
          <button
            onClick={onEndGame}
            className="mt-4 w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 rounded-xl font-bold text-lg shadow hover:scale-105 transition-all"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-yellow-50 p-6">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-3xl shadow-xl space-y-6">
        <div className="text-center">
          <Cow className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <h1 className="text-3xl font-black text-gray-800 mb-2">🐄 Herd Mentality</h1>
          <p className="text-gray-600">Think like the herd, not the nerd! 😜</p>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-r from-green-100 to-yellow-100 border-2 border-green-300">
          <p className="text-sm font-bold text-green-700 mb-2 text-center">
            CATEGORY
          </p>
          <p className="text-2xl font-bold text-gray-900 text-center">{gameState.category}</p>
        </div>

        {phase === "answering" && (
          <>
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer..."
              className="w-full p-4 border-2 border-gray-300 rounded-xl text-lg focus:border-green-500"
              disabled={hasAnswered}
            />
            <button
              onClick={handleSubmit}
              disabled={!answer.trim() || hasAnswered}
              className="w-full bg-gradient-to-r from-green-500 to-teal-500 text-white py-3 rounded-xl font-bold text-lg shadow hover:shadow-lg transition-all disabled:opacity-60"
            >
              {hasAnswered ? "✅ Answer Submitted" : "Submit Answer"}
            </button>

            <p className="text-center text-sm text-gray-500">
              {gameState.players.filter(p => p.answer).length}/{players.length} players answered
            </p>

            {currentPlayer.player_id === room.host_id && allAnswered && (
              <button
                onClick={handleHostNext}
                className="mt-4 w-full bg-gradient-to-r from-orange-500 to-pink-500 text-white py-3 rounded-xl font-bold shadow hover:scale-105 transition-all"
              >
                Continue ➜ Reveal Round
              </button>
            )}
          </>
        )}

        {phase === "reveal" && (
          <>
            <div className="space-y-4">
              {gameState.lastResult && (
                <div className="p-4 bg-yellow-50 border-2 border-yellow-300 rounded-xl text-center">
                  <p className="text-lg font-semibold text-gray-700 mb-2">Round Results 🐮</p>
                  <p className="text-sm text-gray-600">
                    Majority answers:{" "}
                    <b>{gameState.lastResult.majorityAnswers?.join(", ") || "None"}</b>
                  </p>
                  {Object.entries(gameState.lastResult.penalties || {}).map(([id, pen]) => {
                    const player = players.find(p => p.player_id === id);
                    return (
                      <p key={id} className="text-gray-600">
                        {player?.name}: {pen} point
                      </p>
                    );
                  })}
                </div>
              )}
              <h2 className="text-center text-lg font-bold text-gray-800 mt-4">
                Scores
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {gameState.players.map(p => (
                  <div key={p.id} className="p-3 border rounded-xl text-center">
                    <p className="font-semibold">{p.name}</p>
                    <p className={`text-lg font-bold ${p.score <= -3 ? "text-red-500" : "text-green-600"}`}>
                      {p.score}
                    </p>
                  </div>
                ))}
              </div>
              {currentPlayer.player_id === room.host_id && (
                <button
                  onClick={handleHostNext}
                  className="mt-6 w-full bg-gradient-to-r from-green-500 to-teal-500 text-white py-3 rounded-xl font-bold text-lg shadow hover:scale-105 transition-all"
                >
                  Next Round ➜
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
