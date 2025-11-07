import React, { useEffect, useState } from "react";
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
  const [showGrid, setShowGrid] = useState(false);
  const [showStartButton, setShowStartButton] = useState(false);

  // 🔁 Realtime listener for Supabase game state updates
  useEffect(() => {
    if (!room?.id) return;

    const channel = supabase
      .channel(`memory-game-${room.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${room.id}` },
        (payload) => {
          const newState = payload.new?.game_state;
          if (newState) setLocalState(newState);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id]);

  // initialize host button
  useEffect(() => {
    if (!gameState?.started && players.length > 0) {
      if (currentPlayer.id === room.host_id) setShowStartButton(true);
    } else {
      setLocalState(gameState);
    }
  }, [gameState, players]);

  // 🔄 Push updates to Supabase (for everyone)
  const syncToSupabase = async (newState: MemoryGameState | Partial<MemoryGameState>) => {
    await supabase
      .from("rooms")
      .update({ game_state: newState })
      .eq("id", room.id);
  };

  // start game handler
  const handleStart = async () => {
    const newState = initMemoryGameState(players.map((p) => ({ id: p.id, name: p.name })));
    newState.started = true;
    onUpdateState(newState);
    setShowGrid(true);
    await syncToSupabase(newState);

    // show grid for 5 sec, then hide unrevealed tiles
    setTimeout(async () => {
      const hiddenGrid = {
        ...newState,
        grid: newState.grid.map((row) =>
          row.map((tile) => ({ ...tile, revealed: false }))
        ),
      };
      setShowGrid(false);
      onUpdateState(hiddenGrid);
      await syncToSupabase(hiddenGrid);
    }, 5000);
  };

  if (!localState && !gameState?.started) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        {showStartButton ? (
          <button
            onClick={handleStart}
            className="px-6 py-2 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700"
          >
            Start Game
          </button>
        ) : (
          <p className="text-gray-400">Waiting for host to start...</p>
        )}
      </div>
    );
  }

  const current = gameState?.started ? gameState : localState;
  if (!current) return null;

  const { grid, currentPlayerId, players: gamePlayers } = current;
  const me = gamePlayers.find((p) => p.id === currentPlayer.id);
  const isMyTurn = currentPlayer.id === currentPlayerId;

  const handleClick = async (tileId: string) => {
    if (!isMyTurn || showGrid) return;
    const newState = handleTileTap(current, currentPlayer.id, tileId);
    onUpdateState(newState);
    await syncToSupabase(newState);
  };

  const handleAbility = async (type: "paint" | "stake" | "viewPart") => {
    let newState = current;
    if (type === "paint") newState = activatePaint(current, currentPlayer.id, "");
    if (type === "stake") newState = activateStake(current, currentPlayer.id);
    if (type === "viewPart") newState = activateViewPart(current);
    onUpdateState(newState);
    await syncToSupabase(newState);
  };

  const playerColor = (id: string) =>
    gamePlayers.find((p) => p.id === id)?.color || "#ccc";

  return (
    <div className="flex flex-col items-center p-4">
      <h2 className="text-2xl font-bold mb-2">🧠 Memory Match</h2>
      <p className="mb-4">
        Current Turn:{" "}
        <span
          className="font-semibold"
          style={{ color: playerColor(currentPlayerId) }}
        >
          {gamePlayers.find((p) => p.id === currentPlayerId)?.name}
        </span>
      </p>

      {/* Game Layout */}
      <div className="flex flex-row gap-6">
        {/* Grid */}
        <div
          className="grid gap-2 border p-3 rounded-lg bg-gray-800"
          style={{
            gridTemplateColumns: `repeat(${grid.length}, 50px)`,
          }}
        >
          {grid.flat().map((tile) => (
            <div
              key={tile.id}
              onClick={() => handleClick(tile.id)}
              className="w-12 h-12 rounded-md border cursor-pointer transition-all duration-200"
              style={{
                backgroundColor: tile.revealed
                  ? tile.color || "#ddd"
                  : "#1f2937",
              }}
            />
          ))}
        </div>

        {/* Abilities */}
        {me && (
          <div className="flex flex-col items-center gap-4 mt-4">
            <div className="font-semibold text-gray-200 mb-2">Abilities</div>
            {me.abilities.paint && (
              <button
                onClick={() => handleAbility("paint")}
                className="w-12 h-12 rounded-full bg-pink-500 hover:bg-pink-600 text-white text-xl"
                title="Paint"
              >
                🎨
              </button>
            )}
            {me.abilities.stake && (
              <button
                onClick={() => handleAbility("stake")}
                className="w-12 h-12 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-xl"
                title="Stake"
              >
                💎
              </button>
            )}
            {me.abilities.viewPart && (
              <button
                onClick={() => handleAbility("viewPart")}
                className="w-12 h-12 rounded-full bg-green-500 hover:bg-green-600 text-white text-xl"
                title="View"
              >
                👁️
              </button>
            )}
          </div>
        )}
      </div>

      {/* Scoreboard */}
      <div className="mt-6 w-full max-w-md flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-center mb-2">Scores</h3>
        {gamePlayers.map((p) => (
          <div
            key={p.id}
            className={`flex items-center justify-between px-3 py-2 rounded-lg bg-gray-700 text-white ${
              p.id === currentPlayerId ? "border-2 border-yellow-400" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-5 h-5 rounded-full"
                style={{ backgroundColor: p.color }}
              ></div>
              <span>{p.name}</span>
            </div>
            <span className="text-sm">{p.revealedCount} tiles</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MemoryGame;
