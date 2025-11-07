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
  if (!currentPlayer || !gameState) return;

  const { grid, playerAbilities } = gameState;
  let newGrid = [...grid.map(row => [...row])];

  const randomCell = (filterFn: (cell: any) => boolean) => {
    const valid = [];
    newGrid.forEach((row, i) =>
      row.forEach((cell, j) => filterFn(cell) && valid.push([i, j]))
    );
    if (valid.length === 0) return null;
    return valid[Math.floor(Math.random() * valid.length)];
  };

  switch (type) {
    case "view": {
      // Reveal ~25% random cells temporarily
      const cellsToReveal = Math.floor((grid.length * grid[0].length) * 0.25);
      const visibleGrid = newGrid.map(row =>
        row.map(cell => ({ ...cell, visible: false }))
      );

      for (let i = 0; i < cellsToReveal; i++) {
        const pos = randomCell(() => true);
        if (!pos) continue;
        const [r, c] = pos;
        visibleGrid[r][c].visible = true;
      }

      await onUpdateState({ grid: visibleGrid });
      setTimeout(() => {
        const hiddenGrid = visibleGrid.map(row =>
          row.map(cell => ({ ...cell, visible: false }))
        );
        onUpdateState({ grid: hiddenGrid });
      }, 3000);

      // consume ability
      const newAbilities = {
        ...playerAbilities,
        [currentPlayer.id]: {
          ...playerAbilities[currentPlayer.id],
          view: Math.max(0, playerAbilities[currentPlayer.id].view - 1),
        },
      };
      await onUpdateState({ playerAbilities: newAbilities });
      break;
    }

    case "paint": {
      const emptyCell = randomCell(cell => !cell.color);
      const ownCell = randomCell(cell => cell.owner === currentPlayer.id);

      if (!emptyCell || !ownCell) {
        alert("No valid cells to paint!");
        return;
      }

      const [r1, c1] = emptyCell;
      const [r2, c2] = ownCell;

      // Paint a colorless cell with player color
      newGrid[r1][c1] = {
        ...newGrid[r1][c1],
        color: currentPlayer.color,
        owner: currentPlayer.id,
      };

      // Make one of your color tiles colorless
      newGrid[r2][c2] = { color: null, owner: null };

      const newAbilities = {
        ...playerAbilities,
        [currentPlayer.id]: {
          ...playerAbilities[currentPlayer.id],
          paint: Math.max(0, playerAbilities[currentPlayer.id].paint - 1),
        },
      };

      await onUpdateState({ grid: newGrid, playerAbilities: newAbilities });
      break;
    }

    case "stake": {
      const ownCell = randomCell(cell => cell.owner === currentPlayer.id);
      if (!ownCell) {
        alert("You don't have any tiles to stake!");
        return;
      }

      const [r, c] = ownCell;
      newGrid[r][c].visible = true;

      await onUpdateState({ grid: newGrid });

      // Hide again after few seconds (like 3s)
      setTimeout(() => {
        newGrid[r][c].visible = false;
        onUpdateState({ grid: newGrid });
      }, 3000);

      const newAbilities = {
        ...playerAbilities,
        [currentPlayer.id]: {
          ...playerAbilities[currentPlayer.id],
          stake: Math.max(0, playerAbilities[currentPlayer.id].stake - 1),
        },
      };
      await onUpdateState({ playerAbilities: newAbilities });
      break;
    }

    default:
      break;
  }
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
