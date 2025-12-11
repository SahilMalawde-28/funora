import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { MessageCircle, Send, X } from "lucide-react";

export default function FloatingGroupChat({ groupId, profile }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  // Load messages
  const loadMessages = async () => {
    const { data } = await supabase
      .from("group_messages")
      .select("*, profiles(id, name, avatar)")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true });

    setMessages(data || []);
  };

  // Send message
  const sendMessage = async () => {
    if (!input.trim()) return;

    const content = input.trim();
    setInput("");

    await supabase.from("group_messages").insert({
      group_id: groupId,
      profile_id: profile.id,
      content,
    });
  };

  // Realtime listener
  useEffect(() => {
    if (!groupId) return;

    loadMessages();

    const channel = supabase
      .channel(`group-chat-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          table: "group_messages",
          schema: "public",
          filter: `group_id=eq.${groupId}`
        },
        loadMessages
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [groupId]);

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 left-6 bg-indigo-600 text-white p-4 rounded-full shadow-xl hover:scale-110 transition z-[9999]"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat Drawer */}
      {open && (
        <div className="fixed bottom-6 left-6 w-80 h-[400px] bg-white shadow-2xl rounded-2xl border border-gray-200 flex flex-col z-[9999]">
          
          {/* Header */}
          <div className="p-3 border-b flex items-center justify-between bg-indigo-50 rounded-t-2xl">
            <span className="font-bold text-gray-800">Group Chat</span>
            <button onClick={() => setOpen(false)}>
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.map((msg) => {
              const mine = msg.profile_id === profile.id;
              return (
                <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[70%] px-3 py-2 text-sm rounded-2xl ${
                      mine
                        ? "bg-indigo-500 text-white rounded-br-none"
                        : "bg-gray-100 text-gray-800 rounded-bl-none"
                    }`}
                  >
                    {!mine && (
                      <div className="font-semibold text-xs mb-1">
                        {msg.profiles?.name}
                      </div>
                    )}
                    {msg.content}
                    <div className={`text-[9px] mt-1 ${mine ? "text-indigo-200" : "text-gray-500"}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input */}
          <div className="p-3 border-t flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              className="flex-1 border rounded-xl px-3 py-2 text-sm"
              placeholder="Message..."
            />
            <button
              onClick={sendMessage}
              className="bg-indigo-600 text-white px-4 rounded-xl"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
