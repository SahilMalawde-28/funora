import { useState, useEffect } from 'react';
import { Room, Player } from '../../lib/supabase';
import { WordGuessGameState, generateWordHint, isGuessCorrect } from '../../lib/gameLogic';
import { Lightbulb, Trophy, Crown } from 'lucide-react';

interface WordGuessGameProps {
  room: Room;
  players: Player[];
  currentPlayer: Player;
  gameState: WordGuessGameState;
  onUpdateState: (newState: Partial<WordGuessGameState>) => void;
  onEndGame: () => void;
}

export default function WordGuessGame({
  room,
  players,
  currentPlayer,
  gameState,
  onUpdateState,
  onEndGame
}: WordGuessGameProps) {
  const [guess, setGuess] = useState('');
  const [timeLeft, setTimeLeft] = useState(15);
  const [roundOver, setRoundOver] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);

  const isHost = currentPlayer.player_id === room.host_id;

  // derive whether this player already used their guess for the current hint
  const myGuesses = (gameState.guesses[currentPlayer.player_id] || []) as string[];
  // Player may only guess if at least one hint has been revealed (hintsUsed > 0)
  // and they have made fewer guesses than hintsUsed (one guess per revealed hint).
  const hasGuessedThisHint = gameState.hintsUsed > 0 && myGuesses.length >= gameState.hintsUsed;

  // ⏲️ Timer countdown — resets when phase/hintsUsed change (host-controlled hints)
  useEffect(() => {
    if (gameState.phase !== 'guessing' || roundOver) return;

    setTimeLeft(15); // ensure started at 15 each time effect runs

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setRoundOver(true);
          // mark roundOver in shared state so host/others know (optional)
          onUpdateState({ roundOver: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
    // include hintsUsed so timer resets when host reveals next hint
  }, [gameState.phase, gameState.hintsUsed, roundOver]);

  // 🔁 Reset local roundOver/winner when new guessing phase or new hint starts
  useEffect(() => {
    if (gameState.phase === 'guessing') {
      setRoundOver(false);
      setWinner(null);
      setTimeLeft(15);
    }
  }, [gameState.phase, gameState.hintsUsed]);

  // 💡 Host reveals next hint (in order, not shuffled)
  const handleNextHint = () => {
    if (gameState.hintsUsed >= gameState.maxHints || gameState.phase !== 'guessing') return;

    const nextHint = generateWordHint(gameState.targetWord, gameState.hintsUsed);
    // update in one call so other clients see hintsUsed and hints simultaneously
    onUpdateState({
      hints: [...gameState.hints, nextHint],
      hintsUsed: gameState.hintsUsed + 1,
      roundOver: false
    });

    // locally reset timer/roundOver — other clients will also reset via effect because hintsUsed changed
    setTimeLeft(15);
    setRoundOver(false);
  };

  // 🎯 One guess per revealed hint, only when timer active and a hint exists
  const handleGuess = (word: string) => {
    if (!word.trim()) return;
    if (gameState.phase !== 'guessing') return;
    if (roundOver) return;
    if (gameState.hintsUsed === 0) return; // no hint revealed yet — require at least one hint
    if (hasGuessedThisHint) return; // already used guess for this hint

    const normalized = word.trim();
    const newGuesses = { ...gameState.guesses };
    newGuesses[currentPlayer.player_id] = [
      ...(newGuesses[currentPlayer.player_id] || []),
      normalized
    ];

    // Check correctness (either full name or surname allowed via helper)
    if (isGuessCorrect(gameState.targetWord, normalized)) {
      const winningPlayer = players.find(p => p.player_id === currentPlayer.player_id) || null;
      setWinner(winningPlayer);
      setRoundOver(true);

      // Broadcast winner globally and move to reveal
      onUpdateState({
        guesses: newGuesses,
        phase: 'reveal',
        winner: winningPlayer ? winningPlayer.name : null,
        roundOver: true
      });
    } else {
      // Save guess and keep phase
      onUpdateState({ guesses: newGuesses });
    }

    setGuess('');
  };

  // 🧩 Guessing UI (unchanged look — behavior adjusted)
  if (gameState.phase === 'guessing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
        <div className="max-w-4xl mx-auto py-8 space-y-6">
          <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
            <div className="text-center">
              <Lightbulb className="w-12 h-12 text-blue-600 mx-auto mb-3 animate-pulse" />
              <h1 className="text-3xl font-black text-gray-800 mb-2">🔤 Word Guess</h1>
              <p className="text-gray-600">All players can guess once per revealed hint. Host reveals next hints.</p>
            </div>

            {/* TIMER */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-100 to-purple-100 border-2 border-blue-300 text-center">
              <p className="text-gray-700 font-bold">⏱ Time Left</p>
              <p className="text-5xl font-black text-blue-600">{timeLeft}s</p>
            </div>

            {/* HINTS */}
            {gameState.hints.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Hints So Far</h3>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {gameState.hints.map((hint, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-sm text-yellow-800"
                    >
                      <span className="font-bold">Hint {idx + 1}:</span> {hint}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* HOST BUTTON */}
            {isHost && (
              <div className="flex justify-center">
                <button
                  onClick={handleNextHint}
                  disabled={gameState.hintsUsed >= gameState.maxHints}
                  className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl shadow-md transition-all disabled:bg-gray-300"
                >
                  Next Hint ({gameState.hintsUsed}/{gameState.maxHints})
                </button>
              </div>
            )}

            {/* PLAYER INPUT */}
            <div className="flex gap-3 mt-6">
              <input
                type="text"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder={
                  gameState.hintsUsed === 0
                    ? "Waiting for first hint..."
                    : roundOver
                    ? "⏰ Time’s up!"
                    : hasGuessedThisHint
                    ? "✅ You already guessed this hint!"
                    : "Type your guess..."
                }
                disabled={roundOver || hasGuessedThisHint || gameState.hintsUsed === 0}
                className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 outline-none transition-colors text-lg font-bold disabled:bg-gray-100"
                onKeyPress={(e) => e.key === 'Enter' && handleGuess(guess)}
              />
              <button
                onClick={() => handleGuess(guess)}
                disabled={!guess.trim() || roundOver || hasGuessedThisHint || gameState.hintsUsed === 0}
                className="px-6 bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50"
              >
                Guess
              </button>
            </div>

            {/* PLAYER GUESSES */}
            <div>
              <p className="text-sm text-gray-600 font-semibold mb-2">Your Guesses</p>
              <div className="flex flex-wrap gap-2">
                {myGuesses.map((g, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-1 bg-red-100 text-red-700 rounded-full font-bold text-sm"
                  >
                    ✗ {g}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 🏁 Reveal Phase (unchanged)
  if (gameState.phase === 'reveal') {
    const winnerName = gameState.winner || winner?.name || null;
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 flex flex-col items-center justify-center">
        <div className="bg-white rounded-3xl shadow-xl p-10 max-w-lg text-center space-y-4">
          <Trophy className={`w-16 h-16 mx-auto mb-3 ${winnerName ? 'text-yellow-500' : 'text-gray-400'}`} />
          <h1 className="text-4xl font-black text-gray-800 mb-2">
            {winnerName ? '🎉 We Have a Winner!' : '😅 No One Guessed It!'}
          </h1>
          <p className="text-xl font-semibold text-gray-700">
            The word was: <span className="text-blue-600">{gameState.targetWord}</span>
          </p>
          {winnerName && (
            <p className="text-lg font-bold text-green-600 flex items-center justify-center gap-2">
              <Crown className="w-5 h-5" /> {winnerName}
            </p>
          )}

          <div className="mt-6">
            <button
              onClick={onEndGame}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
            >
              Back to Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
