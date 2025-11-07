// MemoryGame.tsx
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

const MemoryGame: React.FC<MemoryGameProps> = ({
  room,
  players,
  currentPlayer,
  gameState,
  onUpdateState,
}) => {
  const [localState, setLocalState] = useState<MemoryGameState | null>(gameState);

  useEffect(() => {
    if (!gameState?.started && players.length > 0) {
      const newState = initMemoryGameState(players.map((p) => ({ id: p.id, name: p.name })));
      onUpdateState(newState);
    } else {
      setLocalState(gameState);
    }
  }, [gameState, players]);

  if (!localState) return null;
  const { grid, currentPlayerId, players: gamePlayers } = localState;
  const me = gamePlayers.find((p) => p.id === currentPlayer.id);
  const isMyTurn = currentPlayer.id === currentPlayerId;

  const handleClick = (tileId: string) => {
    if (!isMyTurn) return;
    const newState = handleTileTap(localState, currentPlayer.id, tileId);
    onUpdateState(newState);
  };

  const handleAbility = (type: "paint" | "stake" | "viewPart") => {
    let newState = localState;
    if (type === "paint") newState = activatePaint(localState, currentPlayer.id, "");
    if (type === "stake") newState = activateStake(localState, currentPlayer.id);
    if (type === "viewPart") newState = activateViewPart(localState);
    onUpdateState(newState);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "16px",
        padding: "16px",
        fontFamily: "sans-serif",
      }}
    >
      <h2 style={{ fontSize: "22px", fontWeight: "600" }}>🎯 Memory Grid</h2>
      <p style={{ fontSize: "14px" }}>
        Current Turn:{" "}
        <span
          style={{
            fontWeight: "bold",
            color: gamePlayers.find((p) => p.id === currentPlayerId)?.color,
          }}
        >
          {gamePlayers.find((p) => p.id === currentPlayerId)?.name}
        </span>
      </p>

      <div
        style={{
          display: "grid",
          gap: "6px",
          gridTemplateColumns: `repeat(${grid.length}, 45px)`,
          justifyContent: "center",
        }}
      >
        {grid.flat().map((tile) => (
          <div
            key={tile.id}
            onClick={() => handleClick(tile.id)}
            style={{
              width: "45px",
              height: "45px",
              borderRadius: "6px",
              backgroundColor: tile.revealed
                ? tile.color || "#d1d5db"
                : "#1e293b",
              border: "1px solid #475569",
              cursor: isMyTurn ? "pointer" : "not-allowed",
              transition: "background-color 0.2s ease",
            }}
          />
        ))}
      </div>

      {isMyTurn && (
        <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
          {me?.abilities.paint && (
            <button
              onClick={() => handleAbility("paint")}
              style={buttonStyle("#f97316")}
            >
              🎨 Paint
            </button>
          )}
          {me?.abilities.stake && (
            <button
              onClick={() => handleAbility("stake")}
              style={buttonStyle("#22c55e")}
            >
              💎 Stake
            </button>
          )}
          {me?.abilities.viewPart && (
            <button
              onClick={() => handleAbility("viewPart")}
              style={buttonStyle("#3b82f6")}
            >
              👁️ View
            </button>
          )}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
          gap: "8px",
          width: "100%",
          maxWidth: "500px",
          marginTop: "20px",
        }}
      >
        {gamePlayers.map((p) => (
          <div
            key={p.id}
            style={{
              padding: "8px",
              borderRadius: "8px",
              textAlign: "center",
              backgroundColor: "#0f172a",
              color: "white",
              border:
                p.id === currentPlayerId
                  ? "2px solid gold"
                  : "1px solid #334155",
            }}
          >
            <p style={{ color: p.color, fontWeight: "bold" }}>{p.name}</p>
            <p style={{ fontSize: "12px", opacity: 0.8 }}>
              {p.revealedCount} found
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

// Inline button style helper
const buttonStyle = (color: string): React.CSSProperties => ({
  backgroundColor: color,
  border: "none",
  padding: "8px 14px",
  color: "white",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: 500,
  transition: "transform 0.1s ease",
  boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
});

export default MemoryGame;
