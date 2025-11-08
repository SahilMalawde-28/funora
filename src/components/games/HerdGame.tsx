import { useEffect, useState } from "react";
import supabase from "../../lib/supabaseClient";
import { Room, Player } from "../../lib/supabase";

interface HerdGameProps {
  room: Room;
  players: Player[];
  currentPlayer: Player;
  onUpdateRoom: (newData: Partial<Room>) => void;
}

const TOPICS = {
  animals: ["cow", "dog", "cat", "lion", "horse", "tiger", "elephant"],
  fruits: ["apple", "banana", "mango", "orange", "grape", "pear"],
  colors: ["red", "blue", "green", "yellow", "black", "white"],
};

export default function HerdGame({
  room,
  players,
  currentPlayer,
  onUpdateRoom,
}: HerdGameProps) {
  const gameState = room.game_state?.herd || {
    round: 1,
    scores: {},
    answers: {},
    eliminated: [],
    topic: null,
  };

  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");

  // Ensure each player has score entry
  useEffect(() => {
    const newScores = { ...gameState.scores };
    players.forEach((p) => {
      if (newScores[p.id] === undefined) newScores[p.id] = 0;
    });
    if (JSON.stringify(newScores) !== JSON.stringify(gameState.scores)) {
      updateGame({ scores: newScores });
    }
  }, [players]);

  // Pick random topic for first round
  useEffect(() => {
    if (!gameState.topic) {
      const randomTopic = Object.keys(TOPICS)[
        Math.floor(Math.random() * Object.keys(TOPICS).length)
      ];
      updateGame({ topic: randomTopic });
    }
  }, []);

  const updateGame = (newData: any) => {
    const newState = {
      ...room.game_state,
      herd: { ...gameState, ...newData },
    };
    onUpdateRoom({ game_state: newState });
    supabase.from("rooms").update({ game_state: newState }).eq("id", room.id);
  };

  const handleSubmit = () => {
    if (!input.trim()) return;
    const newAnswers = {
      ...gameState.answers,
      [currentPlayer.id]: input.trim().toLowerCase(),
    };
    updateGame({ answers: newAnswers });
    setInput("");
    setStatus("🐮 Waiting for others...");
  };

  // Evaluate once all alive players answered
  useEffect(() => {
    const alivePlayers = players.filter(
      (p) => !gameState.eliminated.includes(p.id)
    );
    const allAnswered = alivePlayers.every((p) => gameState.answers[p.id]);
    if (allAnswered && alivePlayers.length >= 2) {
      evaluateRound();
    }
  }, [gameState.answers]);

  const evaluateRound = () => {
    const answers = Object.values(gameState.answers);
    const counts: Record<string, number> = {};
    answers.forEach((a) => (counts[a] = (counts[a] || 0) + 1));

    const alivePlayers = players.filter(
      (p) => !gameState.eliminated.includes(p.id)
    );
    const newScores = { ...gameState.scores };
    const eliminated = [...gameState.eliminated];

    // Computer logic when only 2 players remain
    let computerWord: string | null = null;
    if (alivePlayers.length === 2) {
      const topic = gameState.topic || "animals";
      const topicWords = TOPICS[topic];
      computerWord = topicWords[Math.floor(Math.random() * topicWords.length)];
    }

    alivePlayers.forEach((p) => {
      const answer = gameState.answers[p.id];
      const isMinority = counts[answer] === 1;

      // special 2-player rule
      if (alivePlayers.length === 2 && computerWord) {
        const other = alivePlayers.find((x) => x.id !== p.id)!;
        const otherAns = gameState.answers[other.id];
        if (answer === computerWord) return; // safe
        if (otherAns === answer) return; // both safe if same non-computer word
        newScores[p.id] -= 1;
      } else {
        if (isMinority) newScores[p.id] -= 1;
      }

      if (newScores[p.id] <= -6 && !eliminated.includes(p.id)) {
        eliminated.push(p.id);
      }
    });

    const nextRound = gameState.round + 1;
    const newTopic =
      Object.keys(TOPICS)[Math.floor(Math.random() * Object.keys(TOPICS).length)];

    updateGame({
      round: nextRound,
      scores: newScores,
      answers: {},
      eliminated,
      topic: newTopic,
    });

    setStatus(`🐮 Round ${nextRound} starting!`);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <h2 className="text-2xl font-bold mb-2">🐮 Herd Mentality</h2>
      <p className="mb-4 text-gray-600">
        Round {gameState.round} — Topic:{" "}
        <span className="font-semibold capitalize">{gameState.topic}</span>
      </p>

      {!gameState.eliminated.includes(currentPlayer.id) ? (
        <>
          {!gameState.answers[currentPlayer.id] ? (
            <div className="flex flex-col items-center space-y-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="border border-gray-400 rounded px-3 py-2 text-center w-48"
                placeholder={`Your ${gameState.topic}...`}
              />
              <button
                onClick={handleSubmit}
                className="bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600"
              >
                Submit
              </button>
            </div>
          ) : (
            <p className="text-gray-700">{status}</p>
          )}
        </>
      ) : (
        <p className="text-red-500 font-semibold">You’re out! 💀</p>
      )}

      <div className="mt-6">
        <h3 className="font-semibold mb-2">Scores:</h3>
        {players.map((p) => (
          <div
            key={p.id}
            className={`${
              gameState.eliminated.includes(p.id)
                ? "text-gray-400 line-through"
                : "text-black"
            }`}
          >
            {p.name}: {gameState.scores[p.id] ?? 0}
          </div>
        ))}
      </div>
    </div>
  );
}
