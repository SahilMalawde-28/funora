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
  Copy,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { AVATARS } from "../lib/gameLogic";

interface HomeProps {
  onCreateRoom: (name: string, avatar: string) => void;
  onJoinRoom: (code: string, name: string, avatar: string) => void;
  profile: any;
}

export default function Home({ onCreateRoom, onJoinRoom, profile }: HomeProps) {
  /* ---------------------------------------------- */
  /* VIEW STATES                                     */
  /* ---------------------------------------------- */
  const [view, setView] = useState<
    "home" | "create" | "join" | "profile" | "public" | "groups" | "groupView"
  >("home");

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);

  /* ---------------------------------------------- */
  /* GROUP STATES                                    */
  /* ---------------------------------------------- */
  const [groups, setGroups] = useState<any[]>([]);
  const [activeGroup, setActiveGroup] = useState<any>(null);
  const [createGroupModal, setCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  /* ---------------------------------------------- */
  /* PUBLIC ROOMS STATES                             */
  /* ---------------------------------------------- */
  const [publicRooms, setPublicRooms] = useState<any[]>([]);
  const [publicLoading, setPublicLoading] = useState(false);

  /* ---------------------------------------------- */
  /* PROFILE EDIT                                    */
  /* ---------------------------------------------- */
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [profileName, setProfileName] = useState(profile?.name || "");
  const [profileAvatar, setProfileAvatar] = useState(profile?.avatar || "🙂");

  useEffect(() => {
    if (profile) {
      setProfileName(profile.name);
      setProfileAvatar(profile.avatar);
    }
  }, [profile]);

  /* ---------------------------------------------- */
  /* LOAD GROUPS                                     */
  /* ---------------------------------------------- */
  const loadGroups = async () => {
    if (!profile) return;

    const { data } = await supabase
      .from("group_members")
      .select("group:groups(*)")
      .eq("profile_id", profile.id);

    setGroups(data?.map((g) => g.group) || []);
  };

  useEffect(() => {
    if (view === "groups") loadGroups();
  }, [view]);

  /* ---------------------------------------------- */
  /* CREATE GROUP                                    */
  /* ---------------------------------------------- */
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;

    const { data: group, error } = await supabase
      .from("groups")
      .insert({
        name: newGroupName,
        owner_id: profile.id,
      })
      .select()
      .single();

    if (error) return alert("Failed to create group");

    await supabase.from("group_members").insert({
      group_id: group.id,
      profile_id: profile.id,
      role: "owner",
    });

    setCreateGroupModal(false);
    setNewGroupName("");
    loadGroups();
  };

  /* ---------------------------------------------- */
  /* LOAD PUBLIC ROOMS                               */
  /* ---------------------------------------------- */
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

  /* ---------------------------------------------- */
  /* SAVE PROFILE                                    */
  /* ---------------------------------------------- */
  const saveProfile = async () => {
    const updated = {
      name: profileName.trim(),
      avatar: profileAvatar,
    };

    const merged = { ...profile, ...updated };
    localStorage.setItem("funora_profile", JSON.stringify(merged));

    await supabase.from("profiles").update(updated).eq("id", profile.id);

    setEditProfileModal(false);
    window.location.reload();
  };

  /* ---------------------------------------------- */
  /* ROOM ACTIONS                                    */
  /* ---------------------------------------------- */
  const handleCreate = async () => {
    if (!profile) return alert("Profile missing!");
    setLoading(true);
    await onCreateRoom(profile.name, profile.avatar);
    setLoading(false);
  };

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
    setLoading(true);
    try {
      await onJoinRoom(code, profile.name, profile.avatar);
    } catch {
      alert("Could not join room");
      setLoading(false);
    }
  };

  /* ---------------------------------------------- */
  /* GROUP VIEW: LOAD MEMBERS & INVITE               */
  /* ---------------------------------------------- */
  const loadGroupDetails = async (group) => {
    setActiveGroup(group);
    setView("groupView");
  };

  /* ---------------------------------------------- */
  /* MAIN UI                                         */
  /* ---------------------------------------------- */
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* SIDEBAR */}
      <Sidebar
        setView={setView}
        setSidebarOpen={setSidebarOpen}
        groups={groups}
        openGroup={loadGroupDetails}
      />

      {/* MOBILE SIDEBAR */}
      <MobileSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        setView={setView}
        groups={groups}
        openGroup={loadGroupDetails}
      />

      {/* CONTENT */}
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
        {view === "profile" && (
          <ProfilePage profile={profile} onEdit={() => setEditProfileModal(true)} onBack={() => setView("home")} />
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
          <GroupsPage
            groups={groups}
            openGroup={loadGroupDetails}
            openCreate={() => setCreateGroupModal(true)}
            onBack={() => setView("home")}
          />
        )}

        {view === "groupView" && activeGroup && (
          <GroupView group={activeGroup} onBack={() => setView("groups")} />
        )}
      </div>

      {/* MODALS */}
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

      {createGroupModal && (
        <CreateGroupModal
          newGroupName={newGroupName}
          setNewGroupName={setNewGroupName}
          onCreate={handleCreateGroup}
          onClose={() => setCreateGroupModal(false)}
        />
      )}
    </div>
  );
}

/* ----------------------------------------------------
   THE REST OF THE FILE IS TOO LONG TO FIT IN ONE MESSAGE
---------------------------------------------------- */


/* ----------------------------------------------------
      SIDEBAR (DESKTOP)
---------------------------------------------------- */
function Sidebar({ setView, setSidebarOpen, groups, openGroup }) {
  return (
    <div className="hidden md:flex flex-col bg-white/80 backdrop-blur-xl shadow-xl border-r border-gray-200 w-20 hover:w-64 transition-all duration-300 group">

      <div className="p-6 flex items-center gap-3">
        <Sparkles className="w-8 h-8 text-indigo-600" />
        <span className="text-xl font-black text-indigo-700 opacity-0 group-hover:opacity-100 transition">
          Funora
        </span>
      </div>

      <MenuItem icon={<Users />} label="Join Room" onClick={() => setView("join")} />
      <MenuItem icon={<Plus />} label="Create Room" onClick={() => setView("create")} />

      <MenuItem icon={<UserCircle />} label="Profile" onClick={() => setView("profile")} />
      <MenuItem icon={<Globe2 />} label="Public Rooms" onClick={() => setView("public")} />

      <MenuItem
        icon={<Gamepad2 />}
        label="Party Mode"
        onClick={() => setView("party")}
        disabled
      />

      {/* GROUPS */}
      <div className="mt-6 px-4 opacity-0 group-hover:opacity-100 transition">
        <p className="text-xs text-gray-500 font-bold">GROUPS</p>
      </div>

      {groups.map((g) => (
        <MenuItem
          key={g.id}
          icon={<MessageCircle />}
          label={g.name}
          onClick={() => openGroup(g)}
        />
      ))}

      <MenuItem
        icon={<Plus />}
        label="New Group"
        onClick={() => setView("groups")}
      />

      <div className="mt-auto mb-6">
        <MenuItem icon={<LogOut />} label="Logout" disabled />
      </div>
    </div>
  );
}

/* ----------------------------------------------------
      MOBILE SIDEBAR
---------------------------------------------------- */
function MobileSidebar({ sidebarOpen, setSidebarOpen, setView, groups, openGroup }) {
  if (!sidebarOpen) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden">
      <div className="absolute left-0 top-0 h-full w-72 bg-white p-6 space-y-6 shadow-xl rounded-r-3xl">

        <div className="flex justify-between items-center mb-4">
          <h2 className="font-black text-xl">Menu</h2>
          <button onClick={() => setSidebarOpen(false)}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <MobileMenuItem label="Create Room" icon={<Plus />} onClick={() => { setView("create"); setSidebarOpen(false); }} />
        <MobileMenuItem label="Join Room" icon={<Users />} onClick={() => { setView("join"); setSidebarOpen(false); }} />
        <MobileMenuItem label="Profile" icon={<UserCircle />} onClick={() => { setView("profile"); setSidebarOpen(false); }} />
        <MobileMenuItem label="Public Rooms" icon={<Globe2 />} onClick={() => { setView("public"); setSidebarOpen(false); }} />

        <p className="text-xs mt-4 font-bold text-gray-500">GROUPS</p>
        {groups.map((g) => (
          <MobileMenuItem
            key={g.id}
            label={g.name}
            icon={<MessageCircle />}
            onClick={() => {
              openGroup(g);
              setSidebarOpen(false);
            }}
          />
        ))}

        <MobileMenuItem label="New Group" icon={<Plus />} onClick={() => { setView("groups"); setSidebarOpen(false); }} />
      </div>
    </div>
  );
}

/* ----------------------------------------------------
      GROUPS LIST PAGE
---------------------------------------------------- */
function GroupsPage({ groups, openGroup, openCreate, onBack }) {
  return (
    <div className="max-w-2xl w-full bg-white p-8 rounded-3xl shadow-2xl border border-gray-200 space-y-6">

      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-800">
        <ArrowLeft className="w-5 h-5" /> Back
      </button>

      <h2 className="text-3xl font-black">Your Groups</h2>

      <button
        onClick={openCreate}
        className="w-full py-3 rounded-xl bg-indigo-500 text-white font-bold hover:scale-105 transition"
      >
        + Create New Group
      </button>

      {groups.length === 0 && (
        <p className="text-gray-500 text-center mt-4">You are not in any groups yet.</p>
      )}

      {groups.map((g) => (
        <div
          key={g.id}
          onClick={() => openGroup(g)}
          className="p-4 rounded-2xl border bg-gray-50 hover:bg-gray-100 transition cursor-pointer"
        >
          <div className="font-bold text-lg">{g.name}</div>
          <div className="text-xs text-gray-500">Tap to open</div>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------
      INDIVIDUAL GROUP VIEW
---------------------------------------------------- */
function GroupView({ group, onBack }) {
  return (
    <div className="max-w-3xl w-full bg-white rounded-3xl shadow-2xl p-8 border space-y-8">

      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-800">
        <ArrowLeft className="w-5 h-5" /> Back
      </button>

      <h1 className="text-4xl font-black">{group.name}</h1>

      {/* Invite Code */}
      <div className="bg-gray-100 p-4 rounded-2xl flex justify-between items-center">
        <div>
          <p className="text-xs font-bold text-gray-500">Invite Code</p>
          <p className="font-mono text-xl">{group.invite_code}</p>
        </div>
        <button
          onClick={() => navigator.clipboard.writeText(group.invite_code)}
          className="p-3 bg-indigo-200 rounded-xl hover:bg-indigo-300"
        >
          <Copy className="w-5 h-5 text-indigo-800" />
        </button>
      </div>

      {/* Placeholder for chat */}
      <div className="bg-gray-50 h-64 rounded-2xl border flex items-center justify-center text-gray-400">
        Chat coming soon…
      </div>

      {/* Start game from group */}
      <button className="w-full py-4 bg-indigo-500 text-white rounded-xl font-bold hover:scale-105 transition">
        Start Group Game Session
      </button>
    </div>
  );
}

/* ----------------------------------------------------
      CREATE GROUP MODAL
---------------------------------------------------- */
function CreateGroupModal({ newGroupName, setNewGroupName, onCreate, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md space-y-6">

        <h2 className="text-3xl font-black">New Group</h2>

        <input
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          placeholder="Group name"
          className="w-full border-2 rounded-xl px-4 py-3"
        />

        <button
          onClick={onCreate}
          className="w-full py-3 bg-indigo-500 text-white rounded-xl font-bold hover:scale-105 transition"
        >
          Create
        </button>

        <button onClick={onClose} className="w-full py-3 text-gray-500">
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------
      PUBLIC ROOMS (already working)
---------------------------------------------------- */

function PublicRoomsView({
  loading,
  rooms,
  onRefresh,
  onJoin,
  onBack,
}) {
  return (
    <div className="max-w-3xl w-full bg-white rounded-3xl shadow-2xl p-8 space-y-6 border">

      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-800">
        <ArrowLeft className="w-5 h-5" /> Back
      </button>

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-3xl font-black">Public Rooms</h2>
        <button onClick={onRefresh} className="px-3 py-1 rounded-xl border hover:bg-gray-100">
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-center text-gray-500">Loading…</p>
      ) : rooms.length === 0 ? (
        <p className="text-center text-gray-500">No public rooms available.</p>
      ) : (
        <div className="space-y-3">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="p-4 rounded-2xl border bg-gray-50 flex justify-between items-center"
            >
              <div>
                <p className="text-sm text-gray-500">Room Code</p>
                <p className="text-xl font-mono">{room.code}</p>
                <p className="text-xs text-gray-400">Mode: {room.flag}</p>
              </div>
              <button
                onClick={() => onJoin(room.code)}
                className="px-4 py-2 bg-indigo-500 text-white rounded-xl hover:scale-105"
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

/* ----------------------------------------------------
      UTILITY COMPONENTS
---------------------------------------------------- */
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
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
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
    <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 space-y-6 border">

      <button onClick={onBack} className="text-gray-500 hover:text-gray-700">
        ← Back
      </button>

      <h2 className="text-3xl font-black">{title}</h2>

      {setRoomCode && (
        <input
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          maxLength={6}
          className="w-full border-2 rounded-xl px-4 py-3 text-center font-bold tracking-widest"
        />
      )}

      <button
        onClick={onSubmit}
        disabled={loading}
        className="w-full py-4 bg-indigo-500 text-white rounded-xl font-bold hover:scale-105 transition"
      >
        {loading ? "Loading…" : buttonText}
      </button>
    </div>
  );
}
