// src/components/Groups.tsx
import { useEffect, useMemo, useRef, useState } from "react";
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
  onQuickJoinRoom?: (
    code: string
  ) => Promise<{ success: boolean; message?: string } | void> | void;
  onBack?: () => void;
}

/* -------------------------------------------------
   MAIN COMPONENT
------------------------------------------------- */
export default function Groups({
  profile,
  onStartGroupGame,
  onQuickJoinRoom,
  onBack,
}: GroupsProps) {
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

  // mobile paging (0 = groups, 1 = chat, 2 = members)
  const [mobilePage, setMobilePage] = useState<number>(0);
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);

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

    // dedupe and set
    setMemberships(data || []);

    if (!selectedGroupId && data && data.length > 0) {
      setSelectedGroupId(data[0].group_id);
    }

    setLoadingGroups(false);
  };

  useEffect(() => {
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      .order("joined_at", { ascending: true });

    setMembers(data || []);
    setLoadingMembers(false);
  };

  /* -------------------------------------------------
     LOAD MESSAGES (dedupe by id to avoid duplicates)
  ------------------------------------------------- */
  const loadMessages = async (gid: string) => {
    setLoadingMessages(true);

    const { data } = await supabase
      .from("group_messages")
      .select("id, group_id, profile_id, content, created_at, profiles(id, name, avatar)")
      .eq("group_id", gid)
      .order("created_at", { ascending: true });

    if (!data) {
      setMessages([]);
      setLoadingMessages(false);
      return;
    }

    // dedupe by id (just in case)
    const map = new Map<string, GroupMessageRow>();
    for (const row of data as GroupMessageRow[]) {
      map.set(row.id, row);
    }
    setMessages(Array.from(map.values()));
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
        // on new message, just reload messages (dedupe prevents doubles)
        () => {
          loadMessages(selectedGroupId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId]);

  /* -------------------------------------------------
     CREATE GROUP
  ------------------------------------------------- */
  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !profile?.id) return;
    setBusyAction(true);

    const { data: g, error } = await supabase
      .from("groups")
      .insert({ name: newGroupName.trim(), avatar: "👥", owner_id: profile.id })
      .select()
      .single();

    if (error || !g) {
      console.error("Create group error:", error);
      alert("Failed to create group");
      setBusyAction(false);
      return;
    }

    const { error: mErr } = await supabase.from("group_members").insert({
      group_id: g.id,
      profile_id: profile.id,
      role: "owner",
    });

    if (mErr) {
      console.error("Add creator to members error:", mErr);
    }

    setNewGroupName("");
    setCreating(false);
    await loadGroups();
    setSelectedGroupId(g.id);
    setBusyAction(false);
  };

  /* -------------------------------------------------
     JOIN GROUP
  ------------------------------------------------- */
  const handleJoinGroup = async () => {
    const code = joinCode.trim();
    if (!code || !profile?.id) return;
    setBusyAction(true);

    const { data: g, error } = await supabase.from("groups").select("*").eq("id", code).maybeSingle();
    if (error) {
      console.error("Join group lookup:", error);
      alert("Failed to find group");
      setBusyAction(false);
      return;
    }
    if (!g) {
      alert("Invalid group code");
      setBusyAction(false);
      return;
    }

    // check if already member
    const { data: existing } = await supabase
      .from("group_members")
      .select("id")
      .eq("group_id", g.id)
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (existing) {
      alert("You're already in this group");
      setJoinCode("");
      setJoining(false);
      setBusyAction(false);
      setSelectedGroupId(g.id);
      await loadGroups();
      return;
    }

    const { error: mErr } = await supabase.from("group_members").insert({
      group_id: g.id,
      profile_id: profile.id,
      role: "member",
    });

    if (mErr) {
      console.error("Error joining group:", mErr);
      alert("Failed to join group");
      setBusyAction(false);
      return;
    }

    setJoinCode("");
    setJoining(false);
    await loadGroups();
    setSelectedGroupId(g.id);
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

    if (!confirm("Leave this group?")) return;

    await supabase.from("group_members").delete().eq("id", selectedMembership.id);

    if (isOwner && members.length <= 1) {
      await supabase.from("groups").delete().eq("id", selectedGroup.id);
    }

    setSelectedGroupId(null);
    await loadGroups();
  };

  /* -------------------------------------------------
     PROMOTE & KICK
  ------------------------------------------------- */
  const handlePromoteToAdmin = async (m: GroupMemberRow) => {
    if (!isOwner || m.role !== "member") return;
    await supabase.from("group_members").update({ role: "admin" }).eq("id", m.id);
    await loadMembers(selectedGroupId!);
  };

  const handleKickMember = async (m: GroupMemberRow) => {
    if (!isOwner || m.role === "owner") return;
    if (!confirm(`Kick ${m.profiles.name}?`)) return;

    await supabase.from("group_members").delete().eq("id", m.id);
    await loadMembers(selectedGroupId!);
  };

  /* -------------------------------------------------
     SEND MESSAGE
  ------------------------------------------------- */
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedGroupId || !profile?.id) return;

    // optimistic UI: clear input immediately
    const content = newMessage.trim();
    setNewMessage("");

    const { error } = await supabase.from("group_messages").insert({
      group_id: selectedGroupId,
      profile_id: profile.id,
      content,
    });

    if (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message");
    } else {
      // server will trigger realtime and reload messages (we rely on that)
    }
  };

  /* -------------------------------------------------
     START GAME
  ------------------------------------------------- */
  const handleStartGameClick = async () => {
    if (!selectedGroup) return;

    const memberProfiles = members.map((m) => m.profiles);

    try {
      let roomCode: string | undefined;

      if (onStartGroupGame) {
        const result = await onStartGroupGame({ group: selectedGroup, members: memberProfiles });
        if (result && "roomCode" in result && result.roomCode) roomCode = result.roomCode;
      }

      if (roomCode) {
        await supabase.from("group_messages").insert({
          group_id: selectedGroup.id,
          profile_id: profile.id,
          content: `🎮 Party started! Join the Funora room with code: ${roomCode}`,
        });
      } else {
        await supabase.from("group_messages").insert({
          group_id: selectedGroup.id,
          profile_id: profile.id,
          content: `🎮 Party started! The host created a Funora room. Ask them for the code.`,
        });
      }
    } catch (err) {
      console.error("Error starting game:", err);
      alert("Failed to start game");
    }
  };

  /* -------------------------------------------------
     ROOM CODE EXTRACTION (new rules)
     - Only extract when message STARTS with the 'party started' prefix
     - Ignore 'FUNORA' token
  ------------------------------------------------- */
  function extractRoomCode(message: string): string | null {
    if (!message) return null;
    const trimmed = message.trim();

    // Only apply extraction for party started messages (prefix)
    if (!trimmed.startsWith("🎮 Party started!")) return null;

    const lower = trimmed.toLowerCase();
    const idx = lower.indexOf("code:");
    if (idx === -1) return null;

    const after = trimmed.substring(idx + 5).trim();
    if (!after) return null;

    // first token
    const firstToken = after.split(/\s+/)[0].trim();

    if (!firstToken) return null;
    if (firstToken.toUpperCase() === "FUNORA") return null; // ignore FUNORA
    // Accept 6 char alphanumeric codes
    if (!/^[A-Z0-9]{6}$/i.test(firstToken)) return null;

    return firstToken.toUpperCase();
  }

  /* -------------------------------------------------
     QUICK JOIN fallback
  ------------------------------------------------- */
  const handleQuickJoin = async (code: string) => {
    if (!code) return;
    if (onQuickJoinRoom) {
      try {
        const r = await onQuickJoinRoom(code);
        if (r && "success" in r && !r.success) {
          alert(r.message || "Failed to join room");
        }
        return;
      } catch (err) {
        console.error("onQuickJoinRoom error:", err);
        alert("Failed to quick join");
        return;
      }
    }

    // fallback: check room
    const { data } = await supabase.from("rooms").select("code,status").eq("code", code).maybeSingle();
    if (!data) {
      navigator.clipboard.writeText(code);
      alert("Room not found. Code copied to clipboard.");
      return;
    }
    if (data.status !== "lobby") {
      navigator.clipboard.writeText(code);
      alert(`Room is ${data.status}. Code copied to clipboard.`);
      return;
    }
    // lobby exists — copy and instruct
    navigator.clipboard.writeText(code);
    alert(`Room ${code} is open. Code copied — paste it in Join Room to enter.`);
  };

  /* -------------------------------------------------
     MOBILE SWIPE HANDLING (medium sensitivity)
     sensitivity mapping: medium -> threshold 60px
  ------------------------------------------------- */
  const SWIPE_THRESHOLD = 60; // you chose medium (2)

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const x = e.touches[0].clientX;
    touchDeltaX.current = x - touchStartX.current;
  };

  const onTouchEnd = () => {
    if (touchStartX.current == null) return;
    const d = touchDeltaX.current;
    touchStartX.current = null;
    touchDeltaX.current = 0;

    if (d > SWIPE_THRESHOLD) {
      // swipe right -> previous page
      setMobilePage((p) => Math.max(0, p - 1));
    } else if (d < -SWIPE_THRESHOLD) {
      // swipe left -> next page
      setMobilePage((p) => Math.min(2, p + 1));
    }
  };

  /* -------------------------------------------------
     RENDER
  ------------------------------------------------- */
  return (
    <div className="relative w-full h-[80vh] max-h-[900px] bg-white rounded-3xl shadow-2xl border overflow-hidden">
      {/* DESKTOP 3-column layout */}
      <div className="hidden md:flex h-full">
        {/* LEFT: Groups List */}
        <div className="w-64 bg-gray-50 border-r flex flex-col">
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

          <div className="flex-1 overflow-y-auto">
            {memberships.length === 0 ? (
              <div className="p-4 text-xs text-gray-500">You're not in any groups yet.</div>
            ) : (
              memberships.map((m) => {
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
                      <div className="font-semibold text-gray-800 truncate">{g.name}</div>
                      <div className="text-[10px] text-gray-500">
                        {m.role === "owner" && "Owner"}
                        {m.role === "admin" && "Admin"}
                        {m.role === "member" && "Member"}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="p-3 border-t space-y-2">
            <button
              onClick={() => {
                setCreating(true);
                setJoining(false);
              }}
              className="w-full bg-indigo-500 text-white py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
            >
              <Plus className="w-3 h-3 inline-block" /> New Group
            </button>

            <button
              onClick={() => {
                setJoining(true);
                setCreating(false);
              }}
              className="w-full bg-gray-200 text-gray-800 py-2 rounded-xl text-xs font-semibold"
            >
              Join with Code
            </button>
          </div>
        </div>

        {/* CENTER: Chat */}
        <div className="flex-1 flex flex-col border-r min-w-0">
          {!selectedGroup ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              Select a group to begin.
            </div>
          ) : (
            <>
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
                    <div className="text-[11px] text-gray-500">{members.length} member{members.length !== 1 && "s"}</div>
                  </div>
                </div>

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

              <div className="flex-1 flex overflow-hidden min-h-0">
                <div className="flex-1 flex flex-col">
                  <div className="px-4 py-2 text-[11px] text-gray-500 border-b flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" /> Group chat
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loadingMessages ? (
                      <div className="text-xs text-gray-500">Loading messages…</div>
                    ) : messages.length === 0 ? (
                      <div className="text-xs text-gray-400">No messages yet. Say hi 👋</div>
                    ) : (
                      messages.map((msg) => {
                        const mine = msg.profile_id === profile.id;
                        const code = extractRoomCode(msg.content || "");
                        return (
                          <div key={msg.id} className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                            {!mine && <div className="text-xl mt-1">{msg.profiles?.avatar || "🙂"}</div>}

                            <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-xs ${mine ? "bg-indigo-500 text-white rounded-br-none" : "bg-gray-100 text-gray-800 rounded-bl-none"}`}>
                              <div className="font-semibold text-[11px] flex items-center gap-1">
                                {msg.profiles?.name || "Player"}
                                {msg.profile_id === selectedGroup.owner_id && (
                                  <span className="text-[9px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">Owner</span>
                                )}
                              </div>

                              <div className="whitespace-pre-wrap">{msg.content}</div>

                              {code && (
                                <div className="mt-2">
                                  <button
                                    onClick={() => handleQuickJoin(code)}
                                    className={`px-2 py-1 text-[11px] rounded-full border ${mine ? "bg-white text-indigo-600" : "bg-indigo-500 text-white"}`}
                                  >
                                    Join {code}
                                  </button>
                                </div>
                              )}

                              <div className={`mt-1 text-[9px] ${mine ? "text-indigo-100" : "text-gray-500"}`}>
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>

                            {mine && <div className="text-xl mt-1">{msg.profiles?.avatar || profile.avatar}</div>}
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="p-3 border-t flex items-center gap-2">
                    <input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                      placeholder="Type a message…"
                      className="flex-1 px-3 py-2 border rounded-xl text-sm"
                    />
                    <button onClick={handleSendMessage} className="bg-indigo-500 text-white px-3 py-2 rounded-xl">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* RIGHT: Members */}
                <div className="w-60 flex flex-col border-l">
                  <div className="px-4 py-2 border-b text-[11px] text-gray-500 flex items-center gap-1">
                    <Users className="w-3 h-3" /> Members
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {loadingMembers ? (
                      <div className="text-xs text-gray-500">Loading members…</div>
                    ) : members.length === 0 ? (
                      <div className="text-xs text-gray-400">No members in this group.</div>
                    ) : (
                      members.map((m) => {
                        const p = m.profiles;
                        const isMe = p.id === profile.id;
                        return (
                          <div key={m.id} className="flex items-center gap-2 p-2 bg-gray-50 border rounded-xl text-xs">
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

                            {isOwner && !isMe && (
                              <div className="flex flex-col gap-1">
                                {m.role === "member" && (
                                  <button onClick={() => handlePromoteToAdmin(m)} className="p-1 rounded-lg bg-indigo-100 hover:bg-indigo-200">
                                    <Shield className="w-3 h-3 text-indigo-700" />
                                  </button>
                                )}
                                <button onClick={() => handleKickMember(m)} className="p-1 rounded-lg bg-red-50 hover:bg-red-100">
                                  <XCircle className="w-3 h-3 text-red-600" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

{/* MOBILE: sliding panels (visible under md) */}
<div className="md:hidden flex flex-col h-full">

  {/* ---------- TOP NAV ---------- */}
  <div className="flex items-center justify-between px-4 py-2 border-b bg-white z-20">
    <div className="flex items-center gap-2">
      {onBack && (
        <button onClick={onBack} className="p-1 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}
      <Users className="w-5 h-5 text-indigo-600" />
      <span className="font-bold">Groups</span>
    </div>

    <div className="flex items-center gap-1 text-xs">
      <button
        onClick={() => setMobilePage(0)}
        className={`px-3 py-1 rounded-full ${
          mobilePage === 0 ? "bg-indigo-500 text-white" : "bg-gray-100"
        }`}
      >
        Groups
      </button>

      <button
        onClick={() => setMobilePage(1)}
        className={`px-3 py-1 rounded-full ${
          mobilePage === 1 ? "bg-indigo-500 text-white" : "bg-gray-100"
        }`}
      >
        Chat
      </button>

      <button
        onClick={() => setMobilePage(2)}
        className={`px-3 py-1 rounded-full ${
          mobilePage === 2 ? "bg-indigo-500 text-white" : "bg-gray-100"
        }`}
      >
        Members
      </button>
    </div>
  </div>

  {/* ---------- FIXED SLIDER WRAPPER ---------- */}
  <div
    className="relative flex-1 overflow-hidden"  // prevents showing all pages
    onTouchStart={onTouchStart}
    onTouchMove={onTouchMove}
    onTouchEnd={onTouchEnd}
  >
    <div
      className="flex h-full transition-transform duration-300"
      style={{ transform: `translateX(-${mobilePage * 100}%)` }}  // EXACT full-page snap
    >

      {/* ----------------------------------
          PANEL 0 — GROUPS LIST
      ----------------------------------- */}
      <div className="w-full min-w-full flex-shrink-0 overflow-y-auto bg-gray-50">
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">My Groups</div>
            <button
              onClick={loadGroups}
              className="text-xs px-2 py-1 rounded bg-gray-200"
            >
              {loadingGroups ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                "↻"
              )}
            </button>
          </div>

          <div className="space-y-2">
            {memberships.map((m) => {
              const g = m.groups;
              const active = g.id === selectedGroupId;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelectedGroupId(g.id);
                    setMobilePage(1);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-3 text-left rounded ${
                    active ? "bg-indigo-50" : "hover:bg-gray-100"
                  }`}
                >
                  <span className="text-2xl">{g.avatar}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{g.name}</div>
                    <div className="text-[11px] text-gray-500">
                      {m.role}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* create / join */}
        <div className="p-3 border-t space-y-2">
          <button
            onClick={() => {
              setCreating(true);
              setJoining(false);
            }}
            className="w-full bg-indigo-500 text-white py-2 rounded-xl text-sm font-semibold"
          >
            <Plus className="w-4 h-4 inline-block mr-2" /> New Group
          </button>

          <button
            onClick={() => {
              setJoining(true);
              setCreating(false);
            }}
            className="w-full bg-gray-200 text-gray-800 py-2 rounded-xl text-sm font-semibold"
          >
            Join with Code
          </button>
        </div>
      </div>

      {/* ----------------------------------
          PANEL 1 — CHAT
      ----------------------------------- */}
      <div className="w-full min-w-full flex-shrink-0 flex flex-col overflow-y-auto">
        {!selectedGroup ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 p-4">
            Select a group to begin.
          </div>
        ) : (
          <>
            {/* chat header */}
            <div className="px-4 py-2 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selectedGroup.avatar}</span>
                <div>
                  <div className="font-semibold">{selectedGroup.name}</div>
                  <div className="text-xs text-gray-500">
                    {members.length} member{members.length !== 1 && "s"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleStartGameClick}
                  className="bg-indigo-500 text-white px-3 py-1.5 rounded text-sm"
                >
                  <Gamepad2 className="w-4 h-4 inline-block" />
                </button>

                <button
                  onClick={handleLeaveGroup}
                  className="bg-red-50 text-red-600 px-3 py-1.5 rounded text-sm"
                >
                  <LogOut className="w-4 h-4 inline-block" />
                </button>
              </div>
            </div>

            {/* chat messages */}
            <div className="flex-1 overflow-auto p-3 space-y-3">
              {loadingMessages ? (
                <div className="text-xs text-gray-500">Loading messages…</div>
              ) : messages.length === 0 ? (
                <div className="text-xs text-gray-400">
                  No messages yet. Say hi 👋
                </div>
              ) : (
                messages.map((msg) => {
                  const mine = msg.profile_id === profile.id;
                  const code = extractRoomCode(msg.content);

                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-2 ${
                        mine ? "justify-end" : "justify-start"
                      }`}
                    >
                      {!mine && (
                        <div className="text-xl mt-1">
                          {msg.profiles?.avatar || "🙂"}
                        </div>
                      )}

                      <div
                        className={`max-w-[76%] px-3 py-2 rounded-2xl text-sm ${
                          mine
                            ? "bg-indigo-500 text-white"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        <div className="font-semibold text-xs mb-1">
                          {msg.profiles?.name}
                        </div>

                        <div className="whitespace-pre-wrap">
                          {msg.content}
                        </div>

                        {code && (
                          <div className="mt-2">
                            <button
                              onClick={() => handleQuickJoin(code)}
                              className={`px-2 py-1 text-[13px] rounded-full ${
                                mine
                                  ? "bg-white text-indigo-600"
                                  : "bg-indigo-500 text-white"
                              }`}
                            >
                              Join {code}
                            </button>
                          </div>
                        )}

                        <div className="mt-1 text-[11px] text-gray-400">
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>

                      {mine && (
                        <div className="text-xl mt-1">
                          {msg.profiles?.avatar || profile.avatar}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* chat input */}
            <div className="p-3 border-t flex items-center gap-2">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Type a message…"
                className="flex-1 px-3 py-2 border rounded-xl text-sm"
              />

              <button
                onClick={handleSendMessage}
                className="bg-indigo-500 text-white px-3 py-2 rounded-xl"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* ----------------------------------
          PANEL 2 — MEMBERS
      ----------------------------------- */}
      <div className="w-full min-w-full flex-shrink-0 overflow-y-auto bg-white">
        <div className="px-4 py-2 border-b">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <div className="font-semibold">Members</div>
          </div>
        </div>

        <div className="p-3 space-y-3">
          {loadingMembers ? (
            <div className="text-xs text-gray-500">Loading members…</div>
          ) : members.length === 0 ? (
            <div className="text-xs text-gray-400">No members in this group.</div>
          ) : (
            members.map((m) => {
              const p = m.profiles;
              const isMe = p.id === profile.id;

              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                >
                  <div className="text-2xl">{p.avatar}</div>

                  <div className="flex-1">
                    <div className="font-semibold">
                      {p.name}{" "}
                      {isMe && (
                        <span className="text-xs text-indigo-500">(you)</span>
                      )}
                    </div>

                    <div className="text-xs text-gray-500">{m.role}</div>
                  </div>

                  {isOwner && !isMe && (
                    <div className="flex gap-2">
                      {m.role === "member" && (
                        <button
                          onClick={() => handlePromoteToAdmin(m)}
                          className="p-2 bg-indigo-100 rounded"
                        >
                          <Shield className="w-4 h-4 text-indigo-700" />
                        </button>
                      )}

                      <button
                        onClick={() => handleKickMember(m)}
                        className="p-2 bg-red-50 rounded"
                      >
                        <XCircle className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  </div>
</div>

  );
}
