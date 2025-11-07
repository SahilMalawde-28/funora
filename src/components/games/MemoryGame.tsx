// components/games/MemoryGame.tsx
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
import { Trophy, Sparkles } from "lucide-react";

interface MemoryGameProps {
  room: Room;
  players: Player[]; // supabase players list (must have player_id or id and name)
  currentPlayer: Player;
  gameState: MemoryGameState | null;
  onUpdateState: (newState: Partial<MemoryGameState> | MemoryGameState) => void;
  // parent handles supabase persistence of the provided object(s)
}

const ScoresBox: React.FC<{ p: PlayerState; isCurrent: boolean }> = ({ p, isCurrent }) => {
  return (
    <div
      style={{
        borderRadius: 12,
        padding: "10px 12px",
        background: isCurrent ? "linear-gradient(90deg,#0ea5e9, #7c3aed)" : "#111827",
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
          <div style={{ fontSize: 12, opacity: 0.8 }}>{p.revealedCount}/{p.ownedCount} tiles</div>
        </div>
      </div>
      <div style={{ fontWeight: 700 }}>{p.revealedCount}</div>
    </div>
  );
};

const MemoryGame: React.FC<MemoryGameProps> = ({ room, players, currentPlayer, gameState, onUpdateState }) => {
  const [localPreview, setLocalPreview] = useState(false); // true while 5s preview is showing
  const [starting, setStarting] = useState(false);
  const [localState, setLocalState] = useState<MemoryGameState | null>(gameState);
  const hostId = room?.host_id || room?.hostId || null;
  const isHost = currentPlayer && (currentPlayer.player_id === hostId || (currentPlayer.id && currentPlayer.id === hostId));

  // keep local copy in sync
  useEffect(() => {
    setLocalState(gameState ?? null);
  }, [gameState]);

  // helper: get UI-friendly players (gameState.players) mapped
  const gamePlayers = localState?.players ?? [];

  // Start handler (host only)
  const handleStart = () => {
    if (!isHost) return;
    // build minimal input for init: use players array (use player_id if present)
    const inputPlayers = players.map((p: any) => ({ id: p.player_id ?? p.id, name: p.name ?? p.display_name ?? p.player_name ?? p.player_id ?? "Anon" }));
    const state = initMemoryGameState(inputPlayers);
    state.started = true;
    // persist initial state (full preview)
    onUpdateState(state);
    setLocalState(state);
    setLocalPreview(true);
    setStarting(true);

    // hide after 5s (make unrevealed = false)
    setTimeout(() => {
      // hide all unrevealed (i.e., set revealed=false for tiles that should be hidden).
      // Since init sets all tiles revealed for preview, we set them false unless someone had permanent reveals (none yet)
      const next: MemoryGameState = {
        ...state,
        grid: state.grid.map(row => row.map(tile => ({ ...tile, revealed: false }))),
      };
      onUpdateState(next);
      setLocalState(next);
      setLocalPreview(false);
      setStarting(false);
    }, 5000);
  };

  // helper to get tile lookup
  const findTileCoords = (s: MemoryGameState, tileId: string): { r: number; c: number } | null => {
    for (let r = 0; r < s.grid.length; r++) {
      for (let c = 0; c < s.grid[r].length; c++) {
        if (s.grid[r][c].id === tileId) return { r, c };
      }
    }
    return null;
  };

  // Click handler wrapper
  const handleClick = (tile: Tile) => {
    if (!localState) return;
    if (!localState.started) return;
    if (localPreview) return; // cannot click during preview
    const curPid = localState.turnOrder[localState.turnIndex];
    const meId = currentPlayer.player_id ?? currentPlayer.id;
    if (!meId) return;
    if (curPid !== meId) return; // not your turn
    if (tile.revealed) return; // already permanently revealed
    // call logic to get next state
    const updated = handleTileTap(localState, meId, tile.id);
    // write up
    onUpdateState(updated);
    setLocalState(updated);
  };

  // Ability handlers (call logic then persist)
  const handlePaint = () => {
    if (!localState) return;
    const meId = currentPlayer.player_id ?? currentPlayer.id;
    if (!meId) return;
    const next = activatePaint(localState, meId);
    onUpdateState(next);
    setLocalState(next);
  };

  const handleStake = () => {
    if (!localState) return;
    const meId = currentPlayer.player_id ?? currentPlayer.id;
    if (!meId) return;
    const next = activateStake(localState, meId);
    onUpdateState(next);
    setLocalState(next);
  };

  const handleView = () => {
    if (!localState) return;
    const meId = currentPlayer.player_id ?? currentPlayer.id;
    if (!meId) return;
    const next = activateViewPart(localState, meId);
    onUpdateState(next);
    setLocalState(next);

    // also schedule clearing of viewTiles after 3s (so UI hides them)
    setTimeout(() => {
      if (!localState) return;
      const cleared = { ...next, viewTiles: [] };
      onUpdateState(cleared);
      setLocalState(cleared);
    }, 3000);
  };

  // Render helpers
  if (!localState) {
    // before start: show start button to host, else waiting text
    return (
      <div style={{ padding: 24 }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Trophy color="#f59e0b" />
              <h2 style={{ margin: 0 }}>🧠 Memory Clash</h2>
            </div>
            <div>
              {isHost ? (
                <button onClick={handleStart} style={{ background: "#10b981", color: "#fff", padding: "8px 14px", borderRadius: 10, fontWeight: 700 }}>
                  Start Game
                </button>
              ) : (
                <div style={{ color: "#9ca3af" }}>Waiting for host to start...</div>
              )}
            </div>
          </div>

          <div style={{ background: "#0f172a", padding: 16, borderRadius: 12, color: "#e5e7eb" }}>
            <div style={{ marginBottom: 8 }}>Players:</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
              {players.map((p: any) => (
                <div key={p.player_id ?? p.id} style={{ padding: 8, borderRadius: 10, background: "#111827", color: "#fff" }}>
                  <div style={{ fontWeight: 700 }}>{p.name ?? p.player_id ?? p.id}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // active UI
  const gridSize = localState.grid.length;
  const curPlayerId = localState.turnOrder[localState.turnIndex];
  const curPlayer = localState.players.find(p => p.id === curPlayerId) ?? null;
  const mePlayer = localState.players.find(p => p.id === (currentPlayer.player_id ?? currentPlayer.id)) ?? null;

  // flattened tiles for keys
  const flatTiles = localState.grid.flat();

  return (
    <div style={{ padding: 20 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Trophy color="#f59e0b" />
            <div>
              <h2 style={{ margin: 0 }}>🧠 Memory Clash</h2>
              <div style={{ fontSize: 13, color: "#9ca3af" }}>Grid: {gridSize}×{gridSize} • Turn: {curPlayer?.name ?? "—"}</div>
            </div>
          </div>

          <div>
            {isHost && (
              <button onClick={() => {
                // host can force show preview again for 5s (optional)
                setLocalPreview(true);
                // show all tiles by setting revealed true locally (persist)
                const showAll = { ...localState, grid: localState.grid.map(r => r.map(t => ({ ...t, revealed: true }))) };
                onUpdateState(showAll);
                setLocalState(showAll);
                setTimeout(() => {
                  const hidden = { ...showAll, grid: showAll.grid.map(r => r.map(t => ({ ...t, revealed: false }))) };
                  onUpdateState(hidden);
                  setLocalState(hidden);
                  setLocalPreview(false);
                }, 5000);
              }} style={{ padding: "8px 12px", background: "#7c3aed", color: "#fff", borderRadius: 10, marginRight: 8 }}>
                Preview 5s
              </button>
            )}
          </div>
        </div>

        {/* Top scoreboard */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
          {/* Left: Grid */}
          <div>
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              {/* show turn box */}
              <div style={{ padding: 12, borderRadius: 10, background: "#0b1220", color: "#e6eef8", display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 14, height: 14, background: curPlayer?.color, borderRadius: 4 }} />
                <div>
                  <div style={{ fontWeight: 800 }}>{curPlayer?.name ?? "—"}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>Current Turn</div>
                </div>
              </div>

              {/* abilities for me */}
              <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={handlePaint} disabled={!mePlayer || mePlayer.abilities.paint <= 0 || localPreview} style={{ borderRadius: 999, padding: 10, background: mePlayer?.abilities.paint ? "#ec4899" : "#374151", color: "#fff", fontWeight: 800 }}>
                  🎨 {mePlayer?.abilities.paint ?? 0}
                </button>
                <button onClick={handleStake} disabled={!mePlayer || mePlayer.abilities.stake <= 0 || localPreview} style={{ borderRadius: 999, padding: 10, background: mePlayer?.abilities.stake ? "#3b82f6" : "#374151", color: "#fff", fontWeight: 800 }}>
                  💎 {mePlayer?.abilities.stake ?? 0}
                </button>
                <button onClick={handleView} disabled={!mePlayer || mePlayer.abilities.view <= 0 || localPreview} style={{ borderRadius: 999, padding: 10, background: mePlayer?.abilities.view ? "#10b981" : "#374151", color: "#fff", fontWeight: 800 }}>
                  👁️ {mePlayer?.abilities.view ?? 0}
                </button>
              </div>
            </div>

            {/* Grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: `repeat(${gridSize}, 48px)`,
              gap: 6,
              justifyContent: "center",
              padding: 8,
              background: "#020617",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.02)",
            }}>
              {localState.grid.map((row, rIdx) =>
                row.map(tile => {
                  const isTempRevealed = localState.viewTiles && localState.viewTiles.includes(tile.id);
                  const showColor = tile.revealed || isTempRevealed || localPreview;
                  const bg = showColor ? (tile.color || "#9ca3af") : "#0f172a";
                  return (
                    <div
                      key={tile.id}
                      onClick={() => handleClick(tile)}
                      style={{
                        width: 48, height: 48, borderRadius: 8,
                        background: bg,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        border: tile.revealed ? "2px solid rgba(255,255,255,0.06)" : "1px solid rgba(255,255,255,0.02)",
                        cursor: (localPreview || tile.revealed) ? "not-allowed" : (localState.turnOrder[localState.turnIndex] === (currentPlayer.player_id ?? currentPlayer.id) ? "pointer" : "not-allowed"),
                        transition: "all 120ms ease"
                      }}
                      title={showColor ? (tile.ownerId ? `Owner: ${tile.ownerId}` : "Colorless") : "Hidden"}
                    >
                      {showColor && tile.ownerId ? <div style={{ color: "#fff", fontWeight: 800, fontSize: 12 }}>{/* no text by design */}</div> : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Scores & players */}
          <div>
            <div style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Players</h3>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>{localState.players.length} players</div>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {localState.players.map(p => (
                <div key={p.id}>
                  <ScoresBox p={p} isCurrent={p.id === curPlayerId} />
                </div>
              ))}
            </div>

            {/* host start / next-round controls */}
            <div style={{ marginTop: 12 }}>
              {isHost && !localState.started && (
                <button onClick={handleStart} style={{ width: "100%", padding: 10, background: "#10b981", color: "#fff", borderRadius: 10, fontWeight: 800 }}>
                  Start Game
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer: small tips */}
        <div style={{ marginTop: 14, color: "#9ca3af", fontSize: 13 }}>
          Tip: Each tile is 1 point. If you reveal your own tile you score it; if you reveal someone else's tile it counts for them.
        </div>
      </div>
    </div>
  );
};

export default MemoryGame;
