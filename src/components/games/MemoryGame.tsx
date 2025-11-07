import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
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
  const [channel, setChannel] = useState<any>(null);
  const [showColors, setShowColors] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  useEffect(() => {
    if (!channel) {
      const ch = supabase.channel(`room-${room.id}`);
      ch.on("broadcast", { event: "update" }, ({ payload }) => {
        setLocalState(payload.state);
      });
      ch.subscribe();
      setChannel(ch);
    }
  }, []);

  useEffect(() => {
    if (!gameState?.started && players.length > 0) {
      const newState = initMemoryGameState(players);
      onUpdateState(newState);
      setLocalState(newState);
    } else {
      setLocalState(gameState);
    }
  }, [gameState, players]);

  const broadcast = (newState: any) => {
    if (channel)
      channel.send({
        type: "broadcast",
        event: "update",
        payload: { state: newState },
      });
    onUpdateState(newState);
  };

  if (!localState) return null;
  const { grid, currentPlayerId, players: gamePlayers, started } = localState;
  const me = gamePlayers.find((p) => p.id === currentPlayer.id);
  const isMyTurn = currentPlayer.id === currentPlayerId;
  const isHost = room.host_id === currentPlayer.id;

  const startGame = () => {
    setShowColors(true);
    setTimeout(() => {
      setShowColors(false);
      const newState = { ...localState, started: true };
      setGameStarted(true);
      broadcast(newState);
    }, 5000);
  };

  const handleClick = (tileId: string) => {
    if (!isMyTurn || !started) return;
    const newState = handleTileTap(localState, currentPlayer.id, tileId);
    broadcast(newState);
  };

  const handleAbility = (type: "paint" | "stake" | "viewPart") => {
    let newState = localState;
    if (type === "paint") newState = activatePaint(localState, currentPlayer.id);
    if (type === "stake") newState = activateStake(localState, currentPlayer.id);
    if (type === "viewPart") newState = activateViewPart(localState);
    broadcast(newState);
  };

  return (
    <div className="flex flex-col items-center p-4 text-white bg-slate-900 min-h-screen">
      <h2 className="text-2xl font-bold mb-3">🧠 Memory Grid Challenge</h2>

      {!started && isHost && (
        <button
          onClick={startGame}
          className="bg-green-600 px-4 py-2 rounded hover:bg-green-700 mb-3"
        >
          Start Game
        </button>
      )}

      {!started && !isHost && (
        <p className="italic text-sm mb-3">Waiting for host to start…</p>
      )}

      <div className="flex gap-6">
        <div>
          <p className="text-sm mb-1">
            Current Turn:{" "}
            <span
              style={{
                color:
                  gamePlayers.find((p) => p.id === currentPlayerId)?.color ||
                  "#fff",
              }}
            >
              {gamePlayers.find((p) => p.id === currentPlayerId)?.name}
            </span>
          </p>

          <div
            className="grid gap-1 border border-slate-600 p-2 rounded"
            style={{
              gridTemplateColumns: `repeat(${grid.length}, 45px)`,
            }}
          >
            {grid.flat().map((tile) => (
              <div
                key={tile.id}
                onClick={() => handleClick(tile.id)}
                className="w-[45px] h-[45px] rounded cursor-pointer border border-slate-700"
                style={{
                  backgroundColor:
                    showColors || tile.revealed
                      ? tile.color || "#94a3b8"
                      : "#1e293b",
                }}
              />
            ))}
          </div>
        </div>

        {/* Abilities */}
        {started && (
          <div className="flex flex-col gap-3 ml-6">
            {me?.abilities.paint && (
              <button
                onClick={() => handleAbility("paint")}
                className="w-12 h-12 rounded-full bg-pink-600 hover:bg-pink-700 text-xl"
              >
                🎨
              </button>
            )}
            {me?.abilities.stake && (
              <button
                onClick={() => handleAbility("stake")}
                className="w-12 h-12 rounded-full bg-purple-600 hover:bg-purple-700 text-xl"
              >
                💎
              </button>
            )}
            {me?.abilities.viewPart && (
              <button
                onClick={() => handleAbility("viewPart")}
                className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-xl"
              >
                👁️
              </button>
            )}
          </div>
        )}
      </div>

      {/* Scoreboard */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {gamePlayers.map((p) => (
          <div
            key={p.id}
            className={`flex items-center rounded-lg p-2 ${
              p.id === currentPlayerId ? "bg-slate-700" : "bg-slate-800"
            }`}
          >
            <div
              className="w-5 h-5 rounded mr-2"
              style={{ backgroundColor: p.color }}
            ></div>
            <div>
              <p className="font-semibold text-sm">{p.name}</p>
              <p className="text-xs text-slate-400">{p.revealedCount} tiles</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MemoryGame;
