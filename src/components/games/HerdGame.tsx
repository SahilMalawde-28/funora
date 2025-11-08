// src/components/games/HerdGame.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Room, Player, supabase } from "../../lib/supabase";
import {
  HerdGameState,
  HerdPlayer,
  initHerdGame,
  herdSubmitAnswer,
  herdEvaluateRound,
} from "../../lib/gameLogic";

interface Props {
  room: Room;
  players: Player[];
  currentPlayer: Player;
  gameState: HerdGameState | null;
  onUpdateState: (newState: Partial<HerdGameState> | HerdGameState) => Promise<void> | void;
}

/**
 * HerdGame with Supabase persistence & realtime updates.
 * - Persists state to rooms.game_state (row with id = room.id)
 * - Subscribes to room updates and reflects changes locally
 * - Still calls onUpdateState so parent code remains compatible
 */
export default function HerdGame({
  room,
  players,
  currentPlayer,
  gameState,
  onUpdateState,
}: Props) {
  const [localState, setLocalState] = useState<HerdGameState | null>(gameState);
  const [localInput, setLocalInput] = useState("");
  const [showAnswers, setShowAnswers] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(typeof window !== "undefined" ? window.innerWidth < 640 : false);

  // responsive
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // keep localState in sync when parent provides gameState
  useEffect(() => {
    setLocalState(gameState);
  }, [gameState]);

  const myId = currentPlayer?.player_id ?? currentPlayer?.id;
  const hostId = room?.host_id ?? room?.hostId ?? null;
  const isHost = myId && hostId && myId === hostId;

  // --- Supabase helpers -------------------------------------------------
  // Persist the HerdGameState into rooms.game_state for the current room.
  // Also call onUpdateState so parent behavior remains the same.
  async function persistAndBroadcast(nextState: HerdGameState) {
    setLocalState(nextState);
    try {
      // update rooms row's game_state column
      if (!room?.id && !room?.room_id) {
        // no room id — still call onUpdateState so parent can handle it
        await Promise.resolve(onUpdateState(nextState));
        return;
      }
      const roomId = room.id ?? room.room_id;
      // Try rooms update
      await supabase.from("rooms").update({ game_state: nextState }).eq("id", roomId);
    } catch (err) {
      // ignore DB error but log — parent onUpdateState still executed
      console.warn("HerdGame: supabase persist failed", err);
    } finally {
      // notify parent so it can also persist (if your app keeps state in rooms table there may be duplication but parent's flow will remain compatible)
      await Promise.resolve(onUpdateState(nextState));
    }
  }

  // subscribe to realtime updates for this room (rooms table updates)
  useEffect(() => {
    if (!room?.id && !room?.room_id) return;
    const roomId = room.id ?? room.room_id;

    // subscribe using Realtime postgres_changes style if available
    // many Supabase versions support supabase.from(...).on('UPDATE', handler).subscribe()
    // we attempt the common pattern and clean up on unmount.
    let sub: any = null;
    try {
      sub = supabase
        .from(`rooms:id=eq.${roomId}`)
        .on("UPDATE", (payload: any) => {
          try {
            const newState = payload.new?.game_state ?? null;
            if (newState) {
              setLocalState(newState);
              // also inform parent
              onUpdateState(newState);
            }
          } catch (e) {
            console.warn("HerdGame: realtime update handler error", e);
          }
        })
        .subscribe();
    } catch (e) {
      // fallback for newer supabase-js channel API
      try {
        sub = supabase.channel(`room-${roomId}`)
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
            (payload: any) => {
              const newState = payload?.new?.game_state ?? null;
              if (newState) {
                setLocalState(newState);
                onUpdateState(newState);
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.warn("HerdGame: unable to subscribe to realtime updates", err);
      }
    }

    return () => {
      try {
        if (!sub) return;
        // unsubscribe cleanly
        if (sub.unsubscribe) sub.unsubscribe();
        else if (typeof supabase.removeSubscription === "function") supabase.removeSubscription(sub);
      } catch (err) {
        // ignore
      }
    };
  }, [room?.id, room?.room_id]);

  // convenience getters
  const gs = localState;
  const activePlayers = gs ? gs.players.filter((p) => p.score > -6) : [];
  const submittedCount = gs ? gs.players.filter((p) => p.score > -6 && p.answer && p.answer.trim() !== "").length : 0;
  const totalActive = activePlayers.length;
  const canEvaluate = gs ? totalActive > 0 && submittedCount === totalActive : false;
  const myHasAnswered = Boolean(gs && gs.players.find((p) => p.id === myId && p.answer && p.answer.trim() !== ""));

  // --- Actions ---------------------------------------------------------
  const handleStart = async () => {
    if (!isHost) return;
    const inputPlayers = players.map((p) => ({ id: (p as any).player_id ?? (p as any).id, name: (p as any).name ?? (p as any).display_name ?? "Anon" }));
    const init = initHerdGame(inputPlayers, room?.id ?? room?.room_id);
    await persistAndBroadcast(init);
  };

  const handleSubmit = async () => {
    if (!gs || !myId) return;
    if (!localInput.trim()) return;
    const next = herdSubmitAnswer(gs, myId, localInput.trim());
    setLocalInput("");
    await persistAndBroadcast(next);
  };

  const handleReveal = async () => {
    if (!isHost || !gs) return;
    // set phase to reveal locally and persist
    const next: HerdGameState = { ...gs, phase: "reveal" };
    await persistAndBroadcast(next);
    setShowAnswers(true);
  };

  const handleEvaluate = async () => {
    if (!isHost || !gs) return;
    if (!canEvaluate) return; // block until everyone submits
    const evaluated = herdEvaluateRound(gs);
    await persistAndBroadcast(evaluated);
    setShowAnswers(true);
  };

  const handleNextRound = async () => {
    if (!isHost || !gs) return;
    // after evaluate, press Next to continue. herdEvaluateRound already advanced round when called.
    // If your logic expects a separate "next" (clearing lastResult), just set phase to answering and clear lastResult.
    const next: HerdGameState = { ...gs, phase: "answering", lastResult: null };
    await persistAndBroadcast(next);
    setShowAnswers(false);
  };

  const toggleViewAnswers = () => setShowAnswers((s) => !s);

  // --- Render ----------------------------------------------------------
  // initial (no game state) view
  if (!gs) {
    return (
      <div style={{ background: "#f9fafb", color: "#111827", padding: 18, minHeight: "100vh" }}>
        <div style={{ maxWidth: 920, margin: "0 auto", background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 3px 14px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>🐮 Herd Mentality</h2>
              <div style={{ color: "#6b7280", marginTop: 4 }}>Majority survives. Minority loses 1 point. First to reach -6 loses.</div>
            </div>
            <div>
              {isHost ? (
                <button onClick={handleStart} style={{ background: "#0ea5e9", color: "#fff", padding: "8px 14px", borderRadius: 8, fontWeight: 700, border: "none", cursor: "pointer" }}>
                  Start Game
                </button>
              ) : (
                <div style={{ color: "#9ca3af" }}>Waiting for host to start...</div>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {players.map((p) => (
                <div key={(p as any).player_id ?? (p as any).id} style={{ background: "#f3f4f6", padding: "8px 12px", borderRadius: 8 }}>
                  <div style={{ fontWeight: 600 }}>{(p as any).name ?? (p as any).player_id ?? (p as any).id}</div>
                </div>
              ))}
            </div>
            <div style={{ color: "#6b7280", fontSize: 13 }}>Host starts the game — answers will open and a category will be chosen.</div>
          </div>
        </div>
      </div>
    );
  }

  // active UI
  const category = gs.category;
  const round = gs.round;
  const phase = gs.phase;
  const lastResult = gs.lastResult;

  return (
    <div style={{ background: "#f9fafb", minHeight: "100vh", padding: 14 }}>
      <div style={{ maxWidth: 980, margin: "0 auto", background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 3px 14px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>🐮 Herd Mentality</h2>
            <div style={{ color: "#6b7280", fontSize: 13 }}>Round {round} • Category: <strong>{category}</strong></div>
          </div>
          <div style={{ textAlign: "right", marginTop: isMobile ? 8 : 0 }}>
            <div style={{ color: "#6b7280", fontSize: 13 }}>{phase === "answering" ? "Answering" : phase === "reveal" ? "Reveal" : "Finished"}</div>
            <div style={{ marginTop: 6, fontSize: 13, color: "#374151" }}>Submitted: <strong>{submittedCount}/{totalActive}</strong></div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, flexDirection: isMobile ? "column" : "row" }}>
          <div style={isMobile ? { width: "100%" } : { width: "66%" }}>
            {/* input */}
            {phase !== "ended" && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ marginBottom: 8, color: "#374151" }}>Type an answer you think others will give (single word/short phrase).</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    value={localInput}
                    onChange={(e) => setLocalInput(e.target.value)}
                    placeholder="Your answer..."
                    disabled={Boolean(gs.players.find(p => p.id === myId && p.answer && p.answer.trim() !== "") || phase !== "answering" || (gs.players.find(p => p.id === myId)?.score ?? 0) <= -6)}
                    style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 15, minWidth: 140 }}
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={Boolean(gs.players.find(p => p.id === myId && p.answer && p.answer.trim() !== "")) || !localInput.trim() || phase !== "answering" || (gs.players.find(p => p.id === myId)?.score ?? 0) <= -6}
                    style={{ background: "#3b82f6", color: "#fff", border: "none", padding: "10px 14px", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
                  >
                    Submit
                  </button>

                  {phase === "answering" && isHost && (
                    <button onClick={handleReveal} style={{ background: "#7c3aed", color: "#fff", border: "none", padding: "10px 14px", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
                      Reveal Answers
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* results / reveal box */}
            <div style={{ background: "#f3f4f6", padding: 12, borderRadius: 10, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Round Summary</div>

              {!gs.lastResult && phase === "answering" && <div style={{ color: "#6b7280" }}>Waiting for answers... Host can reveal when ready.</div>}

              {phase === "reveal" && (
                <>
                  <div style={{ marginBottom: 8, color: "#374151" }}>Answers (revealed):</div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {gs.players.filter(p => p.score > -6).map(p => (
                      <div key={p.id} style={{ display: "flex", justifyContent: "space-between", background: "#fff", padding: 8, borderRadius: 8, border: "1px solid #e6e6e6" }}>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        <div style={{ color: "#6b7280" }}>{p.answer ?? "—"}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                    {isHost && (
                      <button
                        onClick={handleEvaluate}
                        disabled={!canEvaluate}
                        style={{
                          background: canEvaluate ? "#10b981" : "#9ca3af",
                          color: "#fff",
                          border: "none",
                          padding: "8px 12px",
                          borderRadius: 8,
                          fontWeight: 700,
                          cursor: canEvaluate ? "pointer" : "not-allowed",
                        }}
                      >
                        Evaluate Round
                      </button>
                    )}

                    <button onClick={toggleViewAnswers} style={{ background: "#e5e7eb", color: "#111827", border: "none", padding: "8px 12px", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
                      {showAnswers ? "Hide Answers" : "View All Answers"}
                    </button>
                  </div>
                </>
              )}

              {gs.lastResult && (
                <>
                  <div style={{ marginBottom: 8 }}><div style={{ color: "#374151" }}>Majority: {gs.lastResult.majorityAnswers && gs.lastResult.majorityAnswers.length > 0 ? gs.lastResult.majorityAnswers.join(", ") : "None"}</div></div>

                  <div style={{ background: "#fff", padding: 8, borderRadius: 8, border: "1px solid #e6e6e6", marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Penalties</div>
                    {gs.lastResult.penalties && Object.keys(gs.lastResult.penalties).length > 0 ? (
                      <div style={{ display: "grid", gap: 6 }}>
                        {Object.entries(gs.lastResult.penalties).map(([id, delta]) => {
                          const player = gs.players.find(p => p.id === id);
                          if (!player) return null;
                          return (
                            <div key={id} style={{ display: "flex", justifyContent: "space-between" }}>
                              <div>{player.name}</div>
                              <div style={{ color: "#ef4444", fontWeight: 700 }}>{delta}</div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ color: "#6b7280" }}>No penalties this round.</div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    {isHost && gs.phase !== "ended" && (
                      <button onClick={handleNextRound} style={{ background: "#f59e0b", color: "#fff", border: "none", padding: "8px 12px", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
                        Next Round
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* right - players & scores */}
          <div style={isMobile ? { width: "100%" } : { width: "34%" }}>
            <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700 }}>Players</div>
              <div style={{ color: "#6b7280", fontSize: 13 }}>{activePlayers.length} active</div>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {gs.players.map((p) => {
                const eliminated = p.score <= -6;
                const submitted = Boolean(p.answer && p.answer.trim() !== "");
                return (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#f3f4f6", borderRadius: 8 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: eliminated ? "#ef4444" : (submitted ? "#10b981" : "#6b7280") }}>
                        {eliminated ? "Eliminated" : (submitted ? "Submitted" : "—")}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, color: p.score <= -4 ? "#ef4444" : "#111827" }}>{p.score}</div>
                  </div>
                );
              })}
            </div>

            {gs.computerActive && (
              <div style={{ marginTop: 12, padding: 10, background: "#fff", borderRadius: 8, border: "1px solid #e6e6e6" }}>
                <div style={{ fontSize: 13, color: "#6b7280" }}>Computer (2-player mode)</div>
                <div style={{ marginTop: 6, fontWeight: 700 }}>{gs.computerAnswer ?? "—"}</div>
              </div>
            )}
          </div>
        </div>

        {showAnswers && (
          <div style={{ marginTop: 12, background: "#fff", padding: 10, borderRadius: 8, border: "1px solid #e6e6e6" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>All Answers</div>
            <div style={{ display: "grid", gap: 6 }}>
              {gs.players.map(p => (
                <div key={`ans-${p.id}`} style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>{p.name}</div>
                  <div style={{ color: "#6b7280" }}>{p.answer ?? "—"}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {gs.phase === "ended" && (
          <div style={{ marginTop: 14, padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #f3f4f6", textAlign: "center" }}>
            <div style={{ fontWeight: 800, color: "#ef4444" }}>{gs.players.find(p => p.score <= -6)?.name ?? "Game Over"} lost the game.</div>
          </div>
        )}
      </div>
    </div>
  );
}
