// src/components/games/HerdGame.tsx
import React, { useEffect, useState } from "react";
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
  players: Player[];
  currentPlayer: Player;
  gameState: HerdGameState | null;
  onUpdateState: (s: HerdGameState) => Promise<void> | void;
  onEndGame?: () => void;
}

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

  useEffect(() => setLocal(gameState), [gameState]);

  const myId = currentPlayer.player_id ?? currentPlayer.id;
  const isHost =
    (currentPlayer.player_id ?? currentPlayer.id) ===
    (room?.host_id ?? room?.hostId);

  async function safePersistState(s: HerdGameState) {
    try {
      await supabase.from("game_states").upsert(
        {
          room_id: s.roomId ?? (room?.id ?? room?.room_id),
          game: "herd",
          state: s,
        },
        { onConflict: ["room_id", "game"] }
      );
    } catch (err) {
      console.warn("Persist error", err);
    }
  }

  const startGame = async () => {
    const inputPlayers = players.map((p) => ({
      id: p.player_id ?? p.id,
      name: p.name ?? p.display_name ?? "Anon",
    }));
    const s = initHerdGame(inputPlayers, room?.id ?? room?.room_id);
    setLocal(s);
    await safePersistState(s);
    await onUpdateState(s);
  };

  const handleSubmit = async () => {
    if (!local || !input.trim()) return;
    const s1 = herdSubmitAnswer(local, myId, input.trim());
    setLocal(s1);
    setInput("");
    await safePersistState(s1);
    await onUpdateState(s1);
  };

  const handleEvaluate = async () => {
    if (!local) return;
    const evaluated = herdEvaluateRound(local);
    setLocal(evaluated);
    await safePersistState(evaluated);
    await onUpdateState(evaluated);
  };

  const handleNextRound = async () => {
    if (!local) return;
    const next = { ...local, phase: "answering", round: local.round + 1 };
    next.responses = {};
    next.lastResult = null;
    setShowAnswers(false);
    setLocal(next);
    await safePersistState(next);
    await onUpdateState(next);
  };

  if (!local) {
    return (
      <div
        style={{
          background: "#f9fafb",
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            background: "#fff",
            padding: 24,
            borderRadius: 12,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            textAlign: "center",
          }}
        >
          <h2>🐮 Herd Mentality</h2>
          <p>Majority survives. Minority loses 1 point. First to reach -6 loses.</p>
          {isHost ? (
            <button
              onClick={startGame}
              style={{
                background: "#3b82f6",
                color: "#fff",
                padding: "10px 18px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
              }}
            >
              Start Game
            </button>
          ) : (
            <p>Waiting for host to start…</p>
          )}
        </div>
      </div>
    );
  }

  const phase = local.phase;
  const curCategory = local.category;
  const round = local.round;

  const totalPlayers = local.players.length;
  const answeredCount = Object.keys(local.responses ?? {}).length;
  const allAnswered = answeredCount === totalPlayers;

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
      <span>
        {p.name}{" "}
        {p.score <= -6 && (
          <span style={{ color: "#ef4444", fontSize: 12 }}> (Lost)</span>
        )}
      </span>
      <b>{p.score}</b>
    </div>
  );

  const myAnswer = local.responses?.[myId];

  return (
    <div style={{ background: "#f9fafb", minHeight: "100vh", padding: 16 }}>
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          background: "#fff",
          padding: 20,
          borderRadius: 12,
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>🐮 Herd Mentality</h2>
            <small>
              Round {round} • Category: <b>{curCategory}</b>
            </small>
          </div>
          <div style={{ color: "#6b7280" }}>
            {answeredCount}/{totalPlayers} answered
          </div>
        </div>

        {phase === "answering" && (
          <>
            <div style={{ marginBottom: 16 }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Your answer..."
                disabled={!!myAnswer}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  width: "100%",
                }}
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || !!myAnswer}
                style={{
                  background: "#3b82f6",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 14px",
                  marginTop: 8,
                  cursor: "pointer",
                }}
              >
                Submit
              </button>
              {myAnswer && (
                <p style={{ color: "#16a34a", marginTop: 6 }}>
                  ✅ You answered: <b>{myAnswer}</b>
                </p>
              )}
            </div>
          </>
        )}

        {phase !== "answering" && local.lastResult && (
          <div
            style={{
              background: "#f3f4f6",
              padding: 14,
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            <h4>Round Results</h4>
            <p>
              Majority:{" "}
              <b>{local.lastResult.majorityAnswers?.join(", ") || "None"}</b>
            </p>
            {Object.keys(local.lastResult.penalties || {}).length > 0 ? (
              <ul>
                {Object.entries(local.lastResult.penalties!).map(([id, delta]) => {
                  const p = local.players.find((pl) => pl.id === id);
                  return (
                    <li key={id}>
                      {p?.name}: {delta > 0 ? "+" : ""}
                      {delta}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>No penalties this round.</p>
            )}
          </div>
        )}

        <h4>Scores</h4>
        {local.players.map(renderScore)}

        {/* Host Controls */}
        {isHost && (
          <div
            style={{
              marginTop: 20,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <button
              onClick={handleEvaluate}
              disabled={!allAnswered || phase !== "answering"}
              style={{
                background: allAnswered ? "#10b981" : "#9ca3af",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 14px",
                cursor: allAnswered ? "pointer" : "not-allowed",
              }}
            >
              Evaluate
            </button>
            <button
              onClick={handleNextRound}
              disabled={phase !== "reveal"}
              style={{
                background: phase === "reveal" ? "#f59e0b" : "#9ca3af",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 14px",
                cursor: phase === "reveal" ? "pointer" : "not-allowed",
              }}
            >
              Next Round
            </button>
          </div>
        )}

        {local.phase === "ended" && (
          <div
            style={{
              textAlign: "center",
              marginTop: 16,
              fontWeight: 600,
              color: "#ef4444",
            }}
          >
            {local.players.find((p) => p.score <= -6)?.name} lost the game 💥
          </div>
        )}
      </div>
    </div>
  );
}
