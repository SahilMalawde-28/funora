// src/components/games/HerdGame.tsx
import React, { useEffect, useState, useRef } from "react";
import { Room, Player, supabase } from "../../lib/supabase"; // <-- adjust if your export differs
import {
  HerdGameState,
  HerdPlayer,
  initHerdGame,
  herdSubmitAnswer,
  herdEvaluateRound,
} from "../../lib/gameLogic"; // ensure the gameLogic exports the names above

interface HerdGameProps {
  room: Room;
  players: Player[];    // each player should have player_id or id and name
  currentPlayer: Player;
  gameState: HerdGameState | null;
  onUpdateState: (s: HerdGameState) => Promise<void> | void;
  onEndGame?: () => void;
}

export default function HerdGame({ room, players, currentPlayer, gameState, onUpdateState, onEndGame }: HerdGameProps) {
  const [local, setLocal] = useState<HerdGameState | null>(gameState);
  const [input, setInput] = useState("");
  const [timer, setTimer] = useState(20);
  const timerRef = useRef<number | null>(null);

  // keep local in sync with parent/state
  useEffect(() => {
    setLocal(gameState);
  }, [gameState]);

  // start a new herd game (host only)
  const startGame = async () => {
    const inputPlayers = players.map(p => ({ id: p.player_id ?? p.id, name: p.name ?? p.display_name ?? p.player_name ?? "Anon" }));
    const s = initHerdGame(inputPlayers, room?.id ?? room?.room_id);
    setLocal(s);
    await safePersistState(s);
    if (onUpdateState) await onUpdateState(s);
  };

  // save state helper (tries supabase upsert if available)
  async function safePersistState(s: HerdGameState) {
    // try to persist to supabase if exported
    try {
      if (typeof supabase !== "undefined" && supabase?.from) {
        // expected table: game_states with columns: room_id (text), game (text), state (jsonb)
        await supabase.from("game_states").upsert({
          room_id: s.roomId ?? (room?.id ?? room?.room_id),
          game: "herd",
          state: s,
        }, { onConflict: ["room_id", "game"] });
      }
    } catch (err) {
      // ignore - parent onUpdateState still allows app to function
      console.warn("HerdGame: supabase persist failed", err);
    }
  }

  // timer lifecycle for answer phase
  useEffect(() => {
    if (!local) return;
    if (local.phase === "ended") {
      if (onEndGame) onEndGame();
      return;
    }

    // only run timer when answering
    if (local.phase === "answering") {
      setTimer(20);
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            if (timerRef.current) {
              window.clearInterval(timerRef.current);
              timerRef.current = null;
            }
            // auto submit blank for players who haven't submitted
            void handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [local?.phase, local?.round]);

  // auto submit blank for players who didn't submit
  const handleAutoSubmit = async () => {
    if (!local) return;
    const meId = currentPlayer.player_id ?? currentPlayer.id;
    // if I haven't submitted yet, submit blank
    const myState = local.players.find(p => p.id === meId);
    if (myState && myState.answer === undefined) {
      const s1 = herdSubmitAnswer(local, meId, "");
      setLocal(s1); await safePersistState(s1); if (onUpdateState) await onUpdateState(s1);
    }
    // move to reveal after slight delay
    setTimeout(async () => {
      if (!local) return;
      const revealed = await evaluateAndPersist(local);
      setLocal(revealed);
      if (onUpdateState) await onUpdateState(revealed);
    }, 400);
  };

  // handle local submit by user
  const handleSubmit = async () => {
    if (!local) return;
    const meId = currentPlayer.player_id ?? currentPlayer.id;
    const s1 = herdSubmitAnswer(local, meId, input);
    setLocal(s1); await safePersistState(s1); if (onUpdateState) await onUpdateState(s1);
    setInput("");
    // small delay then evaluate (reveal)
    setTimeout(async () => {
      const revealed = await evaluateAndPersist(s1);
      setLocal(revealed);
      if (onUpdateState) await onUpdateState(revealed);
    }, 400);
  };

  // Owner/host can force evaluate (useful if not everyone submits)
  const forceEvaluate = async () => {
    if (!local) return;
    const revealed = await evaluateAndPersist(local);
    setLocal(revealed);
    if (onUpdateState) await onUpdateState(revealed);
  };

  // evaluate (calls game logic) and persist
  async function evaluateAndPersist(stateBefore: HerdGameState): Promise<HerdGameState> {
    const evaluated = herdEvaluateRound(stateBefore);
    await safePersistState(evaluated);
    // if ended, call onEndGame after short delay
    if (evaluated.phase === "ended") {
      setTimeout(() => onEndGame?.(), 400);
    }
    return evaluated;
  }

  // quick helpers
  const isHost = !!(currentPlayer && ((currentPlayer.player_id ?? currentPlayer.id) === (room?.host_id ?? room?.hostId)));
  const myId = currentPlayer.player_id ?? currentPlayer.id;

  // If not started show start UI
  if (!local) {
    return (
      <div style={{ padding: 18 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", color: "#e6eef8", background: "#0b1220", padding: 16, borderRadius: 10 }}>
          <h2 style={{ margin: 0 }}>🐑 Herd Mentality</h2>
          <p style={{ color: "#9ca3af" }}>Majority survives. Minority loses 1 point. First to reach -6 loses.</p>

          <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
            {players.map(p => (
              <div key={p.player_id ?? p.id} style={{ background: "#0f172a", padding: 8, borderRadius: 8, minWidth: 140 }}>
                <div style={{ fontWeight: 700 }}>{p.name ?? p.player_id ?? p.id}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            {isHost ? (
              <button onClick={startGame} style={{ padding: "8px 12px", background: "#10b981", color: "#fff", borderRadius: 10, fontWeight: 700 }}>
                Start Herd Mentality
              </button>
            ) : (
              <div style={{ color: "#9ca3af" }}>Waiting for host to start the game...</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Active gameplay UI
  const curCategory = local.category;
  const roundNum = local.round;
  const phase = local.phase;
  const computerActive = local.computerActive;

  // helper render players scoreboard
  const renderScore = (p: HerdPlayer) => {
    const danger = p.score <= -4;
    return (
      <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: 10, background: "#081226", borderRadius: 8, marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 700 }}>{p.name}</div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>{p.score <= -6 ? "Eliminated" : `Score: ${p.score}`}</div>
        </div>
        <div style={{ alignSelf: "center", color: danger ? "#ff7b7b" : "#a3f7c6", fontWeight: 800 }}>
          {p.score}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: 18 }}>
      <div style={{ maxWidth: 980, margin: "0 auto", background: "#071028", padding: 14, borderRadius: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div>
            <h2 style={{ margin: 0 }}>🐑 Herd Mentality</h2>
            <div style={{ fontSize: 13, color: "#9ca3af" }}>Round {roundNum} • Category: <strong>{curCategory}</strong></div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>{phase === "answering" ? `Answer now (${timer}s)` : (phase === "reveal" ? "Revealing..." : "Finished")}</div>
            <div style={{ marginTop: 6 }}>{isHost && <button onClick={forceEvaluate} style={{ padding: "6px 10px", background: "#7c3aed", color: "#fff", borderRadius: 8 }}>Host: Force Evaluate</button>}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12 }}>
          {/* left: answer input & results */}
          <div>
            <div style={{ marginBottom: 10 }}>
              {phase !== "ended" && (
                <>
                  <div style={{ marginBottom: 8, color: "#e6eef8" }}>
                    Type your answer (single word/phrase). In majority mode you want to pick what you *think others will pick*.
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Your answer..." style={{ flex: 1, padding: 10, borderRadius: 8, background: "#061023", color: "#fff", border: "1px solid #122233" }} />
                    <button onClick={handleSubmit} style={{ padding: "10px 12px", background: "#0ea5e9", color: "#fff", borderRadius: 8 }}>Submit</button>
                  </div>
                </>
              )}
            </div>

            {/* reveal area */}
            <div style={{ marginTop: 12 }}>
              <h4 style={{ margin: "8px 0" }}>Round Result</h4>
              {local.lastResult ? (
                <>
                  <div style={{ color: "#9ca3af", marginBottom: 8 }}>Majority answers: {local.lastResult.majorityAnswers?.join(", ") || "—"}</div>
                  <div style={{ background: "#071731", padding: 8, borderRadius: 8 }}>
                    <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 6 }}>Penalties this round:</div>
                    {Object.keys(local.lastResult.penalties || {}).length === 0 ? (
                      <div style={{ color: "#9ca3af" }}>No penalties.</div>
                    ) : (
                      Object.entries(local.lastResult.penalties || {}).map(([id, delta]) => {
                        const p = local.players.find(pp => pp.id === id);
                        return <div key={id} style={{ color: "#fff" }}>{p?.name ?? id}: {delta}</div>;
                      })
                    )}
                  </div>
                </>
              ) : (
                <div style={{ color: "#9ca3af" }}>No result yet.</div>
              )}
            </div>
          </div>

          {/* right: scoreboard */}
          <div>
            <h4 style={{ marginTop: 0 }}>Players</h4>
            <div>
              {local.players.map(renderScore)}
            </div>

            {computerActive && (
              <div style={{ marginTop: 10, padding: 8, background: "#071731", borderRadius: 8 }}>
                <div style={{ color: "#9ca3af", fontSize: 13 }}>Computer answer (active):</div>
                <div style={{ marginTop: 6, fontWeight: 800 }}>{local.computerAnswer ?? "—"}</div>
              </div>
            )}
          </div>
        </div>

        {/* footer controls */}
        <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: "#9ca3af", fontSize: 13 }}>First to reach -6 loses. When 2 players remain the computer tries to outsmart you.</div>
          <div>
            <button onClick={async () => { const s = await evaluateAndPersist(local); setLocal(s); if (onUpdateState) await onUpdateState(s); }} style={{ padding: "8px 10px", background: "#16a34a", color: "#fff", borderRadius: 8 }}>
              Next / Evaluate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
