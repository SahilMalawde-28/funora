// src/components/games/HerdGame.tsx
import React, { useEffect, useState, useRef } from "react";
import { Room, Player, supabase } from "../../lib/supabase";
import {
  HerdGameState,
  HerdPlayer,
  initHerdGame,
  herdSubmitAnswer,
  herdEvaluateRound,
} from "../../lib/gameLogic";

interface HerdGameProps {
  room: Room;
  players: Player[]; // each player should have player_id or id and name
  currentPlayer: Player;
  gameState: HerdGameState | null; // initial state from parent (may be null)
  onUpdateState: (s: HerdGameState) => Promise<void> | void; // parent persistence handler
  onEndGame?: () => void;
}

/**
 * HerdGame UI with Supabase persistence & realtime.
 *
 * - Host can Start the game (init state persisted)
 * - Players submit answers (persisted)
 * - Auto-eval when everyone submitted (host still can force-evaluate)
 * - View answers toggle available to everyone
 * - Next Round and Evaluate buttons for host
 * - No external UI libs used
 */

export default function HerdGame({
  room,
  players,
  currentPlayer,
  gameState,
  onUpdateState,
  onEndGame,
}: HerdGameProps) {
  const [local, setLocal] = useState<HerdGameState | null>(gameState);
  const [input, setInput] = useState("");
  const [showAnswers, setShowAnswers] = useState(false);
  const [loading, setLoading] = useState(false);
  const subscriptionRef = useRef<any>(null);

  // normalize id helpers
  const myId = currentPlayer?.player_id ?? (currentPlayer?.id as string);
  const hostId = room?.host_id ?? (room?.hostId as string);
  const isHost = myId && hostId && myId === hostId;

  useEffect(() => {
    setLocal(gameState);
  }, [gameState]);

  // subscribe to changes in game_states table (if Supabase real-time available)
  useEffect(() => {
    // don't throw if supabase not available
    if (!supabase || !room?.id) return;

    // unsubscribe previous
    if (subscriptionRef.current) {
      try { subscriptionRef.current.unsubscribe(); } catch (_) {}
      subscriptionRef.current = null;
    }

    // subscribe to changes for this room & game 'herd'
    try {
      subscriptionRef.current = supabase
        .channel(`public:game_states:room_${room.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "game_states", filter: `room_id=eq.${room.id}` },
          async (payload: any) => {
            try {
              const rec = payload?.new;
              if (!rec) return;
              if (rec.game !== "herd") return;
              const s: HerdGameState = rec.state;
              setLocal(s);
            } catch (e) {
              // ignore parse errors
            }
          }
        )
        .subscribe();
    } catch (err) {
      // fall back silently if realtime API differs
      console.warn("HerdGame: realtime subscribe failed", err);
    }

    return () => {
      if (subscriptionRef.current) {
        try { subscriptionRef.current.unsubscribe(); } catch (_) {}
        subscriptionRef.current = null;
      }
    };
  }, [room?.id]);

  // safe persist helper (upsert to game_states table)
  async function safePersistState(s: HerdGameState) {
    // call parent updater first (if provided) for app-level sync
    try {
      if (onUpdateState) await onUpdateState(s);
    } catch (e) {
      console.warn("HerdGame: onUpdateState failed", e);
    }

    // try supabase upsert (table game_states has columns: room_id (text), game (text), state (jsonb))
    try {
      if (supabase && supabase.from) {
        await supabase.from("game_states").upsert(
          { room_id: s.roomId ?? (room?.id ?? room?.room_id), game: "herd", state: s },
          { onConflict: ["room_id", "game"] }
        );
      }
    } catch (err) {
      console.warn("HerdGame: supabase persist failed", err);
    }
  }

  // Host starts a new game
  const startGame = async () => {
    if (!isHost) return;
    setLoading(true);
    const inputPlayers = players.map(p => ({ id: p.player_id ?? p.id, name: p.name ?? p.display_name ?? p.player_name ?? "Anon" }));
    const s = initHerdGame(inputPlayers, room?.id ?? room?.room_id);
    setLocal(s);
    await safePersistState(s);
    setLoading(false);
  };

  // Submit answer (local state + persist)
  const handleSubmit = async () => {
    if (!local || !myId) return;
    if (!input.trim()) return;
    setLoading(true);
    const s1 = herdSubmitAnswer(local, myId, input.trim());
    setLocal(s1);
    await safePersistState(s1);
    setInput("");
    setLoading(false);

    // auto-evaluate if everyone has answered (active players only)
    tryAutoEvaluate(s1);
  };

  // Check if everyone has answered: if yes, call herdEvaluateRound and persist result
  const tryAutoEvaluate = async (s: HerdGameState) => {
    if (!s) return;
    const active = s.players.filter(p => p.score > -6);
    const answeredCount = active.filter(p => (p.answer !== undefined && p.answer !== null)).length;
    // treat blank string as an answer if user explicitly submitted ""
    // We require answers for all *active* players
    if (answeredCount >= active.length && active.length > 0) {
      // do evaluation
      setLoading(true);
      const evaluated = herdEvaluateRound(s);
      setLocal(evaluated);
      await safePersistState(evaluated);
      setLoading(false);
    }
  };

  // Host forces evaluate
  const handleEvaluate = async () => {
    if (!local || !isHost) return;
    setLoading(true);
    const evaluated = herdEvaluateRound(local);
    setLocal(evaluated);
    await safePersistState(evaluated);
    setLoading(false);
  };

  // Host moves to next round explicitly (alias to evaluate+persist)
  const handleNextRound = async () => {
    if (!local || !isHost) return;
    setLoading(true);
    const evaluated = herdEvaluateRound(local);
    setLocal(evaluated);
    await safePersistState(evaluated);
    setLoading(false);
  };

  // Format players for display (preserve order)
  const renderScore = (p: HerdPlayer) => (
    <div
      key={p.id}
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "10px 14px",
        background: "#f3f4f6",
        borderRadius: 8,
        marginBottom: 6,
      }}
    >
      <span style={{ fontWeight: 500 }}>
        {p.name} {p.score <= -6 && <span style={{ color: "#ef4444", fontSize: 12 }}> (Eliminated)</span>}
      </span>
      <span style={{ color: p.score <= -4 ? "#ef4444" : "#16a34a", fontWeight: 600 }}>{p.score}</span>
    </div>
  );

  // If not started / local null -> show lobby + start button for host
  if (!local) {
    return (
      <div style={{ background: "#f9fafb", color: "#111827", padding: 20, minHeight: "100vh" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 2px 10px rgba(0,0,0,0.08)", textAlign: "center" }}>
          <h2 style={{ fontSize: 26, marginBottom: 6 }}>🐮 Herd Mentality</h2>
          <p style={{ color: "#6b7280", marginBottom: 20 }}>Majority survives. Minority loses 1 point. First to reach -6 loses.</p>

          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginBottom: 20 }}>
            {players.map(p => (
              <div key={p.player_id ?? p.id} style={{ background: "#f3f4f6", padding: "8px 14px", borderRadius: 8, fontWeight: 500 }}>
                {p.name ?? p.player_id ?? p.id}
              </div>
            ))}
          </div>

          {isHost ? (
            <button onClick={startGame} disabled={loading} style={{ background: "#3b82f6", color: "#fff", padding: "10px 16px", borderRadius: 8, border: "none", cursor: "pointer" }}>
              {loading ? "Starting..." : "Start Herd Mentality"}
            </button>
          ) : (
            <p style={{ color: "#9ca3af" }}>Waiting for host to start the game...</p>
          )}
        </div>
      </div>
    );
  }

  // Active game UI
  const curCategory = local.category;
  const phase = local.phase;
  const round = local.round;
  const activePlayers = local.players.filter(p => p.score > -6);
  const answeredCount = activePlayers.filter(p => p.answer !== undefined && p.answer !== null).length;
  const myState = local.players.find(p => p.id === myId);

  return (
    <div style={{ background: "#f9fafb", color: "#111827", padding: 16, minHeight: "100vh" }}>
      <div style={{ maxWidth: 940, margin: "0 auto", background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 10px rgba(0,0,0,0.08)" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0 }}>🐮 Herd Mentality</h2>
            <div style={{ color: "#6b7280" }}>Round {round} • Category: <b>{curCategory}</b></div>
          </div>
          <div style={{ color: "#6b7280", fontSize: 14, marginTop: 4 }}>
            {phase === "answering" ? `Answer now (${answeredCount}/${activePlayers.length} answered)` : phase === "reveal" ? "Revealing..." : "Finished"}
          </div>
        </div>

        {/* Layout: left column input/result, right column scores */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12 }}>
          {/* Left column */}
          <div>
            {/* Input area */}
            {phase !== "ended" && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ marginBottom: 8, color: "#374151" }}>
                  Type your answer (single word/phrase). Try to pick what you think most others will pick.
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Your answer..."
                    style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 16 }}
                    disabled={!!myState?.answer}
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={!!myState?.answer || input.trim() === "" || loading}
                    style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "10px 12px", fontWeight: 600, cursor: "pointer" }}
                  >
                    {loading ? "..." : (myState?.answer ? "Submitted" : "Submit")}
                  </button>
                </div>
              </div>
            )}

            {/* Reveal / last result */}
            <div style={{ background: "#f3f4f6", padding: 14, borderRadius: 8, marginBottom: 16 }}>
              <h4 style={{ margin: "4px 0 10px" }}>Round Results</h4>

              {local.lastResult ? (
                <>
                  <p style={{ color: "#4b5563" }}>
                    Majority answers: <b>{(local.lastResult.majorityAnswers && local.lastResult.majorityAnswers.length) ? local.lastResult.majorityAnswers.join(", ") : "None"}</b>
                  </p>

                  {local.lastResult.penalties && Object.keys(local.lastResult.penalties).length > 0 ? (
                    <ul style={{ color: "#dc2626", marginTop: 6 }}>
                      {Object.entries(local.lastResult.penalties).map(([id, delta]) => {
                        const p = local.players.find(pl => pl.id === id);
                        const name = p ? p.name : id;
                        return <li key={id}>{name}: {delta > 0 ? "+" : ""}{delta}</li>;
                      })}
                    </ul>
                  ) : (
                    <p style={{ color: "#6b7280" }}>No penalties this round.</p>
                  )}
                </>
              ) : (
                <p style={{ color: "#6b7280" }}>No result yet.</p>
              )}

              <div style={{ marginTop: 8 }}>
                <button onClick={() => setShowAnswers(v => !v)} style={{ marginRight: 8, background: "#e5e7eb", color: "#111827", border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}>
                  {showAnswers ? "Hide Answers" : "View All Answers"}
                </button>

                {isHost && (
                  <>
                    <button onClick={handleEvaluate} disabled={loading} style={{ marginRight: 8, background: "#10b981", color: "#fff", border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}>
                      Evaluate Round
                    </button>
                    <button onClick={handleNextRound} disabled={loading} style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}>
                      Next Round
                    </button>
                  </>
                )}
              </div>

              {showAnswers && (
                <div style={{ marginTop: 10, background: "#fff", borderRadius: 6, padding: 8, fontSize: 14, color: "#374151" }}>
                  {local.players.map(p => (
                    <div key={p.id} style={{ padding: "6px 2px", borderBottom: "1px solid #f1f5f9" }}>
                      <b>{p.name}</b>: {p.answer ?? "—"}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column - scores */}
          <div>
            <h4 style={{ marginTop: 0 }}>Players</h4>
            <div>
              {local.players.map(p => (
                <div key={p.id} style={{ marginBottom: 8 }}>{renderScore(p)}</div>
              ))}
            </div>

            {local.computerActive && (
              <div style={{ marginTop: 10, padding: 8, background: "#f3f4f6", borderRadius: 8 }}>
                <div style={{ color: "#374151", fontSize: 13 }}>Computer answer (active)</div>
                <div style={{ marginTop: 6, fontWeight: 800 }}>{local.computerAnswer ?? "—"}</div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: "#6b7280", fontSize: 13 }}>First to reach -6 loses the game.</div>
          <div>
            {local.phase === "ended" && (
              <div style={{ color: "#ef4444", fontWeight: 700 }}>
                {local.players.find(p => p.score <= -6)?.name ?? "Someone"} lost the game 💥
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
