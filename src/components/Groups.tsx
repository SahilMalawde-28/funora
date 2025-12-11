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
  // Called when the user clicks "Start Game" in a group (App will create a room and join current user)
  onStartGroupGame?: (args: { group: Group; members: Profile[] }) => Promise<{ roomCode?: string } | void> | void;
  // Optional: called when user clicks quick "Join" on a room code inside a message
  onQuickJoinRoom?: (code: string) => Promise<{ success: boolean; message?: string } | void> | void;
  onBack?: () => void;
}

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
  const isOwner = selectedGroup && selectedGroup.owner_id === profile.id;

  /* ---------------------------------------------
   * LOAD USER GROUPS
   * ------------------------------------------- */
  const loadGroups = async () => {
    if (!profile?.id) return;
    setLoadingGroups(true);

    const { data, error } = await supabase
      .from("group_members")
      .select("id, role, group_id, groups(id, name, avatar, owner_id)")
      .eq("profile_id", profile.id)
      .order("joined_at", { ascending: true }); // rely on joined_at existing

    if (error) {
      console.error("Error loading groups:", error);
      setMemberships([]);
    } else {
      setMemberships(data as GroupMembership[]);
      if (!selectedGroupId && data && data.length > 0) {
        setSelectedGroupId(data[0].group_id);
      }
    }

    setLoadingGroups(false);
  };

  useEffect(() => {
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  /* ---------------------------------------------
   * LOAD MEMBERS FOR CURRENT GROUP
   * ------------------------------------------- */
  const loadMembers = async (groupId: string) => {
    setLoadingMembers(true);

    const { data, error } = await supabase
      .from("group_members")
      .select("id, role, profile_id, profiles(id, name, avatar)")
      .eq("group_id", groupId)
      .order("joined_at", { ascending: true });

    if (error) {
      console.error("Error loading group members:", error);
      setMembers([]);
    } else {
      setMembers(data as GroupMemberRow[]);
    }

    setLoadingMembers(false);
  };

  /* ---------------------------------------------
   * LOAD MESSAGES FOR CURRENT GROUP
   * ------------------------------------------- */
  const loadMessages = async (groupId: string) => {
    setLoadingMessages(true);

    const { data, error } = await supabase
      .from("group_messages")
      .select("id, group_id, profile_id, content, created_at, profiles(id, name, avatar)")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading messages:", error);
      setMessages([]);
    } else {
      setMessages(data as GroupMessageRow[]);
    }

    setLoadingMessages(false);
  };

  /* ---------------------------------------------
   * WHEN SELECTED GROUP CHANGES → load members + msgs
   * ------------------------------------------- */
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
        () => {
          // reload messages incrementally is fine; keep it simple
          loadMessages(selectedGroupId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId]);

  /* ---------------------------------------------
   * CREATE GROUP
   * ------------------------------------------- */
  const handleCreateGroup = async () => {
    if (!profile?.id) return;
    if (!newGroupName.trim()) return;

    setBusyAction(true);
    try {
      const { data: group, error } = await supabase
        .from("groups")
        .insert({
          name: newGroupName.trim(),
          avatar: "👥",
          owner_id: profile.id,
        })
        .select()
        .single();

      if (error || !group) {
        console.error("Error creating group:", error);
        alert("Failed to create group");
        setBusyAction(false);
        return;
      }

      const { error: mErr } = await supabase.from("group_members").insert({
        group_id: group.id,
        profile_id: profile.id,
        role: "owner",
      });

      if (mErr) {
        console.error("Error adding creator as group member:", mErr);
      }

      setNewGroupName("");
      setCreating(false);
      await loadGroups();
      setSelectedGroupId(group.id);
      alert("Group created ✅");
    } catch (err) {
      console.error(err);
      alert("Something went wrong creating group");
    } finally {
      setBusyAction(false);
    }
  };

  /* ---------------------------------------------
   * JOIN GROUP BY CODE (group.id)
   * ------------------------------------------- */
  const handleJoinGroup = async () => {
    if (!profile?.id) return;
    if (!joinCode.trim()) return;

    const trimmed = joinCode.trim();

    setBusyAction(true);
    try {
      const { data: group, error: gErr } = await supabase
        .from("groups")
        .select("*")
        .eq("id", trimmed)
        .single();

      if (gErr || !group) {
        console.error("Group not found:", gErr);
        alert("Invalid group code");
        setBusyAction(false);
        return;
      }

      const { data: existing, error: eErr } = await supabase
        .from("group_members")
        .select("id")
        .eq("group_id", group.id)
        .eq("profile_id", profile.id)
        .maybeSingle();

      if (eErr) {
        console.error("Error checking membership:", eErr);
      }

      if (existing) {
        alert("You’re already in this group");
        setJoinCode("");
        setJoining(false);
        setBusyAction(false);
        return;
      }

      const { error: mErr } = await supabase.from("group_members").insert({
        group_id: group.id,
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
      setSelectedGroupId(group.id);
      alert(`Joined group: ${group.name}`);
    } catch (err) {
      console.error(err);
      alert("Something went wrong joining group");
    } finally {
      setBusyAction(false);
    }
  };

  /* ---------------------------------------------
   * LEAVE GROUP
   * ------------------------------------------- */
  const handleLeaveGroup = async () => {
    if (!selectedMembership || !selectedGroup) return;

    const isOwnerOfGroup = selectedGroup.owner_id === profile.id;
    if (isOwnerOfGroup && members.length > 1) {
      alert("You are the owner. Transfer ownership or remove others before leaving.");
      return;
    }

    if (!confirm("Leave this group?")) return;

    try {
      await supabase.from("group_members").delete().eq("id", selectedMembership.id);

      // If owner & alone → optionally delete the group itself
      if (isOwnerOfGroup && members.length <= 1) {
        await supabase.from("groups").delete().eq("id", selectedGroup.id);
      }

      setSelectedGroupId(null);
      await loadGroups();
    } catch (err) {
      console.error("Error leaving group:", err);
      alert("Failed to leave group");
    }
  };

  /* ---------------------------------------------
   * OWNER ACTIONS: promote / kick
   * ------------------------------------------- */
  const handlePromoteToAdmin = async (member: GroupMemberRow) => {
    if (!isOwner) return;
    if (member.role === "owner" || member.role === "admin") return;

    try {
      await supabase.from("group_members").update({ role: "admin" }).eq("id", member.id);
      await loadMembers(member.group_id ?? selectedGroupId!);
    } catch (err) {
      console.error("Error promoting member:", err);
      alert("Failed to promote");
    }
  };

  const handleKickMember = async (member: GroupMemberRow) => {
    if (!isOwner) return;
    if (member.role === "owner") return;
    if (!confirm(`Remove ${member.profiles.name} from this group?`)) return;

    try {
      await supabase.from("group_members").delete().eq("id", member.id);
      await loadMembers(member.group_id ?? selectedGroupId!);
    } catch (err) {
      console.error("Error kicking member:", err);
      alert("Failed to remove member");
    }
  };

  /* ---------------------------------------------
   * SEND MESSAGE
   * ------------------------------------------- */
  const handleSendMessage = async () => {
    if (!selectedGroupId || !newMessage.trim()) return;

    const content = newMessage.trim();
    // optimistic UI: clear input immediately (messages will be reloaded from DB via realtime)
    setNewMessage("");

    const { error } = await supabase.from("group_messages").insert({
      group_id: selectedGroupId,
      profile_id: profile.id,
      content,
    });

    if (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message");
    }
  };

  /* ---------------------------------------------
   * START GAME (call back to App.tsx)
   * ------------------------------------------- */
  const handleStartGameClick = async () => {
    if (!selectedGroup) return;
    if (!members.length) return;

    const memberProfiles = members.map((m) => m.profiles);

    try {
      let roomCode: string | undefined;

      if (onStartGroupGame) {
        const result = await onStartGroupGame({
          group: selectedGroup,
          members: memberProfiles,
        });
        if (result && "roomCode" in result && result.roomCode) {
          roomCode = result.roomCode;
        }
      }

      // Post message with code (if available) or generic note
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
          content:
            "🎮 Party started! The host created a Funora room. Ask them for the room code to join.",
        });
      }
    } catch (err) {
      console.error("Error starting group game:", err);
      alert("Failed to start game");
    }
  };

  /* ---------------------------------------------
   * QUICK JOIN support (detect 6-char codes in messages)
   * ------------------------------------------- */
  const ROOM_CODE_REGEX = /\b([A-Z0-9]{6})\b/g; // pattern for "A" format

  // check room status for a code
  const checkRoomStatus = async (code: string) => {
    const { data, error } = await supabase
      .from("rooms")
      .select("id, code, status")
      .eq("code", code)
      .maybeSingle();

    if (error) {
      console.error("Error checking room:", error);
      return null;
    }
    return data as { id: string; code: string; status: string } | null;
  };

  // called when user presses Join button on a message code
  const handleQuickJoin = async (code: string) => {
    if (!code) return;

    // optional prop hook: let parent handle the join (preferred)
    if (onQuickJoinRoom) {
      try {
        const res = await onQuickJoinRoom(code);
        // If parent returns feedback, show it
        if (res && "success" in res && !res.success) {
          alert(res.message || "Failed to join room");
        }
        return;
      } catch (err) {
        console.error("onQuickJoinRoom failed:", err);
        alert("Quick join failed");
        return;
      }
    }

    // fallback: check room existence & status, copy code for the user
    const r = await checkRoomStatus(code);
    if (!r) {
      navigator.clipboard.writeText(code);
      alert("Room not found. Code copied to clipboard.");
      return;
    }
    if (r.status !== "lobby") {
      navigator.clipboard.writeText(code);
      alert(`Room exists but is ${r.status}. Code copied to clipboard.`);
      return;
    }

    // If no parent hook but lobby exists, copy and instruct user
    navigator.clipboard.writeText(code);
    alert(`Room ${code} is open (lobby). Code copied — paste it in Join Room to enter.`);
  };

  /* ---------------------------------------------
   * RENDER
   * ------------------------------------------- */
  return (
    <div className="relative flex w-full h-[80vh] max-h-[800px] bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden">
      {/* LEFT: My Groups */}
      <div className="w-64 border-right border-gray-200 bg-gray-50 flex flex-col border-r">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            {onBack && (
              <button onClick={onBack} className="mr-1 p-1 rounded-full hover:bg-gray-200">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <Users className="w-5 h-5 text-indigo-600" />
            <span className="font-bold text-gray-800 text-sm">My Groups</span>
          </div>

          <button onClick={loadGroups} className="text-xs px-2 py-1 rounded-full bg-gray-200 hover:bg-gray-300">
            {loadingGroups ? <Loader2 className="w-3 h-3 animate-spin" /> : "↻"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingGroups ? (
            <div className="p-4 text-xs text-gray-500">Loading groups…</div>
          ) : memberships.length === 0 ? (
            <div className="p-4 text-xs text-gray-500">You’re not in any groups yet. Create or join one!</div>
          ) : (
            memberships.map((m) => {
              const g = m.groups;
              const active = g.id === selectedGroupId;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedGroupId(g.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm border-b border-gray-200 ${
                    active ? "bg-indigo-50 border-l-4 border-l-indigo-500" : "bg-gray-50 hover:bg-gray-100"
                  }`}
                >
                  <span className="text-2xl">{g.avatar}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800 truncate">{g.name}</div>
                    <div className="text-[10px] text-gray-500 flex items-center gap-1">
                      {m.role === "owner" && (
                        <>
                          <Crown className="w-3 h-3 text-yellow-500" /> Owner
                        </>
                      )}
                      {m.role === "admin" && (
                        <>
                          <Shield className="w-3 h-3 text-indigo-500" /> Admin
                        </>
                      )}
                      {m.role === "member" && "Member"}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="p-3 border-t border-gray-200 space-y-2">
          {!creating && (
            <button
              onClick={() => {
                setCreating(true);
                setJoining(false);
              }}
              className="w-full text-xs flex items-center justify-center gap-1 py-2 rounded-xl bg-indigo-500 text-white font-semibold hover:bg-indigo-600"
            >
              <Plus className="w-3 h-3" /> New Group
            </button>
          )}
          {!joining && (
            <button
              onClick={() => {
                setJoining(true);
                setCreating(false);
              }}
              className="w-full text-xs flex items-center justify-center gap-1 py-2 rounded-xl bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300"
            >
              Join with Code
            </button>
          )}
        </div>
      </div>

      {/* RIGHT: Group Detail / Chat */}
      <div className="flex-1 flex flex-col">
        {!selectedGroup ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            {memberships.length === 0 ? "Create or join a group to get started." : "Select a group from the left sidebar."}
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedGroup.avatar}</span>
                <div>
                  <div className="font-bold text-gray-800 flex items-center gap-2">
                    {selectedGroup.name}
                    {isOwner && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300">
                        <Crown className="w-3 h-3" /> Owner
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500">{members.length} member{members.length !== 1 && "s"}</div>
                  <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                    Group ID: <code className="font-mono">{selectedGroup.id.slice(0, 8)}…</code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedGroup.id);
                        alert("Group ID copied!");
                      }}
                      className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-200 hover:bg-gray-300"
                    >
                      <Copy className="w-3 h-3 inline-block" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleStartGameClick}
                  disabled={members.length === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Gamepad2 className="w-4 h-4" />
                  Start Game
                </button>
                <button
                  onClick={handleLeaveGroup}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100"
                >
                  <LogOut className="w-4 h-4" />
                  Leave
                </button>
              </div>
            </div>

            {/* Content: Chat + Members */}
            <div className="flex flex-1 min-h-0">
              {/* Chat */}
              <div className="flex-1 flex flex-col border-r border-gray-200">
                <div className="px-4 py-2 text-[11px] text-gray-500 flex items-center gap-1 border-b border-gray-100">
                  <MessageCircle className="w-3 h-3" />
                  Group chat
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {loadingMessages ? (
                    <div className="text-xs text-gray-500">Loading messages…</div>
                  ) : messages.length === 0 ? (
                    <div className="text-xs text-gray-400">No messages yet. Say hi 👋</div>
                  ) : (
                    messages.map((msg) => {
                      const mine = msg.profile_id === profile.id;

                      // find first 6-char codes in message (uppercase)
                      const foundCodes = Array.from((msg.content || "").toUpperCase().matchAll(ROOM_CODE_REGEX)).map((m) => m[1]);

                      return (
                        <div key={msg.id} className={`flex gap-2 mb-1 ${mine ? "justify-end" : "justify-start"}`}>
                          {!mine && <div className="text-xl mt-1">{msg.profiles?.avatar || "🙂"}</div>}
                          <div className={`max-w-[70%] rounded-2xl px-3 py-2 text-xs ${mine ? "bg-indigo-500 text-white rounded-br-none" : "bg-gray-100 text-gray-800 rounded-bl-none"}`}>
                            <div className="font-semibold text-[11px] mb-0.5 flex items-center gap-1">
                              {msg.profiles?.name || "Player"}
                              {msg.profile_id === selectedGroup.owner_id && (<span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800">Owner</span>)}
                            </div>

                            <div className="whitespace-pre-wrap">
                              {msg.content}
                            </div>

                            {/* Quick join badges for codes found in this message */}
                            {foundCodes.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {foundCodes.map((code) => (
                                  <QuickJoinBadge key={code} code={code} onClick={() => handleQuickJoin(code)} />
                                ))}
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

                {/* Input */}
                <div className="p-3 border-t border-gray-200 flex items-center gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type a message…"
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    className="p-2 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Members */}
              <div className="w-60 flex flex-col">
                <div className="px-4 py-2 text-[11px] text-gray-500 border-b border-gray-100 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  Members
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
                        <div key={m.id} className="flex items-center gap-2 p-2 rounded-xl bg-gray-50 border border-gray-200 text-xs">
                          <span className="text-2xl">{p.avatar}</span>
                          <div className="flex-1">
                            <div className="font-semibold text-gray-800 flex items-center gap-1">
                              {p.name}
                              {isMe && <span className="text-[9px] text-indigo-500">(you)</span>}
                            </div>
                            <div className="text-[10px] text-gray-500 flex items-center gap-1">
                              {m.role === "owner" && (
                                <>
                                  <Crown className="w-3 h-3 text-yellow-500" /> Owner
                                </>
                              )}
                              {m.role === "admin" && (
                                <>
                                  <Shield className="w-3 h-3 text-indigo-500" /> Admin
                                </>
                              )}
                              {m.role === "member" && "Member"}
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

        {/* CREATION / JOIN PANELS */}
        {(creating || joining) && (
          <div className="absolute bottom-6 left-6 w-80 bg-white border border-gray-200 shadow-xl rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-gray-800">{creating ? "Create Group" : "Join Group"}</span>
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
                <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Group name" className="w-full border rounded-xl px-3 py-2 text-sm" />
                <button onClick={handleCreateGroup} disabled={!newGroupName.trim() || busyAction} className="w-full text-sm font-semibold bg-indigo-500 text-white py-2.5 rounded-xl hover:bg-indigo-600 disabled:opacity-40">
                  {busyAction ? "Creating…" : "Create"}
                </button>
              </>
            )}

            {joining && (
              <>
                <p className="text-[11px] text-gray-500">Ask a friend to share the group ID (UUID) and paste it here.</p>
                <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Group ID" className="w-full border rounded-xl px-3 py-2 text-sm font-mono text-xs" />
                <button onClick={handleJoinGroup} disabled={!joinCode.trim() || busyAction} className="w-full text-sm font-semibold bg-gray-800 text-white py-2.5 rounded-xl hover:bg-gray-900 disabled:opacity-40">
                  {busyAction ? "Joining…" : "Join"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------
 * Small presentational badge + join button
 * ------------------------------------- */
function QuickJoinBadge({ code, onClick }: { code: string; onClick: () => void }) {
  return (
    <div className="inline-flex items-center gap-2 border border-gray-200 bg-white px-2 py-1 rounded-full text-xs">
      <code className="font-mono text-[11px]">{code}</code>
      <button onClick={onClick} className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500 text-white hover:bg-indigo-600">
        Join
      </button>
    </div>
  );
}
