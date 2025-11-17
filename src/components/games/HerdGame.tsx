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

  // Initialize scores if missing
  useEffect(() => {
    const updatedScores = { ...herd.scores };
    players.forEach((p) => {
      if (updatedScores[p.player_id] === undefined) updatedScores[p.player_id] = 0;
    });
    if (JSON.stringify(updatedScores) !== JSON.stringify(herd.scores)) {
      push({ scores: updatedScores });
    }
  }, [players]);

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

  const allAnswered = alivePlayers.every((p) => herd.answers[p.player_id]);

  const evaluateRound = () => {
    const answers = herd.answers;
    const counts: Record<string, number> = {};

    Object.values(answers).forEach((a) => {
      counts[a] = (counts[a] ?? 0) + 1;
    });

    let newScores = { ...herd.scores };
    let newEliminated = [...herd.eliminated];

    if (alivePlayers.length === 2) {
      const compWord = herd.computerWord ?? randomWord(herd.topic);
      const [p1, p2] = alivePlayers;
      const a1 = answers[p1.player_id];
      const a2 = answers[p2.player_id];

      if (a1 !== compWord && a2 !== compWord && a1 !== a2) {
        newScores[p1.player_id]--;
        newScores[p2.player_id]--;
      } else if (a1 !== compWord && a2 === compWord) {
        newScores[p1.player_id]--;
      } else if (a2 !== compWord && a1 === compWord) {
        newScores[p2.player_id]--;
      }

      push({ computerWord: compWord });
    } else {
      const maxCount = Math.max(...Object.values(counts));
      const majorityAnswers = Object.keys(counts).filter((ans) => counts[ans] === maxCount && maxCount > 1);

      alivePlayers.forEach((player) => {
        const ans = answers[player.player_id];
        if (!majorityAnswers.includes(ans)) {
          newScores[player.player_id]--;
        }
      });

      if (majorityAnswers.length === 0) {
        alivePlayers.forEach((p) => {
          newScores[p.player_id]--;
        });
      }
    }

    // Eliminate at -5
    players.forEach((p) => {
      if (newScores[p.player_id] <= -5) {
        newEliminated.push(p.player_id);
      }
    });

    push({
      reveal: true,
      scores: newScores,
      eliminated: newEliminated,
    });
  };

  const nextRound = () => {
    if (alivePlayers.length <= 1) {
      return onEndGame();
    }

    push({
      round: herd.round + 1,
      topic: randomTopic(),
      answers: {},
      reveal: false,
      computerWord: alivePlayers.length === 2 ? randomWord(herd.topic) : null,
    });
  };

  function push(patch: any) {
    onUpdateState({ herd: { ...herd, ...patch } });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-100 p-6 text-center">
      <h1 className="text-4xl font-black text-pink-600 mb-2">🐮 HERD MENTALITY</h1>
      <p className="text-gray-600">Round {herd.round} — Topic: <span className="font-bold capitalize">{herd.topic}</span></p>

      {/* Answer Field */}
      {!herd.reveal && !herd.eliminated.includes(currentPlayer.player_id) && (
        <div className="mt-6">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!!myAnswer}
            placeholder="Your answer..."
            className="border-2 p-3 rounded-lg w-1/2 focus:ring-2 focus:outline-none text-center"
          />
          <button
            onClick={submitAnswer}
            disabled={!input.trim() || !!myAnswer}
            className="mt-3 block mx-auto bg-pink-500 hover:bg-pink-600 text-white px-6 py-2 rounded-xl"
          >
            {myAnswer ? "✔ Answered" : "Submit Answer"}
          </button>
          <p className="mt-2 text-gray-500">
            {Object.keys(herd.answers).length}/{alivePlayers.length} answered
          </p>
          {isHost && allAnswered && (
            <button
              onClick={evaluateRound}
              className="mt-4 bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-lg font-semibold"
            >
              Reveal Answers ➜
            </button>
          )}
        </div>
      )}

      {/* Reveal Phase */}
      {herd.reveal && (
        <div className="mt-8 max-w-lg mx-auto bg-white rounded-2xl p-6 shadow-xl">
          <h2 className="text-2xl font-bold text-indigo-700">📜 Answers</h2>

          {alivePlayers.length === 2 && herd.computerWord && (
            <p className="text-sm text-gray-600 mt-2">
              🤖 <b>Computer’s Answer:</b> {herd.computerWord}
            </p>
          )}

          {players.map((p) => (
            <p
              key={p.player_id}
              className={`mt-2 ${herd.eliminated.includes(p.player_id) ? "line-through text-gray-400" : ""}`}
            >
              <b>{p.name}</b>: {herd.answers[p.player_id] || "—"} (
              <span className={`font-semibold ${herd.scores[p.player_id] <= -3 ? "text-red-600" : "text-gray-700"}`}>
                {herd.scores[p.player_id]}
              </span>
              )
            </p>
          ))}

          <button
            onClick={nextRound}
            className="mt-5 bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded-xl font-bold"
          >
            {alivePlayers.length <= 1 ? "🏁 End Game" : "Next Round ➜"}
          </button>
        </div>
      )}
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
