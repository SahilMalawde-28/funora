import React, { useEffect, useState } from "react";
import {
  initMemoryGameState,
  handleTileTap,
  activatePaint,
  activateStake,
  activateViewPart,
  MemoryGameState,
} from "../../lib/gameLogic";

interface MemoryGameProps {
  room: any;
  players: any[];
  currentPlayer: any;
  gameState: MemoryGameState;
  onUpdateState: (newState: Partial<MemoryGameState>) => void;
}

export default function MemoryGame({
  room,
  players,
  currentPlayer,
  gameState,
  onUpdateState,
}: MemoryGameProps) {
  const [localState, setLocalState] = useState<MemoryGameState | null>(gameState);
  const [previewTime, setPreviewTime] = useState(5);

  // Initialize new game if not started
  useEffect(() => {
    if (!gameState?.started && players.length > 0) {
      const newState = initMemoryGameState(players);
      onUpdateState(newState);
    } else {
      setLocalState(gameState);
    }
  }, [gameState, players]);

  // Preview countdown (first 5 seconds)
  useEffect(() => {
    if (localState?.phase === "preview" && previewTime > 0) {
      const timer = setTimeout(() => setPreviewTime(previewTime - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (previewTime === 0 && localState?.phase === "preview") {
      onUpdateState({ phase: "playing" });
    }
  }, [previewTime, localState]);

  if (!localState) return null;

  const { grid, currentPlayerId, players: gamePlayers, phase } = localState;
  const me = gamePlayers.find((p) => p.id === currentPlayer.id);
  const isMyTurn = currentPlayer.id === currentPlayerId;

  const handleClick = (tileId: string) => {
    if (!isMyTurn || phase !== "playing") return;
    const newState = handleTileTap(localState, currentPlayer.id, tileId);
    onUpdateState(newState);
  };

  const handleAbility = (type: "paint" | "stake" | "viewPart") => {
    let newState = localState;
    if (type === "paint") newState = activatePaint(localState, currentPlayer.id);
    if (type === "stake") newState = activateStake(localState, currentPlayer.id);
    if (type === "viewPart") newState = activateViewPart(localState);
    onUpdateState(newState);
  };

  return (
    <div style={{ textAlign: "center", padding: 20 }}>
      <h2>🎯 Memory Grid</h2>

      {phase === "preview" && (
        <p style={{ color: "orange", fontWeight: "bold" }}>
          Memorize the grid! Game starts in {previewTime}s
        </p>
      )}

      {phase === "playing" && (
        <p>
          Current Turn:{" "}
          <span style={{ color: gamePlayers.find(p => p.id === currentPlayerId)?.color }}>
            {gamePlayers.find(p => p.id === currentPlayerId)?.name}
          </span>
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${grid.length}, 50px)`,
          gap: "6px",
          justifyContent: "center",
          marginTop: "10px",
        }}
      >
        {grid.flat().map((tile, idx) => (
          <div
            key={`${tile.id}-${idx}`}
            onClick={() => handleClick(tile.id)}
            style={{
              width: 50,
              height: 50,
              borderRadius: 6,
              backgroundColor:
                phase === "preview"
                  ? tile.color
                  : tile.revealed
                  ? tile.color || "#f0f0f0"
                  : "#1e293b",
              border: "1px solid #555",
              cursor: isMyTurn ? "pointer" : "not-allowed",
            }}
          />
        ))}
      </div>

      {isMyTurn && (
        <div style={{ marginTop: 10 }}>
          {me?.abilities.paint && (
            <button onClick={() => handleAbility("paint")} style={btnStyle}>
              🎨 Paint
            </button>
          )}
          {me?.abilities.stake && (
            <button onClick={() => handleAbility("stake")} style={btnStyle}>
              💎 Stake
            </button>
          )}
          {me?.abilities.viewPart && (
            <button onClick={() => handleAbility("viewPart")} style={btnStyle}>
              👁️ View Part
            </button>
          )}
        </div>
      )}

      <div style={{ marginTop: 15, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
        {gamePlayers.map((p) => (
          <div
            key={p.id}
            style={{
              border: p.id === currentPlayerId ? "2px solid gold" : "1px solid gray",
              padding: "5px",
              borderRadius: "6px",
              color: p.color,
              backgroundColor: "#111",
            }}
          >
            <strong>{p.name}</strong> — {p.revealedCount} found
          </div>
        ))}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  margin: "0 5px",
  padding: "6px 12px",
  background: "#444",
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
};
