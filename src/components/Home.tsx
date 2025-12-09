import { useState } from "react";
import {
  Sparkles,
  Users,
  Plus,
  PartyPopper,
  MessageCircle,
  Star,
} from "lucide-react";
import { AVATARS } from "../lib/gameLogic";
import { GAMES } from "../lib/gameLogic"; 

interface HomeProps {
  onCreateRoom: (name: string, avatar: string) => void;
  onJoinRoom: (code: string, name: string, avatar: string) => void;
}

export default function Home({ onCreateRoom, onJoinRoom }: HomeProps) {
  const [mode, setMode] = useState<"menu" | "create" | "join">("menu");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onCreateRoom(name, avatar);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!name.trim() || !roomCode.trim()) return;
    setLoading(true);
    try {
      await onJoinRoom(roomCode.toUpperCase(), name, avatar);
    } catch (err) {
      alert("Room not found!");
      setLoading(false);
    }
  };

  // =========================
  // LANDING PAGE UI
  // =========================
  if (mode === "menu") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full space-y-12">
          {/* HEADER */}
          <div className="text-center space-y-4">
            <div className="relative flex justify-center">
              <Sparkles className="w-24 h-24 text-indigo-500 animate-pulse drop-shadow-xl" />
              <div className="absolute inset-0 bg-indigo-400 blur-3xl opacity-20"></div>
            </div>

            <h1 className="text-7xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent drop-shadow-sm">
              Funora
            </h1>

            <p className="text-xl text-gray-600 font-medium">
              Multiplayer party chaos for you & your friends 🎉
            </p>
          </div>

          {/* MAIN BUTTONS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
            <button
              onClick={() => setMode("create")}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white py-6 rounded-3xl font-bold text-xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center gap-3"
            >
              <Plus className="w-7 h-7" />
              Create Room
            </button>

            <button
              onClick={() => setMode("join")}
              className="w-full bg-white text-gray-800 py-6 rounded-3xl font-bold text-xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all border-2 border-gray-200 hover:border-indigo-300 flex items-center justify-center gap-3"
            >
              <Users className="w-7 h-7" />
              Join Room
            </button>
          </div>

          {/* FEATURE PREVIEW */}
          <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl shadow-lg border border-gray-200 mt-10">
            <h3 className="text-center text-lg font-bold text-gray-700 mb-4">
              🚀 Big Upgrades Coming to Funora
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <Feature
                icon={<Star />}
                label="Profiles"
                desc="Permanent identity across games"
              />
              <Feature
                icon={<MessageCircle />}
                label="Group Chat"
                desc="Talk with your squad"
              />
              <Feature
                icon={<Users />}
                label="Communities"
                desc="Create your own friend groups"
              />
              <Feature
                icon={<PartyPopper />}
                label="Party Mode"
                desc="5-game tournament mode"
              />
            </div>
          </div>

          {/* POPULAR GAMES */}
          <div className="pt-10 text-center">
            <p className="text-sm text-gray-500 font-medium">Popular Games</p>

            <div className="flex flex-wrap justify-center text-lg gap-4 mt-3">
              <GameTag emoji="🕵️" label="Guess the Imposter" />
              <GameTag emoji="🎭" label="Bluff & Truth" />
              <GameTag emoji="📊" label="Wavelength" />
              <GameTag emoji="🦎" label="Chameleon" />
              <GameTag emoji="⚡" label="Chain Rapid Fire" />
              <GameTag emoji="🔤" label="Word Guess" />
            </div>
          </div>

          {/* ALL GAMES GRID */}
          <div className="pt-10">
            <h3 className="text-center text-lg font-bold text-gray-700 mb-4">
              🎮 All Funora Games
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              {GAMES.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white shadow border border-gray-200 hover:shadow-md hover:scale-[1.02] transition"
                >
                  <div className="text-3xl">{g.emoji}</div>
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{g.name}</p>
                    <p className="text-xs text-gray-500">{g.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================
  // CREATE / JOIN FORM
  // =========================
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 space-y-6 border border-gray-100">
        <button
          onClick={() => setMode("menu")}
          className="text-gray-500 hover:text-gray-700 font-medium mb-2"
        >
          ← Back
        </button>

        <h2 className="text-3xl font-black text-gray-800">
          {mode === "create" ? "Create Room" : "Join Room"}
        </h2>

        <div className="space-y-5">
          {/* NAME */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none transition-colors text-lg"
              maxLength={20}
            />
          </div>

          {/* AVATAR */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Choose Avatar
            </label>

            <div className="grid grid-cols-8 gap-2">
              {AVATARS.map((em) => (
                <button
                  key={em}
                  onClick={() => setAvatar(em)}
                  className={`text-3xl p-2 rounded-xl transition-all ${
                    avatar === em
                      ? "bg-indigo-100 ring-2 ring-indigo-500 scale-110"
                      : "bg-gray-50 hover:bg-gray-100"
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* ROOM CODE (JOIN MODE) */}
          {mode === "join" && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Room Code
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Enter 6-digit code"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none transition-colors text-lg uppercase text-center tracking-wider font-bold"
                maxLength={6}
              />
            </div>
          )}

          {/* SUBMIT BUTTON */}
          <button
            onClick={mode === "create" ? handleCreate : handleJoin}
            disabled={
              loading || !name.trim() || (mode === "join" && roomCode.length !== 6)
            }
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition disabled:opacity-50 disabled:scale-100"
          >
            {loading ? "Loading…" : mode === "create" ? "Create Room" : "Join Room"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ========================================
// SUPPORTING COMPONENTS
// ========================================
function Feature({
  icon,
  label,
  desc,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-200 hover:bg-gray-100 transition">
      <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
        {icon}
      </div>
      <div>
        <p className="font-bold text-gray-700 text-sm">{label}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
    </div>
  );
}

function GameTag({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="px-4 py-2 bg-gray-50 rounded-full border border-gray-200 text-sm flex items-center gap-2 shadow-sm">
      <span className="text-lg">{emoji}</span>
      <span className="font-medium text-gray-700">{label}</span>
    </div>
  );
}
