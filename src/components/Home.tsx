import { useState } from "react";
import {
  Menu,
  Sparkles,
  Users,
  LogOut,
  Plus,
  UserCircle,
  Globe2,
  Gamepad2,
  X,
} from "lucide-react";
import { AVATARS } from "../lib/gameLogic";

interface HomeProps {
  onCreateRoom: (name: string, avatar: string) => void;
  onJoinRoom: (code: string, name: string, avatar: string) => void;
}

export default function Home({ onCreateRoom, onJoinRoom }: HomeProps) {
  const [view, setView] = useState<"home" | "create" | "join">("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onCreateRoom(name, avatar);
    } catch {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!name.trim() || roomCode.length !== 6) return;
    setLoading(true);
    try {
      await onJoinRoom(roomCode.toUpperCase(), name, avatar);
    } catch {
      alert("Room not found!");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">

      {/* ----------------------------- */}
      {/* DESKTOP SIDEBAR */}
      {/* ----------------------------- */}
      <div className="hidden md:flex flex-col bg-white/80 backdrop-blur-xl shadow-xl border-r border-gray-200 w-20 hover:w-64 transition-all duration-300 group">

        {/* Logo */}
        <div className="p-6 flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-indigo-600" />
          <span className="text-xl font-black text-indigo-700 opacity-0 group-hover:opacity-100 transition">
            Funora
          </span>
        </div>

        {/* Menu */}
        <MenuItem
          icon={<Users />}
          label="Join Room"
          onClick={() => setView("join")}
        />
        <MenuItem
          icon={<Plus />}
          label="Create Room"
          onClick={() => setView("create")}
        />
        <MenuItem
          icon={<UserCircle />}
          label="Profiles"
          disabled
        />
        <MenuItem
          icon={<Globe2 />}
          label="Public Rooms"
          disabled
        />
        <MenuItem
          icon={<Gamepad2 />}
          label="Party Mode"
          disabled
        />

        <div className="mt-auto mb-6">
          <MenuItem icon={<LogOut />} label="Logout" disabled />
        </div>
      </div>

      {/* ----------------------------- */}
      {/* MOBILE OVERLAY SIDEBAR */}
      {/* ----------------------------- */}
      <div className="md:hidden p-4 absolute">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-3 bg-white shadow-lg rounded-xl"
        >
          <Menu className="w-6 h-6 text-gray-700" />
        </button>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden">
          <div className="absolute left-0 top-0 h-full w-72 bg-white p-6 space-y-6 shadow-xl rounded-r-3xl">

            <div className="flex justify-between items-center mb-4">
              <h2 className="font-black text-xl">Menu</h2>
              <button onClick={() => setSidebarOpen(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>

            <MobileMenuItem label="Create Room" icon={<Plus />} onClick={() => {setView("create"); setSidebarOpen(false);}} />
            <MobileMenuItem label="Join Room" icon={<Users />} onClick={() => {setView("join"); setSidebarOpen(false);}} />
            <MobileMenuItem label="Profiles" icon={<UserCircle />} disabled />
            <MobileMenuItem label="Public Rooms" icon={<Globe2 />} disabled />
            <MobileMenuItem label="Party Mode" icon={<Gamepad2 />} disabled />

          </div>
        </div>
      )}

      {/* ----------------------------- */}
      {/* MAIN CONTENT AREA */}
      {/* ----------------------------- */}
      <div className="flex-1 flex items-center justify-center p-10">

        {view === "home" && <HomeContent setView={setView} />}

        {view === "create" && (
          <CreateJoinCard
            title="Create Room"
            name={name}
            avatar={avatar}
            loading={loading}
            setName={setName}
            setAvatar={setAvatar}
            onSubmit={handleCreate}
            onBack={() => setView("home")}
            buttonText="Create Room"
          />
        )}

        {view === "join" && (
          <CreateJoinCard
            title="Join Room"
            name={name}
            avatar={avatar}
            loading={loading}
            setName={setName}
            setAvatar={setAvatar}
            roomCode={roomCode}
            setRoomCode={setRoomCode}
            onSubmit={handleJoin}
            onBack={() => setView("home")}
            buttonText="Join Room"
          />
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------- */
/* COMPONENTS */
/* ----------------------------------------- */

function MenuItem({ icon, label, onClick, disabled = false }) {
  return (
    <button
      onClick={!disabled ? onClick : undefined}
      className={`flex items-center gap-4 px-6 py-4 hover:bg-indigo-50 transition ${
        disabled ? "opacity-40 cursor-not-allowed" : ""
      }`}
    >
      <div className="w-8 h-8 flex items-center justify-center text-indigo-600">
        {icon}
      </div>
      <span className="font-semibold text-gray-700 opacity-0 group-hover:opacity-100 transition">
        {label}
      </span>
    </button>
  );
}

function MobileMenuItem({ icon, label, onClick, disabled = false }) {
  return (
    <button
      disabled={disabled}
      onClick={!disabled ? onClick : undefined}
      className={`flex items-center gap-3 p-3 rounded-xl ${
        disabled ? "opacity-40" : "hover:bg-gray-100"
      }`}
    >
      <div className="w-9 h-9 bg-indigo-100 text-indigo-600 flex items-center justify-center rounded-xl">
        {icon}
      </div>
      <span className="text-gray-700 font-medium">{label}</span>
    </button>
  );
}

function HomeContent({ setView }) {
  return (
    <div className="max-w-3xl mx-auto text-center space-y-10">

      {/* HERO */}
      <div className="space-y-4">
        <Sparkles className="w-20 h-20 text-indigo-600 mx-auto animate-pulse" />
        <h1 className="text-6xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Funora
        </h1>
        <p className="text-lg text-gray-600">Party games, made effortless.</p>
      </div>

      {/* ACTION BUTTONS */}
      <div className="flex flex-col gap-4 max-w-md mx-auto">
        <button
          onClick={() => setView("create")}
          className="w-full py-5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold text-lg rounded-2xl shadow-lg hover:scale-105 transition"
        >
          Create Room
        </button>

        <button
          onClick={() => setView("join")}
          className="w-full py-5 bg-white border-2 border-gray-200 text-lg font-bold rounded-2xl shadow hover:scale-105 transition"
        >
          Join Room
        </button>
      </div>

      {/* FEATURE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <FeatureCard title="Profiles" desc="Permanent identity" />
        <FeatureCard title="Groups" desc="Your squads (coming soon)" />
        <FeatureCard title="Public Rooms" desc="Join open lobbies" />
      </div>

      {/* GAMES LIST */}
      <div>
        <p className="text-sm text-gray-500 mb-2">Popular Games</p>
        <div className="flex justify-center flex-wrap gap-3">
          <GamePill emoji="🕵️" label="Imposter" />
          <GamePill emoji="🎭" label="Bluff" />
          <GamePill emoji="📊" label="Wavelength" />
          <GamePill emoji="⚡" label="Rapid Fire" />
          <GamePill emoji="🃏" label="Grid GOAT" />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ title, desc }) {
  return (
    <div className="p-6 rounded-3xl bg-white shadow-md border border-gray-100 text-left">
      <h3 className="font-bold text-gray-800 text-lg">{title}</h3>
      <p className="text-sm text-gray-500 mt-1">{desc}</p>
    </div>
  );
}

function GamePill({ emoji, label }) {
  return (
    <div className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-full flex items-center gap-2">
      <span>{emoji}</span>
      <span className="text-gray-700 font-medium">{label}</span>
    </div>
  );
}

function CreateJoinCard({
  title,
  name,
  avatar,
  setName,
  setAvatar,
  roomCode,
  setRoomCode,
  loading,
  onSubmit,
  onBack,
  buttonText,
}) {
  return (
    <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 space-y-6 border border-gray-200">

      <button onClick={onBack} className="text-gray-500 hover:text-gray-700">
        ← Back
      </button>

      <h2 className="text-3xl font-black text-gray-800">{title}</h2>

      <label className="block text-sm font-bold">Your Name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full border-2 rounded-xl px-4 py-3"
      />

      <label className="block text-sm font-bold">Choose Avatar</label>
      <div className="grid grid-cols-8 gap-2">
        {AVATARS.map((em) => (
          <button
            key={em}
            onClick={() => setAvatar(em)}
            className={`text-3xl p-2 rounded-xl ${
              avatar === em ? "bg-indigo-100 ring-2 ring-indigo-500 scale-110" : "bg-gray-50"
            }`}
          >
            {em}
          </button>
        ))}
      </div>

      {setRoomCode && (
        <>
          <label className="block text-sm font-bold">Room Code</label>
          <input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="w-full border-2 rounded-xl px-4 py-3 text-center font-bold tracking-widest"
          />
        </>
      )}

      <button
        onClick={onSubmit}
        disabled={loading || !name.trim()}
        className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white py-4 rounded-xl font-bold hover:scale-105 transition"
      >
        {loading ? "Loading…" : buttonText}
      </button>
    </div>
  );
}
