import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { MemoryGameState, Tile } from "../../lib/gameLogic";
import { Room, Player } from "../../lib/supabase";

interface MemoryGameProps {
  room: Room;
  players: Player[];
  currentPlayer: Player;
  gameState: MemoryGameState;
  onUpdateState: (newState: Partial<MemoryGameState>) => void;
  isHost: boolean;
}

const COLORS = [
  "#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b", "#64748b"
];

export default function MemoryGame({
  room,
  players,
  currentPlayer,
  gameState,
  onUpdateState,
  isHost,
}: MemoryGameProps) {
  const [showColors, setShowColors] = useState(false);
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const myColor = COLORS[players.findIndex(p => p.id === currentPlayer.id) % COLORS.length];

  // Handle Supabase Realtime Sync
  useEffect(() => {
    const channel = supabase
      .channel(`room-${room.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${room.id}` },
        (payload) => {
          if (payload.new?.game_state) onUpdateState(payload.new.game_state);
        })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room.id, onUpdateState]);

  // Host starts the game
  const handleStart = async () => {
    if (!isHost) return;
    setIsLoading(true);
    await supabase.from("rooms").update({
      game_state: { ...gameState, started: true }
    }).eq("id", room.id);
    setIsLoading(false);

    // Show grid for 5 seconds
    setShowColors(true);
    setTimeout(() => setShowColors(false), 5000);
  };

  const handleTileClick = async (tile: Tile) => {
    if (!gameState.started || currentPlayer.id !== gameState.currentTurn) return;

    const updatedGrid = gameState.grid.map(row =>
      row.map(t => (t.id === tile.id ? { ...t, revealed: true } : t))
    );

    const newState = {
      ...gameState,
      grid: updatedGrid,
      revealedTiles: [...gameState.revealedTiles, tile.id]
    };

    // Check after 2 reveals
    if (newState.revealedTiles.length === 2) {
      const [id1, id2] = newState.revealedTiles;
      const flat = newState.grid.flat();
      const t1 = flat.find(t => t.id === id1);
      const t2 = flat.find(t => t.id === id2);

      let updatedScores = { ...gameState.scores };
      let nextTurn = gameState.currentTurn;

      if (t1?.color === t2?.color) {
        updatedScores[currentPlayer.id] = (updatedScores[currentPlayer.id] || 0) + 1;
      } else {
        const idx = Object.keys(updatedScores).indexOf(gameState.currentTurn);
        const nextIdx = (idx + 1) % Object.keys(updatedScores).length;
        nextTurn = Object.keys(updatedScores)[nextIdx];
      }

      setTimeout(async () => {
        const resetGrid = newState.grid.map(row =>
          row.map(t =>
            (t.id === id1 || t.id === id2) && t1?.color !== t2?.color
              ? { ...t, revealed: false }
              : t
          )
        );
        await supabase.from("rooms").update({
          game_state: {
            ...newState,
            grid: resetGrid,
            revealedTiles: [],
            scores: updatedScores,
            currentTurn: nextTurn,
          }
        }).eq("id", room.id);
      }, 1000);
    } else {
      await supabase.from("rooms").update({
        game_state: newState
      }).eq("id", room.id);
    }
  };

  // --- ABILITIES ---
  const handleAbility = async (type: "paint" | "stake" | "view") => {
    if (type === "view") {
      setShowColors(true);
      setTimeout(() => setShowColors(false), 3000);
    }
    // "paint" & "stake" would alter grid/points in actual gameplay
    alert(`${type.toUpperCase()} activated! (Simulated for now)`);
  };

  // --- UI ---
  return (
    <div className="flex flex-col items-center text-white p-4">
      <h1 className="text-3xl font-bold mb-2">🎨 Memory Grid Game</h1>
      <p className="text-gray-300 mb-4">Remember your tiles and uncover them fast!</p>

      {!gameState.started && isHost && (
        <button
          onClick={handleStart}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg mb-4"
        >
          {isLoading ? "Starting..." : "Start Game"}
        </button>
      )}

      {/* Scores Display */}
      <div className="flex flex-wrap justify-center gap-3 mb-4">
        {players.map((p) => (
          <div
            key={p.id}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl shadow-md ${gameState.currentTurn === p.id ? "bg-blue-800" : "bg-gray-800"}`}
          >
            <div className="w-4 h-4 rounded-full" style={{ background: COLORS[players.findIndex(pl => pl.id === p.id) % COLORS.length] }}></div>
            <span className="font-semibold">{p.name}</span>
            <span className="text-yellow-300 ml-1">{gameState.scores[p.id] || 0}</span>
          </div>
        ))}
      </div>

      {/* Game Grid */}
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${gameState.gridSize}, 50px)`,
          gridTemplateRows: `repeat(${gameState.gridSize}, 50px)`,
        }}
      >
        {gameState.grid.flat().map((tile) => (
          <div
            key={tile.id}
            onClick={() => handleTileClick(tile)}
            style={{
              background: tile.revealed || showColors ? tile.color : "#1f2937",
              border: "1px solid #374151",
              borderRadius: "6px",
              width: "50px",
              height: "50px",
              cursor: "pointer",
            }}
          ></div>
        ))}
      </div>

      {/* Abilities on the Right */}
      <div className="flex justify-center gap-4 mt-5">
        <button
          onClick={() => handleAbility("paint")}
          className="w-14 h-14 rounded-full bg-pink-600 hover:bg-pink-700 flex items-center justify-center"
        >
          🎨
        </button>
        <button
          onClick={() => handleAbility("stake")}
          className="w-14 h-14 rounded-full bg-yellow-500 hover:bg-yellow-600 flex items-center justify-center"
        >
          ⚡
        </button>
        <button
          onClick={() => handleAbility("view")}
          className="w-14 h-14 rounded-full bg-green-600 hover:bg-green-700 flex items-center justify-center"
        >
          👁️
        </button>
      </div>
    </div>
  );
}
