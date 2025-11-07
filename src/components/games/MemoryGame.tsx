// src/components/games/MemoryGame.tsx
import React, { useEffect, useState, useRef } from "react";
import {
  initMemoryGameState,
  handleTileTap,
  activatePaint,
  activateStake,
  activateViewPart,
  MemoryGameState,
} from "../../lib/gameLogic";
import { supabase } from "../../lib/supabase";

interface MemoryGameProps {
  room: any; // room row from supabase (must include id, host_id, game_state)
  players: any[]; // list of players (id, name, avatar, ...)
  currentPlayer: any; // current connected player
  gameState: MemoryGameState | null; // current shared game state (may be null until set)
  onUpdateState: (newState: Partial<MemoryGameState>) => void; // local -> parent
}

export default function MemoryGame({
  room,
  players,
  currentPlayer,
  gameState,
  onUpdateState,
}: MemoryGameProps) {
  // local copy for immediate UI updates
  const [localState, setLocalState] = useState<MemoryGameState | null>(gameState ?? null);
  const [previewing, setPreviewing] = useState(false); // true while showing grid for 5s
  const [startVisible, setStartVisible] = useState(false);
  const previewTimer = useRef<number | null>(null);

  // ensure host sees Start button when game not started
  useEffect(() => {
    if (!gameState?.started && players.length > 0 && currentPlayer) {
      setStartVisible(currentPlayer.id === room?.host_id);
    } else {
      setStartVisible(false);
    }
    // keep localState synced when parent provides state
    setLocalState(gameState ?? null);
  }, [gameState, players, currentPlayer, room?.host_id]);

  // Supabase realtime listener: watch `rooms` row changes and update local state
  useEffect(() => {
    if (!room?.id) return;
    const channel = supabase
      .channel(`room-memory-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${room.id}`,
        },
        (payload: any) => {
          try {
            const newRow = payload?.new;
            if (!newRow) return;
            const newGameState = newRow.game_state ?? null;
            // update both local and parent
            setLocalState(newGameState);
            onUpdateState(newGameState ?? {});
          } catch (e) {
            console.warn("MemoryGame: failed to apply payload", e);
          }
        }
      )
      .subscribe();

    return () => {
      if (previewTimer.current) {
        window.clearTimeout(previewTimer.current);
        previewTimer.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [room?.id]);

  // helper: write state to supabase (rooms.game_state)
  const syncToSupabase = async (newState: MemoryGameState) => {
    if (!room?.id) return;
    try {
      await supabase.from("rooms").update({ game_state: newState }).eq("id", room.id);
    } catch (e) {
      console.warn("MemoryGame: sync error", e);
    }
  };

  // Host: start button pressed
  const handleStart = async () => {
    if (!players || players.length === 0) return;

    // Initialize using your gameLogic util (keeps game rules centralized)
    const initState = initMemoryGameState(players.map((p) => ({ id: p.id, name: p.name })));
    const newState: MemoryGameState = { ...initState, started: true };

    // show preview view locally and push to server
    setLocalState(newState);
    setPreviewing(true);
    onUpdateState(newState);
    await syncToSupabase(newState);

    // after 5s hide unrevealed tiles (preview ends) and push that update
    previewTimer.current = window.setTimeout(async () => {
      // set all tiles' revealed to false unless they are marked revealed already by init (we rely on init)
      const hidden = {
        ...newState,
        grid: newState.grid.map((row) =>
          row.map((t) => ({ ...t, revealed: Boolean(t.revealed) })) // keep explicit reveals, otherwise they should be hidden by gameLogic
        ),
      } as MemoryGameState;

      setLocalState(hidden);
      setPreviewing(false);
      onUpdateState(hidden);
      await syncToSupabase(hidden);
      previewTimer.current = null;
    }, 5000);
  };

  // handle clicking a tile
  const handleClickTile = async (tileId: string) => {
    if (!localState) return;
    if (previewing) return; // cannot click during preview
    if (localState.currentPlayerId !== currentPlayer.id) return; // not your turn

    // call gameLogic handler to produce next state
    const newState = handleTileTap(localState, currentPlayer.id, tileId);
    setLocalState(newState);
    onUpdateState(newState);
    await syncToSupabase(newState);
  };

  // abilities (call gameLogic)
  const handleAbility = async (type: "paint" | "stake" | "viewPart") => {
    if (!localState) return;
    if (localState.currentPlayerId !== currentPlayer.id) return; // only active player can activate abilities (you specified paint can be activated before choosing etc.)
    let newState = localState;
    if (type === "paint") newState = activatePaint(localState, currentPlayer.id, "");
    if (type === "stake") newState = activateStake(localState, currentPlayer.id);
    if (type === "viewPart") newState = activateViewPart(localState);

    setLocalState(newState);
    onUpdateState(newState);
    await syncToSupabase(newState);
  };

  // helpers to render
  const state = localState ?? (gameState as MemoryGameState | null);
  if (!state) {
    // show start button or waiting message
    return (
      <div className="flex flex-col items-center justify-center p-6">
        {startVisible ? (
          <button
            onClick={handleStart}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold shadow"
          >
            Start Game
          </button>
        ) : (
          <div className="text-gray-400">Waiting for host to start the Memory game...</div>
        )}
      </div>
    );
  }

  // computed values
  const grid = state.grid;
  const gridSize = grid.length; // e.g., 7..9
  const currentId = state.currentPlayerId;
  const gamePlayers = state.players || [];
  const me = gamePlayers.find((p) => p.id === currentPlayer.id) ?? null;

  // Player color helper
  const playerColor = (id: string) => gamePlayers.find((p) => p.id === id)?.color || "#9CA3AF";

  // UI rendering — keep keys unique
  return (
    <div className="min-h-screen p-6 bg-gradient-to-b from-gray-900 via-gray-950 to-gray-900 text-gray-100">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-extrabold">🧠 Memory Match</h2>
            <p className="text-sm text-gray-400">Grid: {gridSize}×{gridSize} • Players: {gamePlayers.length} • Max 10</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-gray-400">Host</div>
              <div className="font-semibold">{players.find(p => p.id === room?.host_id)?.name ?? "—"}</div>
            </div>

            {startVisible && (
              <button
                onClick={handleStart}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md font-semibold"
              >
                Start Game
              </button>
            )}
          </div>
        </div>

        {/* Main area: grid + abilities + scoreboard */}
        <div className="flex gap-6">
          {/* Grid */}
          <div>
            <div
              className="rounded-lg p-4 bg-gray-800 border border-gray-700"
              style={{ minWidth: gridSize * 52 }}
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-300">Current Turn</div>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: playerColor(currentId) }}
                    />
                    <div className="font-semibold">
                      {gamePlayers.find((p) => p.id === currentId)?.name ?? "—"}
                    </div>
                    {previewing && <span className="ml-2 text-xs px-2 py-1 bg-yellow-600 rounded">Preview</span>}
                  </div>
                </div>

                <div className="text-sm text-gray-400">
                  Hint: you can only click when it's your turn and preview finished.
                </div>
              </div>

              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: `repeat(${gridSize}, 52px)`,
                }}
              >
                {grid.flat().map((tile) => {
                  // tile: { id, revealed, color, ownerId? }
                  return (
                    <div
                      key={tile.id}
                      onClick={() => handleClickTile(tile.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && handleClickTile(tile.id)}
                      className={`w-12 h-12 rounded-md border cursor-pointer flex items-center justify-center select-none transition-all
                          ${tile.revealed ? "shadow-md" : "bg-gray-800 hover:bg-gray-700"}
                        `}
                      style={{
                        backgroundColor: tile.revealed ? tile.color || "#E5E7EB" : undefined,
                        borderColor: tile.revealed ? "#111827" : "#374151",
                      }}
                    >
                      {/* show a small owner initial if revealed and owned */}
                      {tile.revealed && tile.ownerId ? (
                        <span className="text-xs font-bold" style={{ color: "#051124" }}>
                          {gamePlayers.find((p) => p.id === tile.ownerId)?.name?.[0] ?? ""}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right column: abilities + scoreboard */}
          <div className="w-72 flex flex-col gap-4">
            {/* Abilities */}
            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">Abilities</div>
                <div className="text-xs text-gray-400">One-time / turn rules applied by gameLogic</div>
              </div>

              <div className="flex gap-3">
                {/* show ability buttons for the current player on their turn or for you if present */}
                {me && (
                  <>
                    <button
                      onClick={() => handleAbility("paint")}
                      className="flex-1 rounded-full h-10 flex items-center justify-center bg-pink-600 hover:bg-pink-700"
                      title="Paint: convert an uncolored tile to your color (consumes one of your tiles)"
                    >
                      🎨
                    </button>
                    <button
                      onClick={() => handleAbility("stake")}
                      className="flex-1 rounded-full h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-700"
                      title="Stake: secret stake activation for the active player's pick"
                    >
                      💎
                    </button>
                    <button
                      onClick={() => handleAbility("viewPart")}
                      className="flex-1 rounded-full h-10 flex items-center justify-center bg-green-600 hover:bg-green-700"
                      title="View: reveal a random subset to everyone temporarily"
                    >
                      👁️
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Scoreboard */}
            <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
              <div className="font-semibold mb-3">Scores</div>
              <div className="flex flex-col gap-2">
                {gamePlayers.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg ${p.id === currentId ? "border-2 border-yellow-400 bg-gray-700" : "bg-gray-900"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full"
                        style={{ backgroundColor: p.color || "#9CA3AF" }}
                      />
                      <div>
                        <div className="text-sm font-semibold">{p.name}</div>
                        <div className="text-xs text-gray-400">Tiles: {p.revealedCount ?? 0}</div>
                      </div>
                    </div>

                    <div className="text-sm text-gray-200">{p.id === currentPlayer.id ? "You" : ""}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Legend / small controls */}
            <div className="p-3 text-xs text-gray-400 bg-gray-900 rounded-lg border border-gray-800">
              <div className="mb-2">Legend</div>
              <div className="flex flex-col gap-1">
                <div>• Click tile only on your turn.</div>
                <div>• Host must start the game (preview shown 5s).</div>
                <div>• Abilities are one-time / controlled by gameLogic.</div>
              </div>
            </div>
          </div>
        </div>

        {/* footer note */}
        <div className="mt-6 text-center text-sm text-gray-500">
          Tip: if the UI seems out of sync, ask the host to re-start or refresh — real-time updates come from the `rooms` row (game_state).
        </div>
      </div>
    </div>
  );
}
