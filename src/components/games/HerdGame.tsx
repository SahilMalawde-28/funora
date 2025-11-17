import { useState, useEffect } from "react";
import { Room, Player } from "../../lib/supabase";

interface HerdGameProps {
  room: Room;
  players: Player[];
  currentPlayer: Player;
  gameState: any;
  onUpdateState: (newState: any) => void;
  onEndGame: () => void;
}

const TOPICS: Record<string, string[]> = {
  animals: ["cow", "dog", "cat", "lion", "horse", "tiger", "elephant", "goat", "monkey"],
  fruits: ["apple", "banana", "mango", "orange", "grape", "pear", "kiwi", "melon"],
  colors: ["red", "blue", "green", "yellow", "black", "white", "purple"],
  sports: ["cricket", "football", "tennis", "hockey", "badminton"],
  apps: ["instagram", "whatsapp", "snapchat", "spotify", "youtube"],
};

export default function HerdGame({
  room,
  players,
  currentPlayer,
  gameState,
  onUpdateState,
  onEndGame,
}: HerdGameProps) {
  const herd = gameState.herd ?? {
    round: 1,
    topic: randomTopic(),
    answers: {},
    scores: {},
    eliminated: [],
    computerWord: null,
  };

  const alivePlayers = players.filter((p) => !herd.eliminated.includes(p.player_id));

  const myAnswer = herd.answers[currentPlayer.player_id];
  const [input, setInput] = useState("");

  /** ---- INITIAL SCORE SETUP ---- **/
  useEffect(() => {
    const updated = { ...herd.scores };
    players.forEach((p) => {
      if (updated[p.player_id] === undefined) updated[p.player_id] = 0;
    });
    push({ scores: updated });
  }, []);

  /** ---- SUBMIT ANSWER ---- **/
  const submitAnswer = () => {
    if (!input.trim()) return;

    push({
      answers: {
        ...herd.answers,
        [currentPlayer.player_id]: input.trim().toLowerCase(),
      },
    });

    setInput("");
  };

  /** ---- AUTO EVALUATE WHEN ALL ANSWER ---- **/
  useEffect(() => {
    if (alivePlayers.every((p) => herd.answers[p.player_id])) evaluate();
  }, [herd.answers]);

  /** ---- EVALUATION LOGIC ---- **/
  function evaluate() {
    const newScores = { ...herd.scores };
    let eliminated = [...herd.eliminated];
    let compWord = herd.computerWord || null;

    /** IF 2 PLAYERS LEFT → COMPUTER PICKS WORD **/
    if (alivePlayers.length === 2) {
      if (!compWord) compWord = randomWord(herd.topic);
      const [A, B] = alivePlayers;

      const a = herd.answers[A.player_id];
      const b = herd.answers[B.player_id];

      if (a !== compWord && b !== compWord) {
        if (a !== b) {
          newScores[A.player_id] -= 1;
          newScores[B.player_id] -= 1;
        }
      } else if (a === compWord && b !== compWord) {
        newScores[B.player_id] -= 1;
      } else if (b === compWord && a !== compWord) {
        newScores[A.player_id] -= 1;
      }
    } else {
      /** NORMAL ROUND **/
      const count: Record<string, number> = {};
      Object.values(herd.answers).forEach((a) => {
        count[a] = (count[a] ?? 0) + 1;
      });

      const max = Math.max(...Object.values(count));
      const majorities = Object.keys(count).filter((k) => count[k] === max);

      alivePlayers.forEach((p) => {
        const ans = herd.answers[p.player_id];
        if (!majorities.includes(ans)) newScores[p.player_id] -= 1;
      });
    }

    /** ELIMINATION **/
    players.forEach((p) => {
      if (newScores[p.player_id] <= -6 && !eliminated.includes(p.player_id))
        eliminated.push(p.player_id);
    });

    /** GAME OVER **/
    if (alivePlayers.length <= 1)
      return onEndGame();

    /** NEXT ROUND **/
    push({
      round: herd.round + 1,
      topic: randomTopic(),
      scores: newScores,
      eliminated,
      answers: {},
      computerWord: alivePlayers.length === 2 ? compWord : null,
    });
  }

  function push(patch: any) {
    onUpdateState({
      herd: { ...herd, ...patch },
    });
  }

  /** ---- UI ---- **/
  return (
    <div className="text-center p-6">
      <h1 className="text-3xl font-black mb-1">🐮 HERD MENTALITY</h1>
      <p className="text-gray-600 mb-4">Round {herd.round}</p>

      <h2 className="text-xl font-bold">
        TOPIC: <span className="capitalize">{herd.topic}</span>
      </h2>

      {!herd.eliminated.includes(currentPlayer.player_id) ? (
        <>
          {!myAnswer && (
            <div className="mt-4 space-y-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="border px-3 py-2 rounded"
                placeholder="Your answer..."
              />
              <button
                onClick={submitAnswer}
                className="bg-pink-500 text-white px-4 py-2 rounded-lg"
              >
                Submit
              </button>
            </div>
          )}

          {myAnswer && <p className="mt-4 text-gray-500">Waiting for others…</p>}
        </>
      ) : (
        <p className="mt-4 text-red-500 font-bold">❌ You’re Out!</p>
      )}

      <div className="mt-6">
        <h3 className="font-semibold mb-1">SCORES:</h3>
        {players.map((p) => (
          <p
            key={p.player_id}
            className={herd.eliminated.includes(p.player_id)
              ? "line-through text-gray-400"
              : ""}
          >
            {p.name}: {herd.scores[p.player_id] ?? 0}
          </p>
        ))}
      </div>

      {herd.computerWord && (
        <p className="mt-3 text-indigo-600 text-sm">
          🤖 Secret computer word selected!
        </p>
      )}
    </div>
  );
}

/** HELPERS */
function randomTopic() {
  const keys = Object.keys(TOPICS);
  return keys[Math.floor(Math.random() * keys.length)];
}

function randomWord(topic: string) {
  const list = TOPICS[topic];
  return list[Math.floor(Math.random() * list.length)];
}
