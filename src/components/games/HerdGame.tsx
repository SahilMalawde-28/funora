import { useState, useEffect, useMemo } from "react";
import { Room, Player } from "../../lib/supabase";
import { Trophy, Users, Brain } from "lucide-react";

interface HerdGameProps {
  room: Room;
  players: Player[];
  currentPlayer: Player;
  gameState: any;
  onUpdateState: (newState: any) => void;
  onEndGame: () => void;
}

const TOPICS: Record<string, string[]> = {
  animals: ["cow", "dog", "cat", "lion", "horse", "tiger", "elephant", "goat", "monkey", "zebra", "panda", "bear"],
  fruits: ["apple", "banana", "mango", "orange", "grape", "pear", "kiwi", "melon", "pineapple", "papaya", "berry"],
  colors: ["red", "blue", "green", "yellow", "black", "white", "purple", "pink", "grey", "maroon", "teal"],
  sports: ["cricket", "football", "tennis", "hockey", "badminton", "kabaddi", "basketball", "golf", "table tennis", "chess"],
  apps: ["instagram", "whatsapp", "snapchat", "spotify", "youtube", "zoom", "telegram", "reddit", "discord", "twitter"],
  drinks: ["coffee", "tea", "cola", "juice", "milkshake", "smoothie", "water", "beer", "wine", "milk"],
  fast_food: ["pizza", "burger", "fries", "sandwich", "tacos", "pasta", "noodles", "wrap", "bagel", "hotdog"],
  stationery: ["pen", "pencil", "eraser", "sharpener", "scale", "marker", "notebook", "highlighter", "glue", "stapler"],
  movies: ["inception", "avatar", "titanic", "jaws", "joker", "dangal", "bahubali", "3 idiots", "interstellar", "rocky"],
  music_genres: ["pop", "rock", "jazz", "hiphop", "classical", "lofi", "rap", "country", "electronic", "blues"],
  holidays: ["weekend", "vacation", "leave", "holiday", "sick leave", "festival break", "winter break", "summer break"],
  programming_langs: ["python", "java", "C++", "javascript", "php", "ruby", "go", "kotlin", "rust", "swift"],
  countries: ["india", "usa", "japan", "germany", "italy", "brazil", "france", "canada", "china", "australia"],
  emotions: ["happy", "sad", "angry", "bored", "excited", "nervous", "confused", "tired", "relaxed", "proud"],
  desserts: ["cake", "pie", "brownie", "ice cream", "pudding", "donut", "pastry", "cookie", "waffle", "tart"],
  vehicles: ["car", "bike", "bus", "train", "flight", "scooter", "jeep", "truck", "van", "ship", "metro"],
  devices: ["mobile", "laptop", "tablet", "watch", "camera", "printer", "drone", "tv", "speaker", "monitor"],
  mobile_brands: ["apple", "samsung", "xiaomi", "oneplus", "oppo", "vivo", "realme", "google", "motorola", "nokia"],
  superheroes: ["batman", "superman", "thor", "spiderman", "ironman", "hulk", "flash", "aquaman", "antman", "black widow"],
  games: ["chess", "ludo", "carrom", "pubg", "valorant", "minecraft", "gta", "fifa", "clash royale", "among us"],
  festivals: ["diwali", "christmas", "eid", "holi", "pongal", "navratri", "thanksgiving", "new year", "onam", "baisakhi"],
  subjects: ["maths", "science", "english", "history", "geography", "physics", "chemistry", "biology", "economics"],
  pizza_toppings: ["pepperoni", "mushrooms", "onions", "sausage", "pineapple", "basil", "tomato", "olives", "chicken"],
  cloth_items: ["hoodie", "jeans", "shirt", "saree", "kurta", "shorts", "cap", "coat", "socks", "jacket"],
  social_media: ["post", "story", "reel", "tweet", "dm", "tag", "share", "like", "comment", "follow"],
  desserts_india: ["gulab jamun", "rasgulla", "jalebi", "kheer", "barfi", "ladoo", "halwa", "sheer khurma"],
  careers: ["doctor", "engineer", "teacher", "lawyer", "artist", "chef", "youtuber", "nurse", "pilot", "scientist"],
  relationships: ["crush", "friend", "bestie", "ex", "family", "partner", "colleague", "mentor", "senior", "junior"],
  famous_places: ["taj mahal", "eiffel tower", "statue of liberty", "pyramids", "machu picchu", "big ben"],
  snacks: ["chips", "popcorn", "chocolate", "cookies", "namkeen", "peanuts", "bhel", "chana", "bhaakharwadi"],
  class_roles: ["monitor", "CR", "backbencher", "topper", "mass bunk leader", "note taker", "proxy king"],
  excuses: ["headache", "wifi down", "cold", "traffic", "family emergency", "deadlines", "not feeling well"],
  drink_flavours: ["vanilla", "mango", "chocolate", "strawberry", "coffee", "caramel", "mint"],
  bedtime_thoughts: ["future", "crush", "career", "regret", "dreams", "next day plan", "overthinking"],
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
    reveal: false,
  };

  const [input, setInput] = useState("");
  const alivePlayers = players.filter((p) => !herd.eliminated.includes(p.player_id));
  const isHost = currentPlayer.player_id === room.host_id;
  const myAnswer = herd.answers[currentPlayer.player_id];

  // Ensure scores exist for everyone
  useEffect(() => {
    const updatedScores = { ...herd.scores };
    players.forEach((p) => {
      if (updatedScores[p.player_id] === undefined) updatedScores[p.player_id] = 0;
    });
    push({ scores: updatedScores });
  }, []);

  // Submit answer
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

  // Check ready for reveal
  const allAnswered = alivePlayers.every((p) => herd.answers[p.player_id]);

  // Evaluate logic
  const evaluateRound = () => {
    const answers = herd.answers;
    const answerCounts: Record<string, number> = {};

    Object.values(answers).forEach((a) => {
      answerCounts[a] = (answerCounts[a] ?? 0) + 1;
    });

    let newScores = { ...herd.scores };
    let newEliminated = [...herd.eliminated];

    if (alivePlayers.length === 2) {
      // 2-player computer round
      const compWord = herd.computerWord ?? randomWord(herd.topic);
      const [A, B] = alivePlayers;
      const a = answers[A.player_id];
      const b = answers[B.player_id];

      if (a === compWord && b !== compWord) newScores[B.player_id]--;
      else if (b === compWord && a !== compWord) newScores[A.player_id]--;
      else if (a !== b) {
        newScores[A.player_id]--;
        newScores[B.player_id]--;
      }

      push({ computerWord: compWord });
    } else {
      // Normal herd round
      const maxCount = Math.max(...Object.values(answerCounts));
      const majorityAnswers = Object.keys(answerCounts).filter(
        (key) => answerCounts[key] === maxCount && maxCount > 1
      );

      alivePlayers.forEach((player) => {
        const ans = answers[player.player_id];
        if (!majorityAnswers.includes(ans)) newScores[player.player_id]--;
      });

      // If no majority → all -1
      if (majorityAnswers.length === 0) {
        alivePlayers.forEach((p) => (newScores[p.player_id]--));
      }
    }

    // Eliminate at -5
    players.forEach((p) => {
      if (newScores[p.player_id] <= -5) newEliminated.push(p.player_id);
    });

    push({
      reveal: true,
      scores: newScores,
      eliminated: newEliminated,
      answers: herd.answers,
    });
  };

  // Next round
  const nextRound = () => {
    if (alivePlayers.length <= 1) return onEndGame();
    push({
      round: herd.round + 1,
      topic: randomTopic(),
      answers: {},
      computerWord: alivePlayers.length === 2 ? randomWord(herd.topic) : null,
      reveal: false,
    });
  };

  // Push update
  function push(patch: any) {
    onUpdateState({ herd: { ...herd, ...patch } });
  }

  /** UI Elements */
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 p-6 text-center">
      <h1 className="text-4xl font-black mb-3 text-pink-600">🐮 HERD MENTALITY</h1>
      <p className="text-gray-500 mb-6">Round {herd.round} — Topic: <span className="font-bold">{herd.topic}</span></p>

      {/* Answer Input */}
      {!herd.reveal && !herd.eliminated.includes(currentPlayer.player_id) && (
        <>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Your answer..."
            disabled={!!myAnswer}
            className="border-2 p-3 rounded-xl w-2/3 mx-auto focus:ring-2 outline-none text-lg"
          />
          <button
            onClick={submitAnswer}
            disabled={!input.trim() || !!myAnswer}
            className="block mx-auto mt-3 bg-pink-500 hover:bg-pink-600 text-white px-6 py-2 rounded-xl font-semibold disabled:opacity-60"
          >
            {myAnswer ? "Answer Submitted" : "Submit Answer"}
          </button>
        </>
      )}

      {/* Waiting */}
      {!herd.reveal && myAnswer && <p className="mt-5">🐑 Waiting for others...</p>}

      {/* Reveal Phase */}
      {herd.reveal && (
        <div className="bg-white p-6 rounded-2xl shadow-lg mx-auto max-w-2xl">
          <h2 className="text-xl font-bold mb-3 text-indigo-600">🌟 Round Results</h2>

          {alivePlayers.length === 2 && herd.computerWord && (
            <p className="text-sm text-gray-600 mb-2">
              🤖 Computer Answer: <b>{herd.computerWord}</b>
            </p>
          )}

          {players.map((p, i) => (
            <p
              key={p.player_id}
              className={`mt-1 p-2 rounded-xl ${
                herd.eliminated.includes(p.player_id)
                  ? "text-gray-400 line-through"
                  : ""
              }`}
            >
              <b>{p.name}:</b> {herd.answers[p.player_id] || "—"} &nbsp;
              <span className="text-gray-600">(Score: {herd.scores[p.player_id]})</span>
            </p>
          ))}

          {/* Continue / End */}
          {isHost && (
            <button
              onClick={alivePlayers.length <= 1 ? onEndGame : nextRound}
              className="mt-5 bg-purple-500 hover:bg-purple-600 px-6 py-2 text-white rounded-xl font-bold"
            >
              {alivePlayers.length <= 1 ? "🏁 End Game" : "Next Round ➜"}
            </button>
          )}
        </div>
      )}

      {/* Scoreboard */}
      <div className="mt-6">
        <h3 className="font-semibold mb-2">📊 Scoreboard</h3>
        {players.map((p) => (
          <p
            key={p.player_id}
            className={
              herd.eliminated.includes(p.player_id)
                ? "line-through text-gray-400"
                : "font-medium"
            }
          >
            {p.name}: {herd.scores[p.player_id]}
          </p>
        ))}
      </div>
    </div>
  );
}

function randomTopic() {
  const keys = Object.keys(TOPICS);
  return keys[Math.floor(Math.random() * keys.length)];
}

function randomWord(topic: string) {
  const list = TOPICS[topic];
  return list[Math.floor(Math.random() * list.length)];
}
