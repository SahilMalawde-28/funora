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
  MessageCircle,
  Group,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { AVATARS } from "../lib/gameLogic";

interface HomeProps {
  onCreateRoom: (name: string, avatar: string) => void;
  onJoinRoom: (code: string, name: string, avatar: string) => void;
  profile: any;
}

export default function Home({ onCreateRoom, onJoinRoom, profile }: HomeProps) {
  const [view, setView] = useState<
    "home" | "create" | "join" | "profile" | "public" | "groups"
  >("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);

  // Public rooms
  const [publicRooms, setPublicRooms] = useState<any[]>([]);
  const [publicLoading, setPublicLoading] = useState(false);

  // Groups
  const [groups, setGroups] = useState<any[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  // Profile edit modal
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [profileName, setProfileName] = useState(profile?.name || "");
  const [profileAvatar, setProfileAvatar] = useState(profile?.avatar || "🙂");

  useEffect(() => {
    if (profile) {
      setProfileName(profile.name);
      setProfileAvatar(profile.avatar);
    }
  }, [profile]);

  /* ============================================
     SAVE PROFILE
  ============================================ */
  const saveProfile = async () => {
    if (!profile) return;

    const updated = {
      name: profileName.trim(),
      avatar: profileAvatar,
    };

    const newProfile = { ...profile, ...updated };
    localStorage.setItem("funora_profile", JSON.stringify(newProfile));

    await supabase.from("profiles").update(updated).eq("id", profile.id);

    setEditProfileModal(false);
    window.location.reload();
  };

  /* ============================================
     CREATE ROOM
  ============================================ */
  const handleCreate = async () => {
    if (!profile) return alert("Profile missing!");
    setLoading(true);
    await onCreateRoom(profile.name, profile.avatar);
    setLoading(false);
  };

  /* ============================================
     JOIN ROOM
  ============================================ */
  const handleJoin = async () => {
    if (!profile) return alert("Profile missing!");
    if (roomCode.length !== 6) return alert("Enter 6-digit code!");

    setLoading(true);

    try {
      await onJoinRoom(roomCode.toUpperCase(), profile.name, profile.avatar);
    } catch {
      alert("Room not found");
      setLoading(false);
    }
  };

  const handleJoinPublicRoom = async (code: string) => {
    if (!profile) return alert("Profile missing!");
    setLoading(true);
    try {
      await onJoinRoom(code.toUpperCase(), profile.name, profile.avatar);
    } catch {
      alert("Failed to join room");
      setLoading(false);
    }
  };

  /* ============================================
     PUBLIC ROOMS
  ============================================ */
  const loadPublicRooms = async () => {
    setPublicLoading(true);

    const { data } = await supabase
      .from("rooms")
      .select("*")
      .eq("flag", "public")
      .eq("status", "lobby")
      .order("created_at", { ascending: false });

    setPublicRooms(data || []);
    setPublicLoading(false);
  };

  useEffect(() => {
    if (view === "public") loadPublicRooms();
  }, [view]);

  /* ============================================
     GROUPS SYSTEM
  ============================================ */

  // Fetch user groups
  const loadGroups = async () => {
    if (!profile) return;
    setGroupsLoading(true);

    const { data } = await supabase
      .from("group_members")
      .select("group_id, groups(*)")
      .eq("profile_id", profile.id);

    setGroups(data || []);
    setGroupsLoading(false);
  };

  useEffect(() => {
    if (view === "groups") loadGroups();
  }, [view]);

  /* ============================================
     MAIN RETURN
  ============================================ */
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* DESKTOP SIDEBAR */}
      <Sidebar setView={setView} />

      {/* MOBILE MENU BUTTON */}
      <MobileMenuButton setSidebarOpen={setSidebarOpen} />

      {/* MOBILE SIDEBAR */}
      <MobileSidebar
        open={sidebarOpen}
        setOpen={setSidebarOpen}
        setView={setView}
      />

      {/* MAIN CONTENT */}
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

        {view === "profile" && profile && (
          <ProfilePage
            profile={profile}
            onEdit={() => setEditProfileModal(true)}
            onBack={() => setView("home")}
          />
        )}

        {view === "public" && (
          <PublicRoomsView
            loading={publicLoading}
            rooms={publicRooms}
            onRefresh={loadPublicRooms}
            onJoin={handleJoinPublicRoom}
            onBack={() => setView("home")}
          />
        )}

        {view === "groups" && (
          <GroupsView
            groups={groups}
            loading={groupsLoading}
            onReload={loadGroups}
            profile={profile}
            onBack={() => setView("home")}
          />
        )}
      </div>

      {/* PROFILE EDIT MODAL */}
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

/* ======================================================
   COMPONENTS BELOW
====================================================== */

function Sidebar({ setView }) {
  return (
    <div className="hidden md:flex flex-col bg-white/80 backdrop-blur-xl shadow-xl border-r border-gray-200 w-20 hover:w-64 transition-all duration-300 group">
      <div className="p-6 flex items-center gap-3">
        <Sparkles className="w-8 h-8 text-indigo-600" />
        <span className="text-xl font-black text-indigo-700 opacity-0 group-hover:opacity-100 transition">
          Funora
        </span>
      </div>

      <SidebarItem icon={<Users />} label="Join Room" onClick={() => setView("join")} />
      <SidebarItem icon={<Plus />} label="Create Room" onClick={() => setView("create")} />
      <SidebarItem icon={<UserCircle />} label="Profile" onClick={() => setView("profile")} />
      <SidebarItem icon={<Globe2 />} label="Public Rooms" onClick={() => setView("public")} />
      <SidebarItem icon={<Group />} label="Groups" onClick={() => setView("groups")} />

      <div className="mt-auto mb-6">
        <SidebarItem icon={<LogOut />} label="Logout" disabled />
      </div>
    </div>
  );
}

function SidebarItem({ icon, label, onClick, disabled = false }) {
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

function MobileMenuButton({ setSidebarOpen }) {
  return (
    <div className="md:hidden p-4 absolute">
      <button
        onClick={() => setSidebarOpen(true)}
        className="p-3 bg-white shadow-lg rounded-xl"
      >
        <Menu className="w-6 h-6 text-gray-700" />
      </button>
    </div>
  );
}

function MobileSidebar({ open, setOpen, setView }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden">
      <div className="absolute left-0 top-0 h-full w-72 bg-white p-6 space-y-6 shadow-xl rounded-r-3xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-black text-xl">Menu</h2>
          <button onClick={() => setOpen(false)}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <MobileSidebarItem label="Create Room" icon={<Plus />} onClick={() => { setView("create"); setOpen(false); }} />
        <MobileSidebarItem label="Join Room" icon={<Users />} onClick={() => { setView("join"); setOpen(false); }} />
        <MobileSidebarItem label="Profile" icon={<UserCircle />} onClick={() => { setView("profile"); setOpen(false); }} />
        <MobileSidebarItem label="Public Rooms" icon={<Globe2 />} onClick={() => { setView("public"); setOpen(false); }} />
        <MobileSidebarItem label="Groups" icon={<Group />} onClick={() => { setView("groups"); setOpen(false); }} />
      </div>
    </div>
  );
}

function MobileSidebarItem({ icon, label, onClick }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100">
      <div className="w-9 h-9 bg-indigo-100 text-indigo-600 flex items-center justify-center rounded-xl">
        {icon}
      </div>
      <span className="text-gray-700 font-medium">{label}</span>
    </button>
  );
}

/* ======================================================
   HOME CONTENT
====================================================== */

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
        <FeatureCard title="Profiles" desc="Track games & chaos" />
        <FeatureCard title="Groups" desc="Your squads" />
        <FeatureCard title="Public Rooms" desc="Join open lobbies" />
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

/* ======================================================
   PROFILE PAGE (ONLY GAMES + EMOJIS)
====================================================== */

function ProfilePage({ profile, onEdit, onBack }) {
  return (
    <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl p-10 space-y-8 border border-gray-200 text-center">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-800">
        <ArrowLeft className="w-5 h-5" /> Back
      </button>

      <div className="text-7xl">{profile.avatar}</div>

      <h2 className="text-4xl font-black">{profile.name}</h2>

      <p className="text-gray-500">
        Member since: {new Date(profile.created_at).toDateString()}
      </p>

      <div className="grid grid-cols-2 gap-4 text-center">
        <StatCard label="Games Played" value={profile.games_played ?? 0} />
        <StatCard label="Emojis Sent" value={profile.emoji_used ?? 0} />
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

/* ======================================================
   PUBLIC ROOMS VIEW
====================================================== */

function PublicRoomsView({ loading, rooms, onRefresh, onJoin, onBack }) {
  return (
    <div className="max-w-3xl w-full bg-white rounded-3xl shadow-2xl p-8 space-y-6 border border-gray-200">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-800">
          <ArrowLeft className="w-5 h-5" /> Back
        </button>

        <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
          <Globe2 className="w-5 h-5 text-indigo-500" /> Public Rooms
        </h2>

        <button
          onClick={onRefresh}
          className="text-sm px-3 py-1 rounded-full border border-gray-300 hover:bg-gray-100"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-center text-gray-500">Loading public rooms…</p>
      ) : rooms.length === 0 ? (
        <p className="text-center text-gray-500">No public rooms right now.</p>
      ) : (
        <div className="space-y-3">
          {rooms.map((room) => (
            <div key={room.id} className="flex items-center justify-between p-4 rounded-2xl border border-gray-200 bg-gray-50">
              <div>
                <p className="text-sm text-gray-500">Room Code</p>
                <p className="text-xl font-mono tracking-[0.3em]">{room.code}</p>
              </div>

              <button
                onClick={() => onJoin(room.code)}
                className="px-4 py-2 bg-indigo-500 text-white rounded-xl font-semibold hover:scale-105 transition"
              >
                Join
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ======================================================
   GROUPS VIEW (LIST + CREATE)
====================================================== */

function GroupsView({ groups, loading, onReload, profile, onBack }) {
  const [creating, setCreating] = useState(false);
  const [groupName, setGroupName] = useState("");

  const createGroup = async () => {
    if (!groupName.trim()) return;

    const { data: newGroup } = await supabase
      .from("groups")
      .insert({ name: groupName })
      .select()
      .single();

    if (newGroup) {
      await supabase.from("group_members").insert({
        group_id: newGroup.id,
        profile_id: profile.id,
        role: "owner",
      });

      setCreating(false);
      setGroupName("");
      onReload();
    }
  };

  return (
    <div className="max-w-3xl w-full bg-white rounded-3xl shadow-2xl p-8 space-y-6 border border-gray-200">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-800">
          <ArrowLeft className="w-5 h-5" /> Back
        </button>

        <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
          <Group className="w-5 h-5 text-indigo-500" /> Groups
        </h2>

        <button
          onClick={() => setCreating(true)}
          className="text-sm px-3 py-1 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition"
        >
          + Create
        </button>
      </div>

      {loading ? (
        <p className="text-center text-gray-500">Loading groups…</p>
      ) : groups.length === 0 ? (
        <p className="text-center text-gray-500">You're not in any groups yet.</p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.group_id} className="p-4 border bg-gray-50 rounded-2xl">
              <p className="text-lg font-bold">{g.groups.name}</p>
              <p className="text-xs text-gray-500">Group ID: {g.group_id}</p>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <div className="p-4 rounded-2xl border bg-gray-50 space-y-3">
          <input
            className="w-full border rounded-xl p-3"
            placeholder="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />

          <button
            onClick={createGroup}
            className="w-full bg-indigo-500 text-white py-3 rounded-xl font-bold"
          >
            Create Group
          </button>
        </div>
      )}
    </div>
  );
}

/* ======================================================
   PROFILE EDIT MODAL
====================================================== */

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
                profileAvatar === em
                  ? "bg-indigo-100 ring-2 ring-indigo-500 scale-110"
                  : "bg-gray-50"
              }`}
            >
              {em}
            </button>
          ))}
        </div>

        <button
          onClick={onSave}
          disabled={!profileName.trim()}
          className="w-full bg-indigo-500 text-white py-4 rounded-xl font-bold"
        >
          Save
        </button>

        <button onClick={onClose} className="w-full py-3 text-gray-500 font-medium">
          Cancel
        </button>
      </div>
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

      {/* Back Button */}
      <button onClick={onBack} className="text-gray-500 hover:text-gray-700">
        ← Back
      </button>

      {/* Title */}
      <h2 className="text-3xl font-black text-gray-800">{title}</h2>

      {/* Room Code Input (Only for Join Room) */}
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

      {/* Submit Button */}
      <button
        onClick={onSubmit}
        disabled={loading}
        className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white py-4 rounded-xl font-bold hover:scale-105 transition disabled:opacity-50"
      >
        {loading ? "Loading…" : buttonText}
      </button>
    </div>
  );
}
