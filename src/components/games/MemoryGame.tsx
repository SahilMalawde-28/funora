import React, { useEffect, useMemo, useState } from "react";
import { Room, Player } from "../../lib/supabase";
import {
  initMemoryGameState,
  handleTileTap,
  activatePaint,
  activateStake,
  activateViewPart,
  MemoryGameState,
  Tile,
  PlayerState,
} from "../../lib/gameLogic";
import { Trophy } from "lucide-react";

interface MemoryGameProps {
  room: Room;
  players: Player[];
  currentPlayer: Player;
  gameState: MemoryGameState | null;
  onUpdateState: (newState: Partial<MemoryGameState> | MemoryGameState) => void;
}

const ScoresBox: React.FC<{ p: PlayerState; isCurrent: boolean }> = ({ p, isCurrent }) => (
  <div
    style={{
      borderRadius: 12,
      padding: "10px 12px",
      background: isCurrent ? "linear-gradient(90deg,#0ea5e9,#7c3aed)" : "#111827",
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 18, height: 18, background: p.color, borderRadius: 6 }} />
      <div>
        <div style={{ fontWeight: 700 }}>{p.name}</div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          {p.revealedCount}/{p.ownedCount} tiles
        </div>
      </div>
    </div>
    <div style={{ fontWeight: 700 }}>{p.revealedCount}</div>
  </div>
);

const MemoryGame: React.FC<MemoryGameProps> = ({
  room,
  players,
  currentPlayer,
  gameState,
  onUpdateState,
}) => {
  const [localPreview, setLocalPreview] = useState(false);
  const [starting, setStarting] = useState(false);
  const [localState, setLocalState] = useState<MemoryGameState | null>(gameState);
  const [winner, setWinner] = useState<PlayerState | null>(null);

  const hostId = room?.host_id || room?.hostId || null;
  const isHost =
    currentPlayer &&
    (currentPlayer.player_id === hostId ||
      (currentPlayer.id && currentPlayer.id === hostId));

  useEffect(() => {
    setLocalState(gameState ?? null);
  }, [gameState]);

  useEffect(() => {
    if (localState) {
      const win = localState.players.find(
        (p) => p.revealedCount >= (p.ownedCount || 0) && p.ownedCount > 0
      );
      if (win) setWinner(win);
    }
  }, [localState]);

  const handleStart = () => {
    if (!isHost) return;
    const inputPlayers = players.map((p: any) => ({
      id: p.player_id ?? p.id,
      name: p.name ?? p.display_name ?? p.player_name ?? p.player_id ?? "Anon",
    }));
    const state = initMemoryGameState(inputPlayers);
    state.started = true;
    onUpdateState(state);
    setLocalState(state);
    setLocalPreview(true);
    setStarting(true);

    setTimeout(() => {
      const next: MemoryGameState = {
        ...state,
        grid: state.grid.map((row) =>
          row.map((tile) => ({ ...tile, revealed: false }))
        ),
      };
      onUpdateState(next);
      setLocalState(next);
      setLocalPreview(false);
      setStarting(false);
    }, 5000);
  };

  const handleClick = (tile: Tile) => {
    if (!localState || winner) return;
    if (!localState.started || localPreview) return;
    const curPid = localState.turnOrder[localState.turnIndex];
    const meId = currentPlayer.player_id ?? currentPlayer.id;
    if (!meId || curPid !== meId || tile.revealed) return;
    const updated = handleTileTap(localState, meId, tile.id);
    onUpdateState(updated);
    setLocalState(updated);
  };

  const handlePaint = () => {
    if (!localState || winner) return;
    const meId = currentPlayer.player_id ?? currentPlayer.id;
    if (!meId) return;
    const next = activatePaint(localState, meId);
    onUpdateState(next);
    setLocalState(next);
  };

  const handleStake = () => {
    if (!localState || winner) return;
    const meId = currentPlayer.player_id ?? currentPlayer.id;
    if (!meId) return;
    const next = activateStake(localState, meId);
    onUpdateState(next);
    setLocalState(next);
  };

  const handleView = () => {
    if (!localState || winner) return;
    const meId = currentPlayer.player_id ?? currentPlayer.id;
    if (!meId) return;
    const next = activateViewPart(localState, meId);
    onUpdateState(next);
    setLocalState(next);

    setTimeout(() => {
      if (!localState) return;
      const cleared = { ...next, viewTiles: [] };
      onUpdateState(cleared);
      setLocalState(cleared);
    }, 3000);
  };

  if (!localState) {
    return (
      <div
        style={{
          padding: 24,
          background: "#0f172a",
          minHeight: "100vh",
          color: "#e5e7eb",
        }}
      >
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <Header title="🧠 Memory Clash" isHost={isHost} handleStart={handleStart} />
          <div
            style={{
              background: "#0f172a",
              padding: 16,
              borderRadius: 12,
              color: "#e5e7eb",
            }}
          >
            <div style={{ marginBottom: 8 }}>Players:</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
                gap: 10,
              }}
            >
              {players.map((p: any) => (
                <div
                  key={p.player_id ?? p.id}
                  style={{
                    padding: 8,
                    borderRadius: 10,
                    background: "#111827",
                    color: "#fff",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {p.name ?? p.player_id ?? p.id}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const gridSize = localState.grid.length;
  const curPlayerId = localState.turnOrder[localState.turnIndex];
  const curPlayer =
    localState.players.find((p) => p.id === curPlayerId) ?? null;
  const mePlayer =
    localState.players.find(
      (p) => p.id === (currentPlayer.player_id ?? currentPlayer.id)
    ) ?? null;

  return (
    <div
      style={{
        padding: 20,
        background: "#0f172a",
        minHeight: "100vh",
        color: "#e5e7eb",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Header
          title="🧠 Memory Clash"
          isHost={isHost}
          handleStart={handleStart}
          localState={localState}
          setLocalState={setLocalState}
          onUpdateState={onUpdateState}
          setLocalPreview={setLocalPreview}
        />

        {/* Responsive Layout */}
        <div
          style={{
            display: "flex",
            flexDirection: window.innerWidth < 768 ? "column" : "row",
            gap: window.innerWidth < 768 ? 20 : 40,
          }}
        >
          {/* Grid Section */}
          <div style={{ flex: 2 }}>
            <AbilitiesBar
              curPlayer={curPlayer}
              mePlayer={mePlayer}
              localPreview={localPreview}
              handleStake={handleStake}
              handleView={handleView}
            />

            <GameGrid
              localState={localState}
              localPreview={localPreview}
              currentPlayer={currentPlayer}
              handleClick={handleClick}
            />
          </div>

          {/* Scores Section */}
          <div style={{ flex: 1 }}>
            <h3 style={{ marginBottom: 8 }}>Players</h3>
            <div style={{ display: "grid", gap: 8 }}>
              {localState.players.map((p) => (
                <ScoresBox
                  key={p.id}
                  p={p}
                  isCurrent={p.id === curPlayerId}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Rules Section */}
        <div
          style={{
            marginTop: 20,
            background: "#111827",
            padding: 16,
            borderRadius: 10,
            color: "#d1d5db",
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          <h4 style={{ marginBottom: 8 }}>🎮 How to Play</h4>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Each tile is worth 1 point.</li>
            <li>Reveal your own tiles to score points.</li>
            <li>
              <b>Stake</b>: Guess and reveal one of your own hidden tiles for
              extra points.
            </li>
            <li>
              <b>View</b>: Briefly shows some random tiles to all players for 3
              seconds.
            </li>
            <li>
              The player who reveals all their tiles first wins the game!
            </li>
          </ul>
        </div>

        {/* Winner Popup */}
        {winner && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100,
            }}
          >
            <div
              style={{
                background: "#111827",
                color: "#fff",
                padding: 30,
                borderRadius: 12,
                textAlign: "center",
              }}
            >
              <h2>🏆 {winner.name} Wins!</h2>
              <p>They revealed all their tiles!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ---------- SMALL SUBCOMPONENTS ---------- */
const Header = ({ title, isHost, handleStart }: any) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 18,
    }}
  >
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <Trophy color="#f59e0b" />
      <h2 style={{ margin: 0 }}>{title}</h2>
    </div>
    {isHost && (
      <button
        onClick={handleStart}
        style={{
          background: "#10b981",
          color: "#fff",
          padding: "8px 14px",
          borderRadius: 10,
          fontWeight: 700,
        }}
      >
        Start Game
      </button>
    )}
  </div>
);

const AbilitiesBar = ({
  curPlayer,
  mePlayer,
  localPreview,
  handleStake,
  handleView,
}: any) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      marginBottom: 12,
      alignItems: "center",
    }}
  >
    <div
      style={{
        padding: 12,
        borderRadius: 10,
        background: "#0b1220",
        display: "flex",
        gap: 10,
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 14,
          height: 14,
          background: curPlayer?.color,
          borderRadius: 4,
        }}
      />
      <div>
        <div style={{ fontWeight: 800 }}>{curPlayer?.name ?? "—"}</div>
        <div style={{ fontSize: 12, color: "#9ca3af" }}>Current Turn</div>
      </div>
    </div>

    <div style={{ display: "flex", gap: 8 }}>
      <button
        onClick={handlePaint}
        disabled={!mePlayer || mePlayer.abilities.paint <= 0 || localPreview}
        style={{
          borderRadius: 999,
          padding: 10,
          background: mePlayer?.abilities.paint ? "#ec4899" : "#374151",
          color: "#fff",
          fontWeight: 800,
        }}
      >
        🎨 {mePlayer?.abilities.paint ?? 0}
      </button>
      <button
        onClick={handleStake}
        disabled={!mePlayer || mePlayer.abilities.stake <= 0 || localPreview}
        style={{
          borderRadius: 999,
          padding: 10,
          background: mePlayer?.abilities.stake ? "#3b82f6" : "#374151",
          color: "#fff",
          fontWeight: 800,
        }}
      >
        💎 {mePlayer?.abilities.stake ?? 0}
      </button>
      <button
        onClick={handleView}
        disabled={!mePlayer || mePlayer.abilities.view <= 0 || localPreview}
        style={{
          borderRadius: 999,
          padding: 10,
          background: mePlayer?.abilities.view ? "#10b981" : "#374151",
          color: "#fff",
          fontWeight: 800,
        }}
      >
        👁️ {mePlayer?.abilities.view ?? 0}
      </button>
    </div>
  </div>
);

const GameGrid = ({ localState, localPreview, currentPlayer, handleClick }: any) => {
  const gridSize = localState.grid.length;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${gridSize}, 48px)`,
        gap: 6,
        justifyContent: "center",
        padding: 8,
        background: "#020617",
        borderRadius: 12,
      }}
    >
      {localState.grid.map((row: Tile[]) =>
        row.map((tile: Tile) => {
          const isTempRevealed =
            localState.viewTiles && localState.viewTiles.includes(tile.id);
          const showColor = tile.revealed || isTempRevealed || localPreview;
          const bg = showColor ? tile.color || "#9ca3af" : "#0f172a";
          return (
            <div
              key={tile.id}
              onClick={() => handleClick(tile)}
              style={{
                width: 48,
                height: 48,
                borderRadius: 8,
                background: bg,
                border: "1px solid rgba(255,255,255,0.05)",
                cursor: showColor ? "not-allowed" : "pointer",
                transition: "all 120ms ease",
              }}
            />
          );
        })
      )}
    </div>
  );
};

export default MemoryGame;
