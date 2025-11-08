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
  const timerRef = useRef<number | null>(null);

  // Sync local with parent
  useEffect(() => setLocal(gameState), [gameState]);

  const myId = currentPlayer.player_id ?? currentPlayer.id;
  const isHost =
    (currentPlayer.player_id ?? currentPlayer.id) ===
    (room?.host_id ?? room?.hostId);

  async function safePersistState(s: HerdGameState) {
    try {
      if (typeof supabase !== "undefined" && supabase?.from) {
        await supabase.from("game_states").upsert(
          {
            room_id: s.roomId ?? (room?.id ?? room?.room_id),
            game: "herd",
            state: s,
          },
          { onConflict: ["room_id", "game"] }
        );
      }
    } catch (err) {
      console.warn("Persist error", err);
    }
  }

  // Start new game
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
    const s = herdEvaluateRound(local!);
    setShowAnswers(false);
    setLocal(s);
    await safePersistState(s);
    await onUpdateState(s);
  };

  if (!local) {
    return (
      <div
        style={{
          background: "#f9fafb",
          color: "#111827",
          padding: 20,
          minHeight: "100vh",
        }}
      >
        <div
          style={{
            maxWidth: 600,
            margin: "0 auto",
            background: "#fff",
            borderRadius: 12,
            padding: 24,
            boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
            textAlign: "center",
          }}
        >
          <h2 style={{ fontSize: 26, marginBottom: 6 }}>🐮 Herd Mentality</h2>
          <p style={{ color: "#6b7280", marginBottom: 20 }}>
            Majority survives. Minority loses 1 point. First to reach -6 loses.
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 10,
              marginBottom: 20,
            }}
          >
            {players.map((p) => (
              <div
                key={p.player_id ?? p.id}
                style={{
                  background: "#f3f4f6",
                  padding: "8px 14px",
                  borderRadius: 8,
                  fontWeight: 500,
                }}
              >
                {p.name ?? p.player_id ?? p.id}
              </div>
            ))}
          </div>

          {isHost ? (
            <button
              onClick={startGame}
              style={{
                background: "#3b82f6",
                color: "#fff",
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
              }}
            >
              Start Game
            </button>
          ) : (
            <p style={{ color: "#9ca3af" }}>
              Waiting for host to start the game...
            </p>
          )}
        </div>
      </div>
    );
  }

  const curCategory = local.category;
  const phase = local.phase;
  const round = local.round;

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
        {p.name}{" "}
        {p.score <= -6 && (
          <span style={{ color: "#ef4444", fontSize: 12 }}> (Eliminated)</span>
        )}
      </span>
      <span
        style={{
          color: p.score <= -4 ? "#ef4444" : "#16a34a",
          fontWeight: 600,
        }}
      >
        {p.score}
      </span>
    </div>
  );

  return (
    <div
      style={{
        background: "#f9fafb",
        color: "#111827",
        padding: 16,
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          background: "#fff",
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>🐮 Herd Mentality</h2>
            <div style={{ color: "#6b7280" }}>
              Round {round} • Category: <b>{curCategory}</b>
            </div>
          </div>
          <div style={{ color: "#6b7280", fontSize: 14, marginTop: 4 }}>
            {phase === "answering"
              ? "Answer now!"
              : phase === "reveal"
              ? "Revealing..."
              : "Finished"}
          </div>
        </div>

        {/* Input area */}
        {phase !== "ended" && (
          <div
            style={{
              marginBottom: 18,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Your answer..."
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 16,
              }}
              disabled={!!local.players.find((p) => p.id === myId && p.answer)}
            />
            <button
              onClick={handleSubmit}
              style={{
                background: "#3b82f6",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
              disabled={
                !!local.players.find((p) => p.id === myId && p.answer) ||
                input.trim() === ""
              }
            >
              Submit Answer
            </button>
          </div>
        )}

        {/* Result area */}
        <div
          style={{
            background: "#f3f4f6",
            padding: 14,
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <h4 style={{ margin: "4px 0 8px" }}>Round Results</h4>
          {local.lastResult ? (
            <>
              <p style={{ color: "#4b5563" }}>
                Majority answers:{" "}
                <b>
                  {local.lastResult.majorityAnswers?.join(", ") || "None"}
                </b>
              </p>
              {Object.keys(local.lastResult.penalties || {}).length > 0 ? (
                <ul style={{ color: "#dc2626", marginTop: 4 }}>
                  {Object.entries(local.lastResult.penalties!).map(
                    ([id, delta]) => {
                      const p = local.players.find((pl) => pl.id === id);
                      return (
                        <li key={id}>
                          {p?.name ?? id} {delta > 0 ? "+" : ""}
                          {delta}
                        </li>
                      );
                    }
                  )}
                </ul>
              ) : (
                <p style={{ color: "#6b7280" }}>No penalties this round.</p>
              )}
            </>
          ) : (
            <p style={{ color: "#6b7280" }}>No results yet.</p>
          )}

          {/* View Answers toggle */}
          <button
            onClick={() => setShowAnswers(!showAnswers)}
            style={{
              marginTop: 8,
              background: "#e5e7eb",
              color: "#111827",
              border: "none",
              borderRadius: 6,
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            {showAnswers ? "Hide Answers" : "View All Answers"}
          </button>

          {showAnswers && (
            <div
              style={{
                marginTop: 10,
                background: "#fff",
                borderRadius: 6,
                padding: 8,
                fontSize: 14,
                color: "#374151",
              }}
            >
              {Object.entries(local.responses || {}).map(([id, ans]) => {
                const p = local.players.find((pl) => pl.id === id);
                return (
                  <div key={id}>
                    <b>{p?.name ?? id}</b>: {ans || "—"}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Scores */}
        <div style={{ marginBottom: 16 }}>
          <h4>Scores</h4>
          {local.players.map(renderScore)}
        </div>

        {/* Host controls */}
        {isHost && (
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <button
              onClick={handleEvaluate}
              style={{
                background: "#10b981",
                color: "#fff",
                border: "none",
                padding: "10px 14px",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Evaluate Round
            </button>

            <button
              onClick={handleNextRound}
              style={{
                background: "#f59e0b",
                color: "#fff",
                border: "none",
                padding: "10px 14px",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Next Round
            </button>
          </div>
        )}

        {local.phase === "ended" && (
          <div
            style={{
              marginTop: 16,
              textAlign: "center",
              color: "#ef4444",
              fontWeight: 600,
            }}
          >
            {local.players.find((p) => p.score <= -6)?.name} lost the game 💥
          </div>
        )}
      </div>
    </div>
  );
}
