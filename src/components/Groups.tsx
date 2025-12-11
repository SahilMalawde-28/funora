// src/components/Groups.tsx
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Crown,
  Loader2,
  MessageCircle,
  Plus,
  Send,
  Users,
  Gamepad2,
  Copy,
  LogOut,
  Shield,
  XCircle,
} from "lucide-react";
import { supabase } from "../lib/supabase";

/* -------------------------------------------------
   TYPES
------------------------------------------------- */
type Profile = {
  id: string;
  name: string;
  avatar: string;
};

type Group = {
  id: string;
  name: string;
  avatar: string;
  owner_id: string | null;
};

type GroupMembership = {
  id: string;
  role: "owner" | "admin" | "member";
  group_id: string;
  groups: Group;
};

type GroupMemberRow = {
  id: string;
  role: "owner" | "admin" | "member";
  profile_id: string;
  profiles: Profile;
};

type GroupMessageRow = {
  id: string;
  group_id: string;
  profile_id: string;
  content: string;
  created_at: string;
  profiles: Profile;
};

interface GroupsProps {
  profile: Profile;
  onStartGroupGame?: (args: {
    group: Group;
    members: Profile[];
  }) => Promise<{ roomCode?: string } | void> | void;

  onQuickJoinRoom?: (code: string) => Promise<{ success: boolean; message?: string } | void> | void;

  onBack?: () => void;
}

/* -------------------------------------------------
   MAIN COMPONENT
------------------------------------------------- */
export default function Groups({ profile, onStartGroupGame, onQuickJoinRoom, onBack }: GroupsProps) {
  const [memberships, setMemberships] = useState<GroupMembership[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const [members, setMembers] = useState<GroupMemberRow[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [messages, setMessages] = useState<GroupMessageRow[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");

  const [busyAction, setBusyAction] = useState(false);

  const selectedMembership = useMemo(
    () => memberships.find((m) => m.group_id === selectedGroupId) || null,
    [memberships, selectedGroupId]
  );
  const selectedGroup = selectedMembership?.groups ?? null;
  const isOwner = selectedGroup?.owner_id === profile.id;

  /* -------------------------------------------------
     LOAD GROUPS
  ------------------------------------------------- */
  const loadGroups = async () => {
    if (!profile?.id) return;
    setLoadingGroups(true);

    const { data } = await supabase
      .from("group_members")
      .select("id, role, group_id, groups(id, name, avatar, owner_id)")
      .eq("profile_id", profile.id)
      .order("joined_at", { ascending: true });

    setMemberships(data || []);

    if (!selectedGroupId && data?.length) {
      setSelectedGroupId(data[0].group_id);
    }

    setLoadingGroups(false);
  };

  useEffect(() => {
    loadGroups();
  }, [profile?.id]);

  /* -------------------------------------------------
     LOAD MEMBERS
  ------------------------------------------------- */
  const loadMembers = async (gid: string) => {
    setLoadingMembers(true);

    const { data } = await supabase
      .from("group_members")
      .select("id, role, profile_id, profiles(id, name, avatar)")
      .eq("group_id", gid)
      .order("joined_at");

    setMembers(data || []);
    setLoadingMembers(false);
  };

  /* -------------------------------------------------
     LOAD MESSAGES
  ------------------------------------------------- */
  const loadMessages = async (gid: string) => {
    setLoadingMessages(true);

    const { data } = await supabase
      .from("group_messages")
      .select("id, group_id, profile_id, content, created_at, profiles(id, name, avatar)")
      .eq("group_id", gid)
      .order("created_at");

    setMessages(data || []);
    setLoadingMessages(false);
  };

  /* -------------------------------------------------
     SUBSCRIBE TO MESSAGE UPDATES
  ------------------------------------------------- */
  useEffect(() => {
    if (!selectedGroupId) return;

    loadMembers(selectedGroupId);
    loadMessages(selectedGroupId);

    const channel = supabase
      .channel(`group-messages-${selectedGroupId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_messages",
          filter: `group_id=eq.${selectedGroupId}`,
        },
        () => loadMessages(selectedGroupId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedGroupId]);

  /* -------------------------------------------------
     CREATE GROUP
  ------------------------------------------------- */
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setBusyAction(true);

    const { data: g } = await supabase
      .from("groups")
      .insert({ name: newGroupName.trim(), avatar: "👥", owner_id: profile.id })
      .select()
      .single();

    if (g) {
      await supabase.from("group_members").insert({
        group_id: g.id,
        profile_id: profile.id,
        role: "owner",
      });

      setNewGroupName("");
      setCreating(false);
      await loadGroups();
      setSelectedGroupId(g.id);
    }

    setBusyAction(false);
  };

  /* -------------------------------------------------
     JOIN GROUP
  ------------------------------------------------- */
  const handleJoinGroup = async () => {
    const code = joinCode.trim();
    if (!code) return;
    setBusyAction(true);

    const { data: g } = await supabase.from("groups").select("*").eq("id", code).single();

    if (g) {
      await supabase.from("group_members").insert({
        group_id: g.id,
        profile_id: profile.id,
        role: "member",
      });

      setJoinCode("");
      setJoining(false);
      await loadGroups();
      setSelectedGroupId(g.id);
    } else {
      alert("Invalid group code");
    }

    setBusyAction(false);
  };

  /* -------------------------------------------------
     LEAVE GROUP
  ------------------------------------------------- */
  const handleLeaveGroup = async () => {
    if (!selectedMembership || !selectedGroup) return;

    if (isOwner && members.length > 1) {
      alert("Remove members or transfer ownership first.");
      return;
    }

    await supabase.from("group_members").delete().eq("id", selectedMembership.id);

    if (isOwner && members.length <= 1) {
      await supabase.from("groups").delete().eq("id", selectedGroup.id);
    }

    setSelectedGroupId(null);
    loadGroups();
  };

  /* -------------------------------------------------
     PROMOTE & KICK
  ------------------------------------------------- */
  const handlePromoteToAdmin = async (m: GroupMemberRow) => {
    if (!isOwner || m.role !== "member") return;

    await supabase.from("group_members").update({ role: "admin" }).eq("id", m.id);
    loadMembers(selectedGroupId!);
  };

  const handleKickMember = async (m: GroupMemberRow) => {
    if (!isOwner || m.role === "owner") return;

    if (!confirm(`Kick ${m.profiles.name}?`)) return;

    await supabase.from("group_members").delete().eq("id", m.id);
    loadMembers(selectedGroupId!);
  };

  /* -------------------------------------------------
     SEND MESSAGE
  ------------------------------------------------- */
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const msg = newMessage.trim();
    setNewMessage("");

    await supabase.from("group_messages").insert({
      group_id: selectedGroupId!,
      profile_id: profile.id,
      content: msg,
    });
  };

  /* -------------------------------------------------
     START GAME
  ------------------------------------------------- */
  const handleStartGameClick = async () => {
    if (!selectedGroup) return;

    const memberProfiles = members.map((m) => m.profiles);

    let roomCode: string | undefined;

    if (onStartGroupGame) {
      const res = await onStartGroupGame({ group: selectedGroup, members: memberProfiles });
      roomCode = res?.roomCode;
    }

    if (roomCode) {
      await supabase.from("group_messages").insert({
        group_id: selectedGroup.id,
        profile_id: profile.id,
        content: `🎮 Party started! Join the Funora room with code: ${roomCode}`,
      });
    }
  };

  /* -------------------------------------------------
     ROOM CODE EXTRACTION (new rules)
  ------------------------------------------------- */

  function extractRoomCode(message: string): string | null {
    if (!message.startsWith("🎮 Party started!")) return null;

    const idx = message.indexOf("code:");
    if (idx === -1) return null;

    const possible = message.substring(idx + 5).trim().split(" ")[0].trim();

    if (!possible) return null;
    if (possible.toUpperCase() === "FUNORA") return null;
    if (!/^[A-Z0-9]{6}$/i.test(possible)) return null;

    return possible.toUpperCase();
  }

  /* -------------------------------------------------
     QUICK JOIN fallback
  ------------------------------------------------- */
  const handleQuickJoin = async (code: string) => {
    if (onQuickJoinRoom) {
      const r = await onQuickJoinRoom(code);
      if (r && !r.success) alert(r.message);
      return;
    }

    navigator.clipboard.writeText(code);
    alert("Room code copied!");
  };

  /* -------------------------------------------------
     RENDER
  ------------------------------------------------- */
  return (
    <div className="relative flex w-full h-[80vh] bg-white rounded-3xl shadow-2xl border overflow-hidden">

      {/* LEFT PANEL */}
      <div className="w-64 bg-gray-50 border-r flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            {onBack && (
              <button onClick={onBack} className="p-1 rounded-full hover:bg-gray-200">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <Users className="w-5 h-5 text-indigo-600" />
            <span className="font-bold text-gray-800 text-sm">My Groups</span>
          </div>

          <button onClick={loadGroups} className="bg-gray-200 hover:bg-gray-300 rounded-full px-2 py-1 text-xs">
            {loadingGroups ? <Loader2 className="w-3 h-3 animate-spin" /> : "↻"}
          </button>
        </div>

        {/* Group list */}
        <div className="flex-1 overflow-y-auto">
          {memberships.map((m) => {
            const g = m.groups;
            const active = g.id === selectedGroupId;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedGroupId(g.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm border-b ${
                  active ? "bg-indigo-50 border-l-4 border-indigo-500" : "hover:bg-gray-100"
                }`}
              >
                <span className="text-2xl">{g.avatar}</span>
                <div className="flex-1">
                  <div className="font-semibold">{g.name}</div>
                  <div className="text-[10px] text-gray-500">
                    {m.role === "owner" && "Owner"}
                    {m.role === "admin" && "Admin"}
                    {m.role === "member" && "Member"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Create / Join */}
        <div className="p-3 border-t space-y-2">
          <button
            onClick={() => { setCreating(true); setJoining(false); }}
            className="w-full bg-indigo-500 text-white py-2 rounded-xl text-xs font-semibold"
          >
            <Plus className="w-3 h-3 inline-block mr-1" /> New Group
          </button>

          <button
            onClick={() => { setJoining(true); setCreating(false); }}
            className="w-full bg-gray-200 text-gray-800 py-2 rounded-xl text-xs font-semibold"
          >
            Join with Code
          </button>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 flex flex-col">
        {!selectedGroup ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Select a group to begin.
          </div>
        ) : (
          <>
            {/* HEADER */}
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedGroup.avatar}</span>

                <div>
                  <div className="font-bold text-gray-800 flex items-center gap-2">
                    {selectedGroup.name}
                    {isOwner && (
                      <span className="bg-yellow-100 border border-yellow-300 text-yellow-800 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Crown className="w-3 h-3" /> Owner
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-gray-500">
                    {members.length} member{members.length !== 1 && "s"}
                  </div>

                  <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                    Group ID: <code>{selectedGroup.id.slice(0, 8)}…</code>
                    <button
                      onClick={() => navigator.clipboard.writeText(selectedGroup.id)}
                      className="bg-gray-200 px-1.5 rounded hover:bg-gray-300"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleStartGameClick}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold px-3 py-1.5 rounded-xl"
                >
                  <Gamepad2 className="w-4 h-4 inline-block" /> Start Game
                </button>

                <button
                  onClick={handleLeaveGroup}
                  className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold px-3 py-1.5 rounded-xl"
                >
                  <LogOut className="w-4 h-4 inline-block" /> Leave
                </button>
              </div>
            </div>

            {/* BODY */}
            <div className="flex flex-1 min-h-0">

              {/* CHAT */}
              <div className="flex-1 flex flex-col border-r">
                <div className="px-4 py-2 text-[11px] text-gray-500 border-b flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" /> Group Chat
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {messages.map((msg) => {
                    const mine = msg.profile_id === profile.id;

                    const code = extractRoomCode(msg.content);

                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}
                      >
                        {/* Avatar (others only) */}
                        {!mine && (
                          <div className="text-xl mt-1">{msg.profiles?.avatar || "🙂"}</div>
                        )}

                        <div
                          className={`max-w-[70%] px-3 py-2 rounded-2xl text-xs ${
                            mine
                              ? "bg-indigo-500 text-white rounded-br-none"
                              : "bg-gray-100 text-gray-800 rounded-bl-none"
                          }`}
                        >
                          {/* Name */}
                          <div className="font-semibold text-[11px] flex items-center gap-1">
                            {msg.profiles?.name}
                            {msg.profile_id === selectedGroup.owner_id && (
                              <span className="text-[9px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
                                Owner
                              </span>
                            )}
                          </div>

                          {/* Message text */}
                          <div className="whitespace-pre-wrap">{msg.content}</div>

                          {/* ROOM CODE BADGE */}
                          {code && (
                            <div className="mt-2">
                              <button
                                onClick={() => handleQuickJoin(code)}
                                className={`px-2 py-1 text-[11px] rounded-full border 
                                  ${mine ? "bg-white text-indigo-600" : "bg-indigo-500 text-white"} 
                                  hover:opacity-80`}
                              >
                                Join {code}
                              </button>
                            </div>
                          )}

                          {/* Time */}
                          <div className={`mt-1 text-[9px] ${mine ? "text-indigo-200" : "text-gray-500"}`}>
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>

                        {mine && <div className="text-xl mt-1">{msg.profiles?.avatar}</div>}
                      </div>
                    );
                  })}
                </div>

                {/* INPUT */}
                <div className="p-3 border-t flex items-center gap-2">
                  <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    className="flex-1 px-3 py-2 border rounded-xl text-sm"
                    placeholder="Type a message…"
                  />
                  <button
                    onClick={handleSendMessage}
                    className="bg-indigo-500 text-white px-3 py-2 rounded-xl"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* MEMBERS LIST */}
              <div className="w-60 flex flex-col">
                <div className="px-4 py-2 border-b text-[11px] text-gray-500 flex items-center gap-1">
                  <Users className="w-3 h-3" /> Members
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {members.map((m) => {
                    const p = m.profiles;
                    const isMe = p.id === profile.id;

                    return (
                      <div
                        key={m.id}
                        className="flex items-center gap-2 p-2 bg-gray-50 border rounded-xl text-xs"
                      >
                        <span className="text-2xl">{p.avatar}</span>

                        <div className="flex-1">
                          <div className="font-semibold flex items-center gap-1">
                            {p.name}
                            {isMe && <span className="text-[9px] text-indigo-500">(you)</span>}
                          </div>

                          <div className="text-[10px] text-gray-500 flex gap-1 items-center">
                            {m.role === "owner" && <Crown className="w-3 h-3 text-yellow-500" />}
                            {m.role === "admin" && <Shield className="w-3 h-3 text-indigo-500" />}
                            {m.role}
                          </div>
                        </div>

                        {/* ADMIN ACTIONS */}
                        {isOwner && !isMe && (
                          <div className="flex flex-col gap-1">
                            {m.role === "member" && (
                              <button
                                onClick={() => handlePromoteToAdmin(m)}
                                className="p-1 rounded-lg bg-indigo-100 hover:bg-indigo-200"
                              >
                                <Shield className="w-3 h-3 text-indigo-700" />
                              </button>
                            )}

                            <button
                              onClick={() => handleKickMember(m)}
                              className="p-1 rounded-lg bg-red-50 hover:bg-red-100"
                            >
                              <XCircle className="w-3 h-3 text-red-600" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* CREATE / JOIN MODALS */}
        {(creating || joining) && (
          <div className="absolute bottom-6 left-6 w-80 bg-white border shadow-xl rounded-2xl p-4 space-y-3">

            <div className="flex justify-between items-center">
              <span className="font-bold text-sm">{creating ? "Create Group" : "Join Group"}</span>
              <button
                onClick={() => {
                  setCreating(false);
                  setJoining(false);
                  setNewGroupName("");
                  setJoinCode("");
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {creating && (
              <>
                <input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2"
                  placeholder="Group name"
                />
                <button
                  disabled={!newGroupName.trim()}
                  onClick={handleCreateGroup}
                  className="w-full bg-indigo-500 text-white py-2 rounded-xl"
                >
                  Create
                </button>
              </>
            )}

            {joining && (
              <>
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2"
                  placeholder="Group ID"
                />
                <button
                  disabled={!joinCode.trim()}
                  onClick={handleJoinGroup}
                  className="w-full bg-gray-800 text-white py-2 rounded-xl"
                >
                  Join
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
