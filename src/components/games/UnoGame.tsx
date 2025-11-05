import { useState, useEffect } from "react";
import { Room, Player } from "../../lib/supabase";
import {
  UNOGameState,
  UNOCard,
  playCard,
  drawCards,
  canPlayCard,
  handleDrawStack,
} from "../../lib/gameLogic";
import { Shuffle, Trophy } from "lucide-react";

interface UNOGameProps {
  room: Room;
  players: Player[];
  currentPlayer: Player;
  gameState: UNOGameState;
  onUpdateState: (newState: Partial<UNOGameState>) => void;
  onEndGame: () => void;
}

export default function UNOGame({
  room,
  players,
  currentPlayer,
  gameState,
  onUpdateState,
  onEndGame,
}: UNOGameProps) {
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [drawTimer, setDrawTimer] = useState<number>(0);
  const [selectedCard, setSelectedCard] = useState<UNOCard | null>(null);
  const isHost = currentPlayer.player_id === room.host_id;

  const topCard = gameState.discardPile[gameState.discardPile.length - 1];
  const myHand = gameState.hands[currentPlayer.player_id] || [];
  const myTurn = gameState.currentPlayer === currentPlayer.player_id;

  // 🕒 Auto-skip if player draws but doesn't play in 5s
  useEffect(() => {
    if (drawTimer <= 0) return;
    const timer = setTimeout(() => {
      onUpdateState({ currentPlayer: getNextPlayer() });
      setDrawTimer(0);
    }, 5000);
    return () => clearTimeout(timer);
  }, [drawTimer]);

  const getNextPlayer = () => {
    const ids = Object.keys(gameState.hands);
    const idx = ids.indexOf(gameState.currentPlayer);
    return ids[(idx + gameState.direction + ids.length) % ids.length];
  };

  // 🎨 Card color styles
  const getCardStyle = (color: string) => {
    const base = "relative w-20 h-32 rounded-2xl shadow-lg transform hover:scale-105 transition-all";
    switch (color) {
      case "red":
        return `${base} bg-red-500 text-white`;
      case "blue":
        return `${base} bg-blue-500 text-white`;
      case "green":
        return `${base} bg-green-500 text-white`;
      case "yellow":
        return `${base} bg-yellow-400 text-white`;
      default:
        return `${base} bg-black text-white`;
    }
  };

  // 🎨 UNO-style oval
  const OvalBackground = () => (
    <div className="absolute inset-2 rounded-full border-4 border-white/30 bg-white/10 rotate-45"></div>
  );

  // 🃏 Handle card play
  const handlePlay = (card: UNOCard) => {
    if (!myTurn) return;
    if (!canPlayCard(card, topCard, gameState.chosenColor)) return;

    if (["wild", "+4"].includes(card.value)) {
      setSelectedCard(card);
      return; // wait for color pick
    }

    const updated = playCard(gameState, currentPlayer.player_id, card);
    onUpdateState(updated);
  };

  // 🃏 Choose color after wild/+4
  const chooseColor = (color: string) => {
    if (!selectedCard) return;
    const updated = playCard(
      gameState,
      currentPlayer.player_id,
      selectedCard,
      color as any
    );
    setSelectedCard(null);
    setSelectedColor(null);
    onUpdateState(updated);
  };

  // 🧩 Draw card manually
  const handleDraw = () => {
    if (!myTurn) return;
    const updated = drawCards(gameState, currentPlayer.player_id, 1);
    setDrawTimer(1); // start skip timer
    onUpdateState(updated);
  };

  // ⚡ Handle draw stack (+2/+4)
  useEffect(() => {
    if (myTurn && gameState.drawStack > 0) {
      const hasDefense = myHand.some((c) =>
        ["+2", "+4"].includes(c.value)
      );
      if (!hasDefense) {
        const newState = handleDrawStack(gameState);
        onUpdateState(newState);
      }
    }
  }, [myTurn]);

  if (gameState.winner) {
    const winnerName =
      players.find((p) => p.player_id === gameState.winner)?.name || "Someone";
    return (
      <div className="h-screen flex flex-col justify-center items-center bg-gradient-to-br from-yellow-50 to-orange-100">
        <Trophy className="w-20 h-20 text-yellow-500 mb-4" />
        <h1 className="text-5xl font-black text-gray-800 mb-2">
          🎉 {winnerName} Wins!
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          They’ve run out of cards first!
        </p>
        <button
          onClick={onEndGame}
          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-bold shadow-lg hover:scale-105 transition-all"
        >
          Back to Lobby
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-yellow-50 to-red-50 flex flex-col items-center py-6">
      {/* TOP CARD */}
      <div className="mb-4 text-center">
        <h1 className="text-3xl font-black mb-2">🎴 UNO - No Mercy</h1>
        <p className="font-semibold text-gray-700">
          Current Turn:{" "}
          <span className="text-blue-600">
            {
              players.find((p) => p.player_id === gameState.currentPlayer)?.name
            }
          </span>
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Direction: {gameState.direction === 1 ? "➡️ Clockwise" : "⬅️ Reverse"}
        </p>
      </div>

      {/* DISCARD & DRAW PILES */}
      <div className="flex items-center justify-center gap-10 mt-8">
        <div
          onClick={handleDraw}
          className="cursor-pointer relative w-20 h-32 bg-gray-300 rounded-2xl border-2 border-gray-500 shadow-md flex items-center justify-center text-gray-700 font-bold text-xl hover:scale-105 transition-all"
        >
          <Shuffle className="w-8 h-8 opacity-70" />
          <span className="absolute bottom-2 text-xs">DRAW</span>
        </div>
        <div className={getCardStyle(topCard.color)}>
          <OvalBackground />
          <div className="absolute inset-0 flex flex-col items-center justify-center font-black text-5xl drop-shadow-lg">
            {renderCardValue(topCard.value)}
          </div>
        </div>
      </div>

      {/* PLAYER HAND */}
      <div className="mt-10 flex flex-wrap justify-center gap-3 max-w-3xl">
        {myHand.map((card) => (
          <div
            key={card.id}
            onClick={() => handlePlay(card)}
            className={`${getCardStyle(card.color)} cursor-pointer`}
          >
            <OvalBackground />
            <div className="absolute inset-0 flex items-center justify-center font-black text-5xl drop-shadow-lg">
              {renderCardValue(card.value)}
            </div>
          </div>
        ))}
      </div>

      {/* WILD COLOR SELECTOR */}
      {selectedCard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 text-center shadow-2xl space-y-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Choose a color 🎨
            </h2>
            <div className="flex justify-center gap-4">
              {["red", "blue", "green", "yellow"].map((c) => (
                <button
                  key={c}
                  onClick={() => chooseColor(c)}
                  className={`${getCardStyle(c)} w-16 h-24`}
                ></button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 🎨 Render card value text/emojis
function renderCardValue(value: string) {
  switch (value) {
    case "skip":
      return "🚫";
    case "reverse":
      return "🔁";
    case "+2":
      return "+2️⃣";
    case "+4":
      return "+4️⃣";
    default:
      return value.toUpperCase();
  }
}
