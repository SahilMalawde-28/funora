import { useEffect, useState } from "react";
import { Room, Player } from "../../lib/supabase";
import { BluffGameState } from "../../lib/gameLogic";
import { MessageSquare, Eye, Trophy, Timer } from "lucide-react";

interface BluffGameProps {
  room: Room;
  players: Player[];
  currentPlayer: Player;
  gameState: BluffGameState;
  onUpdateState: (newState: Partial<BluffGameState>) => void;
  onEndGame: () => void;
}

export default function BluffGame({
  room,
  players,
  currentPlayer,
  gameState,
  onUpdateState,
  onEndGame,
}: BluffGameProps) {
  const [answer, setAnswer] = useState("");
  const [vote, setVote] = useState<string | null>(null);
  const [timer, setTimer] = useState(30);

  const myRole = gameState.assignments[currentPlayer.player_id];
  const hasAnswered = !!gameState.answers[currentPlayer.player_id];
  const hasVoted = !!gameState.votes[currentPlayer.player_id];

  // 🕒 Timer during merged phase
  useEffect(() => {
    if (gameState.phase === "reveal_vote" && timer > 0) {
      const t = setTimeout(() => setTimer((prev) => prev - 1), 1000);
      return () => clearTimeout(t);
    }
    if (timer === 0 && !hasVoted) handleVote(null);
  }, [timer, gameState.phase]);

  const handleSubmitAnswer = () => {
    if (!answer.trim() || hasAnswered) return;
    const newAnswers = { ...gameState.answers, [currentPlayer.player_id]: answer };
    onUpdateState({ answers: newAnswers });
  };

  const handleVote = (playerId: string | null) => {
    if (hasVoted) return;
    setVote(playerId);
    const newVotes = { ...gameState.votes, [currentPlayer.player_id]: playerId };
    onUpdateState({ votes: newVotes });
  };

  const allAnswered = Object.keys(gameState.answers).length === players.length;
  const allVoted = Object.keys(gameState.votes).length === players.length;

  // Host navigation logic
  const handleHostContinue = () => {
    if (gameState.phase === "answering" && allAnswered) {
      setTimer(30);
      onUpdateState({ phase: "reveal_vote", votes: {} });
    } else if (gameState.phase === "reveal_vote" && allVoted) {
      onUpdateState({ phase: "results" });
    }
  };

  // 🧾 Phase 1: Answering
  if (gameState.phase === "answering") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-orange-50 p-6">
        <div className="max-w-3xl mx-auto bg-white p-8 rounded-3xl shadow-xl space-y-6">
          <div className="text-center">
            <MessageSquare className="w-12 h-12 text-orange-600 mx-auto mb-3" />
            <h1 className="text-3xl font-black text-gray-800 mb-2">🎭 Bluff & Truth</h1>
            <p className="text-gray-600">Everyone answers — but someone’s bluffing!</p>
          </div>

          <div className="p-6 rounded-2xl bg-gradient-to-r from-orange-100 to-yellow-100 border-2 border-orange-300">
            <p className="text-center text-sm font-bold text-orange-700 mb-2">
              YOUR QUESTION
            </p>
            <p className="text-2xl font-bold text-gray-900 text-center">
              {myRole === "bluff"
                ? gameState.fakeQuestion
                : gameState.realQuestion}
            </p>
          </div>

          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer..."
            className="w-full p-4 border-2 border-gray-300 rounded-xl resize-none text-lg focus:border-orange-500"
            rows={4}
            disabled={hasAnswered}
          />
          <button
            onClick={handleSubmitAnswer}
            disabled={!answer.trim() || hasAnswered}
            className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 text-white py-3 rounded-xl font-bold text-lg shadow hover:shadow-lg transition-all disabled:opacity-60"
          >
            {hasAnswered ? "✅ Answer Submitted" : "Submit Answer"}
          </button>

          <p className="text-center text-sm text-gray-500">
            {Object.keys(gameState.answers).length}/{players.length} players answered
          </p>

          {currentPlayer.player_id === room.host_id && allAnswered && (
            <button
              onClick={handleHostContinue}
              className="w-full bg-gradient-to-r from-green-500 to-teal-500 text-white py-3 rounded-xl font-bold shadow hover:scale-105 transition-all"
            >
              Continue ➜ Reveal & Vote
            </button>
          )}
        </div>
      </div>
    );
  }

  // 🧾 Phase 2: Combined Reveal + Vote
  if (gameState.phase === "reveal_vote") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-yellow-50 p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl p-8 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-black text-gray-800">Reveal & Vote 👀</h1>
              <p className="text-gray-600 text-sm">
                Read the real question & answers, then vote for the bluff!
              </p>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Timer className="w-5 h-5" />
              <span className="font-semibold">{timer}s</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-r from-orange-100 to-yellow-100 border-2 border-orange-300 text-center">
            <p className="text-sm font-bold text-orange-700 mb-1">REAL QUESTION</p>
            <p className="text-xl font-bold text-gray-900">
              {gameState.realQuestion}
            </p>
          </div>

          <div className="grid gap-3">
            {players.map((player) => (
              <div
                key={player.player_id}
                className={`p-5 rounded-2xl border-2 transition-all ${
                  vote === player.player_id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <p className="font-bold text-gray-800 mb-1">{player.name}</p>
                <p className="text-gray-700 mb-3">{gameState.answers[player.player_id]}</p>
                {!hasVoted && (
                  <button
                    onClick={() => handleVote(player.player_id)}
                    className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-2 rounded-xl font-semibold shadow hover:scale-[1.02] transition-all"
                  >
                    Vote This Player
                  </button>
                )}
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-gray-500">
            {Object.keys(gameState.votes).length}/{players.length} voted
          </p>

          {currentPlayer.player_id === room.host_id && allVoted && (
            <button
              onClick={handleHostContinue}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl font-bold text-lg shadow hover:scale-105 transition-all"
            >
              Continue ➜ Results
            </button>
          )}
        </div>
      </div>
    );
  }

  // 🧾 Phase 3: Results
  if (gameState.phase === "results") {
    const voteCounts: Record<string, number> = {};
    Object.values(gameState.votes).forEach((v) => {
      if (!v) return;
      voteCounts[v] = (voteCounts[v] || 0) + 1;
    });
    const mostVoted = Object.entries(voteCounts).sort((a, b) => b[1] - a[1])[0];
    const imposterIds = Object.keys(gameState.assignments).filter(
      (id) => gameState.assignments[id] === "bluff"
    );

    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-orange-50 p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl p-8 space-y-6 text-center">
          <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
          <h1 className="text-3xl font-black text-gray-800 mb-4">Round Results 🏁</h1>

          <p className="text-lg text-gray-700 mb-2">
            Most voted: <b>{players.find((p) => p.player_id === mostVoted?.[0])?.name || "No one"}</b>
          </p>
          <p className="text-lg text-gray-700">
            Actual Bluffers:{" "}
            <b>{imposterIds.map((id) => players.find((p) => p.player_id === id)?.name).join(", ")}</b>
          </p>

          <button
            onClick={onEndGame}
            className="mt-6 w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 rounded-xl font-bold text-lg shadow hover:scale-105 transition-all"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  return <p className="text-center text-gray-600 mt-10">Loading game...</p>;
}
