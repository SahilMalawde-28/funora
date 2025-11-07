// MemoryGame.tsx
import React, { useEffect, useState } from "react";
import {
  initMemoryGameState,
  handleTileTap,
  activatePaint,
  activateStake,
  activateViewPart,
  MemoryGameState,
} from "./gameLogic";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
    <div className="flex flex-col items-center gap-4 p-4">
      <h2 className="text-xl font-semibold">🎯 Memory Grid</h2>
      <p className="text-sm">
        Current Turn:{" "}
        <span className="font-bold" style={{ color: gamePlayers.find(p => p.id === currentPlayerId)?.color }}>
          {gamePlayers.find(p => p.id === currentPlayerId)?.name}
        </span>
      </p>

      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${grid.length}, 40px)`,
        }}
      >
        {grid.flat().map((tile) => (
          <div
            key={tile.id}
            onClick={() => handleClick(tile.id)}
            className={`w-10 h-10 border rounded cursor-pointer`}
            style={{
              backgroundColor: tile.revealed ? tile.color || "#f0f0f0" : "#1e293b",
            }}
          />
        ))}
      </div>

      {isMyTurn && (
        <div className="flex gap-2 mt-3">
          {me?.abilities.paint && (
            <Button onClick={() => handleAbility("paint")}>🎨 Paint</Button>
          )}
          {me?.abilities.stake && (
            <Button onClick={() => handleAbility("stake")}>💎 Stake</Button>
          )}
          {me?.abilities.viewPart && (
            <Button onClick={() => handleAbility("viewPart")}>👁️ View</Button>
          )}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        {gamePlayers.map((p) => (
          <Card
            key={p.id}
            className={`p-2 text-center ${p.id === currentPlayerId ? "border-2 border-yellow-400" : ""}`}
          >
            <p style={{ color: p.color }}>{p.name}</p>
            <p className="text-xs">{p.revealedCount} found</p>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MemoryGame;
