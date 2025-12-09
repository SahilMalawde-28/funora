import { useState } from "react";
import {
  Sparkles,
  Users,
  Plus,
  Globe2,
  UserCircle,
  Gamepad2,
  ChevronRight,
} from "lucide-react";
import { AVATARS } from "../lib/gameLogic";

interface HomeProps {
  onCreateRoom: (name: string, avatar: string) => void;
  onJoinRoom: (code: string, name: string, avatar: string) => void;
}

type View = "home" | "create" | "join";

export default function Home({ onCreateRoom, onJoinRoom }: HomeProps) {
  const [view, setView] = useState<View>("home");

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
    if (!roomCode || !name.trim()) return;
    setLoading(true);
    try {
      await onJoinRoom(roomCode.toUpperCase(), name, avatar);
    } catch {
      alert("Room not found!");
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // MAIN LANDING PAGE (CLEAN, MODERN, MINIMAL)
  // --------------------------------------------------
  if (view === "home") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-6 py-10">
        <div className="max-w-3xl mx-auto space-y-12">

          {/* HEADER */}
          <div className="text-center space-y-4">
            <Sparkles className="w-20 h-20 text-indigo-500 mx-auto animate-pulse" />
            <h1 className="text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              Funora
            </h1>
            <p className="text-lg text-gray-600">
              Fast party games. Zero setup. Pure chaos.
            </p>
          </div>

          {/* MAIN ACTIONS */}
          <div className="space-y-4">
            <MainButton
              label="Create Room"
              icon={<Plus className="w-6 h-6" />}
              onClick={() => setView("create")}
              mode="primary"
            />
            <MainButton
              label="Join Room"
              icon={<Users className="w-6 h-6" />}
              onClick={() => setView("join")}
              mode="secondary"
            />
          </div>

          {/* FEATURE CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">

            <FeatureCard
              icon={<UserCircle className="w-7 h-7 text-indigo-500" />}
              title="Profiles"
              desc="Your identity across all games."
            />

            <FeatureCard
              icon={<Users className="w-7 h-7 text-indigo-500" />}
              title="Groups"
              desc="Permanent squads with chat."
            />

            <FeatureCard
              icon={<Globe2 className="w-7 h-7 text-indigo-500" />}
              title="Public Rooms"
              desc="Jump into open games anytime."
            />

          </div>

          {/* GAME STRIP */}
          <div>
            <p className="text-sm text-gray-500 mb-3 text-center">Popular Games</p>

            <div className="flex overflow-x-auto gap-3 pb-2 justify-center">
              <GamePill emoji="🕵️" label="Imposter" />
              <GamePill emoji="🎭" label="Bluff & Truth" />
              <GamePill emoji="📊" label="Wavelength" />
              <GamePill emoji="🦎" label="Chameleon" />
              <GamePill emoji="⚡" label="Rapid Fire" />
              <GamePill emoji="🃏" label="Grid GOAT" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // CREATE ROOM
  // --------------------------------------------------
  if (view === "create") {
    return (
      <EntryCard
        title="Create Room"
        subtitle="Set your name and avatar"
        name={name}
        avatar={avatar}
        roomCode=""
        loading={loading}
        setName={setName}
        setAvatar={setAvatar}
        setRoomCode={() => {}}
        onSubmit={handleCreate}
        onBack={() => setView("home")}
        buttonLabel="Create Room"
      />
    );
  }

  // --------------------------------------------------
  // JOIN ROOM
  // --------------------------------------------------
  return (
    <EntryCard
      title="Join Room"
      subtitle="Enter a room code"
      name={name}
      avatar={avatar}
      roomCode={roomCode}
      loading={loading}
      setName={setName}
      setAvatar={setAvatar}
      setRoomCode={setRoomCode}
      onSubmit={handleJoin}
      onBack={() => setView("home")}
      buttonLabel="Join Room"
    />
  );
}

// --------------------------------------------------
// COMPONENTS — CLEAN & REUSABLE
// --------------------------------------------------

function MainButton({
  label,
  icon,
  onClick,
  mode,
}: {
  label: string;
  icon: JSX.Element;
  onClick: () => void;
  mode: "primary" | "secondary";
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full py-5 rounded-2xl text-lg font-bold flex items-center justify-center gap-3 transition shadow-lg ${
        mode === "primary"
          ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:scale-[1.04]"
          : "bg-white border-2 border-gray-200 text-gray-800 hover:scale-[1.03]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: JSX.Element;
  title: string;
  desc: string;
}) {
  return (
    <div className="p-5 bg-white rounded-3xl shadow-md hover:shadow-lg transition border border-gray-100 flex flex-col gap-3">
      <div className="bg-indigo-50 w-12 h-12 rounded-xl flex items-center justify-center">
        {icon}
      </div>
      <div>
        <h3 className="font-bold text-gray-800">{title}</h3>
        <p className="text-sm text-gray-500">{desc}</p>
      </div>
    </div>
  );
}

function GamePill({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="px-4 py-2 text-sm bg-gray-100 border border-gray-200 rounded-full flex items-center gap-2 whitespace-nowrap">
      <span>{emoji}</span>
      <span className="text-gray-700 font-medium">{label}</span>
    </div>
  );
}

/* -----------------------------
    CREATE / JOIN CARD
------------------------------*/
function EntryCard({
  title,
  subtitle,
  name,
  avatar,
  roomCode,
  loading,
  setName,
  setAvatar,
  setRoomCode,
  onSubmit,
  onBack,
  buttonLabel,
}: any) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 space-y-6 border border-gray-100">

        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 font-medium">
          ← Back
        </button>

        <h2 className="text-3xl font-black text-gray-800">{title}</h2>
        <p className="text-sm text-gray-500">{subtitle}</p>

        <div className="space-y-5">

          {/* Name */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Your Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none text-lg"
            />
          </div>

          {/* Avatar selection */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Choose Avatar
            </label>
            <div className="grid grid-cols-8 gap-2">
              {AVATARS.map((em: string) => (
                <button
                  key={em}
                  onClick={() => setAvatar(em)}
                  className={`text-3xl p-2 rounded-xl transition ${
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

          {/* Room Code (only for join) */}
          {setRoomCode && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Room Code</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Enter room code"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none text-lg uppercase tracking-widest text-center font-bold"
                maxLength={6}
              />
            </div>
          )}

          <button
            onClick={onSubmit}
            disabled={loading || !name.trim()}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:scale-105 transition disabled:opacity-50"
          >
            {loading ? "Loading..." : buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
