import { useEffect, useState } from "react";
import { Room, Player } from "../../lib/supabase";
import { HerdGameState } from "../../lib/gameLogic";
import { Trophy } from "lucide-react";

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
  const [timer, setTimer] = useState(25);
  const [revealed, setRevealed] = useState(false);

  const hasAnswered = !!gameState.answers[currentPlayer.player_id];
  const allAnswered = Object.keys(gameState.answers).length === players.length;

  // Timer logic
  useEffect(() => {
    if (gameState.phase === "answering" && timer > 0) {
      const t = setTimeout(() => setTimer((t) => t - 1), 1000);
      return () => clearTimeout(t);
    }
    if (timer === 0 && !hasAnswered) handleSubmit();
  }, [timer, gameState.phase]);

  const handleSubmit = () => {
    if (!answer.trim() || hasAnswered) return;
    const newAnswers = { ...gameState.answers, [currentPlayer.player_id]: answer.trim().toLowerCase() };
    onUpdateState({ answers: newAnswers });
  };

  const handleHostContinue = () => {
    if (gameState.phase === "answering" && allAnswered) {
      calculateResults();
    } else if (gameState.phase === "results") {
      nextRound();
    }
  };

  const calculateResults = () => {
    const answerGroups: Record<string, string[]> = {};
    for (const [pid, ans] of Object.entries(gameState.answers)) {
      if (!answerGroups[ans]) answerGroups[ans] = [];
      answerGroups[ans].push(pid);
    }

    const majorityCount = Math.max(...Object.values(answerGroups).map((a) => a.length));
    const majorityAnswers = Object.keys(answerGroups).filter((a) => answerGroups[a].length === majorityCount);

    const newScores = { ...gameState.scores };
    for (const player of players) {
      const ans = gameState.answers[player.player_id];
      if (!majorityAnswers.includes(ans)) {
        newScores[player.player_id] = (newScores[player.player_id] || 0) - 1;
      }
    }

    onUpdateState({
      phase: "results",
      scores: newScores,
    });
    setRevealed(true);
  };

  const nextRound = () => {
    const eliminated = players.filter((p) => (gameState.scores[p.player_id] || 0) <= -6);
    const activePlayers = players.filter((p) => !eliminated.includes(p));

    // If only 2 players left → computer joins
    if (activePlayers.length === 2) {
      const newCategory = getRandomCategory();
      const word = getComputerWordForCategory(newCategory);
      onUpdateState({
        phase: "computer_round",
        question: newCategory,
        computerWord: word,
        answers: {},
      });
      setTimer(25);
      setAnswer("");
      setRevealed(false);
      return;
    }

    const newCategory = getRandomCategory();
    onUpdateState({
      phase: "answering",
      question: newCategory,
      answers: {},
    });
    setTimer(25);
    setAnswer("");
    setRevealed(false);
  };

  const getRandomCategory = () => {
    const categories = Object.keys(categoryWords);
    return categories[Math.floor(Math.random() * categories.length)];
  };

  const getComputerWordForCategory = (category: string) => {
    const words = categoryWords[category];
    return words[Math.floor(Math.random() * words.length)];
  };

  const handleComputerRound = () => {
    const compWord = gameState.computerWord!;
    const [p1, p2] = players;
    const newScores = { ...gameState.scores };

    const p1ans = gameState.answers[p1.player_id];
    const p2ans = gameState.answers[p2.player_id];

    if (p1ans === compWord && p2ans === compWord) {
      // both matched → safe
    } else if (p1ans === compWord) {
      newScores[p2.player_id] = (newScores[p2.player_id] || 0) - 1;
    } else if (p2ans === compWord) {
      newScores[p1.player_id] = (newScores[p1.player_id] || 0) - 1;
    } else if (p1ans !== p2ans) {
      // both differ from comp and each other → both lose
      newScores[p1.player_id] = (newScores[p1.player_id] || 0) - 1;
      newScores[p2.player_id] = (newScores[p2.player_id] || 0) - 1;
    } else {
      // both same but diff from comp → safe
    }

    onUpdateState({
      scores: newScores,
      phase: "results",
    });
  };

  // 🗂 Category word bank for computer logic
  const categoryWords: Record<string, string[]> = {
    Fruits: ["apple", "banana", "mango", "grape", "kiwi", "orange"],
    Movies: ["inception", "avatar", "titanic", "joker", "batman"],
    Sports: ["football", "cricket", "hockey", "tennis", "golf"],
    Animals: ["lion", "tiger", "dog", "cat", "elephant"],
    Countries: ["india", "japan", "brazil", "france", "canada"],
    Colors: ["red", "blue", "green", "yellow", "purple"],
    TVShows: ["friends", "breaking bad", "got", "sherlock"],
    Professions: ["doctor", "teacher", "engineer", "pilot"],
  };

  // 🧩 PHASE 1: Answering
  if (gameState.phase === "answering") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-100 p-6">
        <div className="max-w-3xl mx-auto bg-white p-8 rounded-3xl shadow-xl space-y-6 text-center">
          <div className="text-6xl mb-2">🐮</div>
          <h1 className="text-3xl font-black text-gray-800 mb-2">HERD MENTALITY</h1>
          <p className="text-gray-600">Try to think like the herd!</p>

          <div className="p-6 bg-pink-50 border-2 border-pink-300 rounded-2xl">
            <p className="font-bold text-pink-700 mb-1">CATEGORY</p>
            <p className="text-2xl font-semibold">{gameState.question}</p>
          </div>

          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer..."
            className="w-full p-4 border-2 border-gray-300 rounded-xl text-lg focus:border-pink-500"
            disabled={hasAnswered}
          />
          <button
            onClick={handleSubmit}
            disabled={!answer.trim() || hasAnswered}
            className="w-full bg-pink-500 text-white py-3 rounded-xl font-bold text-lg shadow hover:scale-105 transition-all disabled:opacity-60"
          >
            {hasAnswered ? "✅ Submitted" : "Submit"}
          </button>

          <p className="text-sm text-gray-500">{Object.keys(gameState.answers).length}/{players.length} answered</p>

          {currentPlayer.player_id === room.host_id && allAnswered && (
            <button
              onClick={handleHostContinue}
              className="w-full bg-green-500 text-white py-3 rounded-xl font-bold text-lg shadow hover:scale-105 transition-all"
            >
              Continue ➜ Reveal
            </button>
          )}
        </div>
      </div>
    );
  }

  // 🧩 PHASE 2: Computer Round
  if (gameState.phase === "computer_round") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-100 p-6 text-center">
        <div className="max-w-3xl mx-auto bg-white p-8 rounded-3xl shadow-xl">
          <h1 className="text-3xl font-black text-gray-800 mb-2">🤖 Computer Round</h1>
          <p className="text-gray-600 mb-4">Try to match the computer’s secret word!</p>

          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl mb-4">
            <p className="text-sm text-indigo-700 font-bold">Category</p>
            <p className="text-2xl font-bold text-gray-900">{gameState.question}</p>
          </div>

          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer..."
            className="w-full p-4 border-2 border-gray-300 rounded-xl text-lg focus:border-indigo-500"
            disabled={hasAnswered}
          />
          <button
            onClick={handleSubmit}
            disabled={!answer.trim() || hasAnswered}
            className="w-full bg-indigo-500 text-white py-3 rounded-xl font-bold text-lg shadow hover:scale-105 transition-all disabled:opacity-60"
          >
            {hasAnswered ? "✅ Submitted" : "Submit"}
          </button>

          {currentPlayer.player_id === room.host_id && allAnswered && (
            <button
              onClick={handleComputerRound}
              className="w-full mt-4 bg-green-500 text-white py-3 rounded-xl font-bold text-lg shadow hover:scale-105 transition-all"
            >
              Continue ➜ Reveal
            </button>
          )}
        </div>
      </div>
    );
  }

  // 🧩 PHASE 3: Results
  if (gameState.phase === "results") {
    const eliminated = players.filter((p) => (gameState.scores[p.player_id] || 0) <= -6);
    const winner = players.find((p) => !eliminated.includes(p));

    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-100 p-6 text-center">
        <div className="max-w-3xl mx-auto bg-white p-8 rounded-3xl shadow-xl space-y-4">
          <Trophy className="w-12 h-12 text-pink-500 mx-auto mb-2" />
          <h1 className="text-3xl font-black text-gray-800">Round Results</h1>

          {revealed && (
            <div className="mt-3 space-y-2">
              {players.map((p) => (
                <p key={p.player_id} className="text-gray-700">
                  {p.name}: {gameState.scores[p.player_id] || 0}
                </p>
              ))}
            </div>
          )}

          {winner ? (
            <p className="text-xl font-bold text-green-600 mt-3">
              🎉 {winner.name} wins the herd!
            </p>
          ) : (
            <p className="text-gray-600 mt-2">No one’s out yet — next round!</p>
          )}

          {currentPlayer.player_id === room.host_id && (
            <button
              onClick={winner ? onEndGame : handleHostContinue}
              className="mt-6 w-full bg-pink-500 text-white py-3 rounded-xl font-bold text-lg shadow hover:scale-105 transition-all"
            >
              {winner ? "🏁 End Game" : "Next Round ➜"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return <p className="text-center text-gray-600 mt-10">Loading Herd Mentality...</p>;
}
