import { useState, useEffect } from "react";
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
  Pencil,
  ArrowLeft,
} from "lucide-react";
import { AVATARS } from "../lib/gameLogic";

interface HomeProps {
  onCreateRoom: (name: string, avatar: string) => void;
  onJoinRoom: (code: string, name: string, avatar: string) => void;
}

export default function Home({ onCreateRoom, onJoinRoom }: HomeProps) {
  /* ----------------------------
       PROFILE MANAGEMENT LOGIC
  ---------------------------- */
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem("funora_profile");
    return saved ? JSON.parse(saved) : null;
  });

  const [profileName, setProfileName] = useState(profile?.name || "");
  const [profileAvatar, setProfileAvatar] = useState(profile?.avatar || AVATARS[0]);

  const [editProfileModal, setEditProfileModal] = useState(false);

  const saveProfile = () => {
    const newProfile = {
      id: profile?.id || crypto.randomUUID(),
      name: profileName.trim(),
      avatar: profileAvatar,
      created_at: profile?.created_at || new Date().toISOString(),
    };
    localStorage.setItem("funora_profile", JSON.stringify(newProfile));
    setProfile(newProfile);
    setEditProfileModal(false);
  };

  // Force profile setup on very first visit
  useEffect(() => {
    if (!profile) {
      setEditProfileModal(true);
    }
  }, []);

  /* ----------------------------
       VIEW STATE HANDLING
  ---------------------------- */
  const [view, setView] = useState<"home" | "create" | "join" | "profile">("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* ----------------------------
          ROOM ACTIONS
  ---------------------------- */
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!profile) return alert("Create your profile first!");
    setLoading(true);
    await onCreateRoom(profile.name, profile.avatar);
  };

  const handleJoin = async () => {
    if (!profile) return alert("Create your profile first!");
    if (roomCode.length !== 6) return;
    setLoading(true);
    try {
      await onJoinRoom(roomCode.toUpperCase(), profile.name, profile.avatar);
    } catch {
      alert("Room not found!");
      setLoading(false);
    }
  };

  /* ----------------------------
         MAIN COMPONENT RETURN
  ---------------------------- */
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">

      {/* ---------- SIDEBAR (DESKTOP) ---------- */}
      <div className="hidden md:flex flex-col bg-white/80 backdrop-blur-xl shadow-xl border-r border-gray-200 w-20 hover:w-64 transition-all duration-300 group">

        <div className="p-6 flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-indigo-600" />
          <span className="text-xl font-black text-indigo-700 opacity-0 group-hover:opacity-100 transition">
            Funora
          </span>
        </div>

        <MenuItem icon={<Users />} label="Join Room" onClick={() => setView("join")} />
        <MenuItem icon={<Plus />} label="Create Room" onClick={() => setView("create")} />

        {/* PROFILE BUTTON */}
        <MenuItem
          icon={<UserCircle />}
          label="Profile"
          onClick={() => setView("profile")}
        />

        <MenuItem icon={<Globe2 />} label="Public Rooms" disabled />
        <MenuItem icon={<Gamepad2 />} label="Party Mode" disabled />

        <div className="mt-auto mb-6">
          <MenuItem icon={<LogOut />} label="Logout" disabled />
        </div>
      </div>

      {/* ---------- MOBILE SIDEBAR ---------- */}
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
            <MobileMenuItem label="Profile" icon={<UserCircle />} onClick={() => {setView("profile"); setSidebarOpen(false);}} />

            <MobileMenuItem label="Public Rooms" icon={<Globe2 />} disabled />
            <MobileMenuItem label="Party Mode" icon={<Gamepad2 />} disabled />
          </div>
        </div>
      )}

      {/* ---------- MAIN CONTENT ---------- */}
      <div className="flex-1 flex items-center justify-center p-10">

        {view === "home" && <HomeContent setView={setView} />}

        {view === "create" && (
          <CreateJoinCard
            title="Create Room"
            loading={loading}
            onSubmit={handleCreate}
            onBack={() => setView("home")}
            buttonText="Create Room"
          />
        )}

        {view === "join" && (
          <CreateJoinCard
            title="Join Room"
            loading={loading}
            roomCode={roomCode}
            setRoomCode={setRoomCode}
            onSubmit={handleJoin}
            onBack={() => setView("home")}
            buttonText="Join Room"
          />
        )}

        {/* ---------- PROFILE PAGE ---------- */}
        {view === "profile" && profile && (
          <ProfilePage
            profile={profile}
            onEdit={() => {
              setProfileName(profile.name);
              setProfileAvatar(profile.avatar);
              setEditProfileModal(true);
            }}
            onBack={() => setView("home")}
          />
        )}
      </div>

      {/* ---------- EDIT PROFILE MODAL ---------- */}
      {editProfileModal && (
        <ProfileEditModal
          profileName={profileName}
          profileAvatar={profileAvatar}
          setProfileName={setProfileName}
          setProfileAvatar={setProfileAvatar}
          onSave={saveProfile}
          onClose={() => setEditProfileModal(false)}
        />
      )}
    </div>
  );
}

/* ----------------------------------------------
   PROFILE PAGE COMPONENT
---------------------------------------------- */
function ProfilePage({ profile, onEdit, onBack }) {
  return (
    <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl p-10 space-y-8 border border-gray-200 text-center">

      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-800">
        <ArrowLeft className="w-5 h-5" /> Back
      </button>

      <div className="text-7xl">{profile.avatar}</div>

      <h2 className="text-4xl font-black">{profile.name}</h2>

      <p className="text-gray-500">Member since: {new Date(profile.created_at).toDateString()}</p>

      {/* STATS (placeholder for now) */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <StatCard label="Games" value="–" />
        <StatCard label="Wins" value="–" />
        <StatCard label="XP" value="–" />
      </div>

      <button
        onClick={onEdit}
        className="w-full bg-indigo-500 text-white py-4 rounded-xl font-bold hover:scale-105 transition flex items-center justify-center gap-2"
      >
        <Pencil className="w-5 h-5" /> Edit Profile
      </button>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="p-4 bg-gray-100 rounded-2xl shadow-inner">
      <div className="text-2xl font-black">{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}

/* ----------------------------------------------
   EDIT PROFILE MODAL
---------------------------------------------- */
function ProfileEditModal({
  profileName,
  profileAvatar,
  setProfileName,
  setProfileAvatar,
  onSave,
  onClose,
}) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md space-y-6">

        <h2 className="text-3xl font-black text-gray-800">Edit Profile</h2>

        <input
          value={profileName}
          onChange={(e) => setProfileName(e.target.value)}
          placeholder="Your Name"
          className="w-full border-2 rounded-xl px-4 py-3"
        />

        <label className="font-bold text-sm text-gray-600">Choose Avatar</label>
        <div className="grid grid-cols-8 gap-2">
          {AVATARS.map((em) => (
            <button
              key={em}
              onClick={() => setProfileAvatar(em)}
              className={`text-3xl p-2 rounded-xl ${
                profileAvatar === em ? "bg-indigo-100 ring-2 ring-indigo-500 scale-110" : "bg-gray-50"
              }`}
            >
              {em}
            </button>
          ))}
        </div>

        <button
          onClick={onSave}
          disabled={!profileName.trim()}
          className="w-full bg-indigo-500 text-white py-4 rounded-xl font-bold hover:scale-105 transition"
        >
          Save
        </button>

        <button
          onClick={onClose}
          className="w-full py-3 text-gray-500 font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ----------------------------------------------
   EXISTING UI COMPONENTS (UNCHANGED)
---------------------------------------------- */

function MenuItem({ icon, label, onClick, disabled = false }) {
  return (
    <button
      onClick={!disabled ? onClick : undefined}
      className={`flex items-center gap-4 px-6 py-4 hover:bg-indigo-50 transition ${
        disabled ? "opacity-40 cursor-not-allowed" : ""
      }`}
    >
      <div className="w-8 h-8 flex items-center justify-center text-indigo-600">{icon}</div>
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

/* HERO + FEATURE SECTION UNCHANGED */
function HomeContent({ setView }) {
  return (
    <div className="max-w-3xl mx-auto text-center space-y-10">

      <div className="space-y-4">
        <Sparkles className="w-20 h-20 text-indigo-600 mx-auto animate-pulse" />
        <h1 className="text-6xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Funora
        </h1>
        <p className="text-lg text-gray-600">Party games, made effortless.</p>
      </div>

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <FeatureCard title="Profiles" desc="Permanent identity" />
        <FeatureCard title="Groups" desc="Your squads (coming soon)" />
        <FeatureCard title="Public Rooms" desc="Join open lobbies" />
      </div>

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
        disabled={loading}
        className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white py-4 rounded-xl font-bold hover:scale-105 transition"
      >
        {loading ? "Loading…" : buttonText}
      </button>
    </div>
  );
}
