import { useState } from 'react';
import { Room, Player } from '../../lib/supabase';
import { WavelengthGameState } from '../../lib/gameLogic';
import { TrendingUp, Target, Award } from 'lucide-react';

interface WavelengthGameProps {
  room: Room;
  players: Player[];
  currentPlayer: Player;
  gameState: WavelengthGameState;
  onUpdateState: (newState: Partial<WavelengthGameState>) => void;
  onEndGame: () => void;
}

export default function WavelengthGame({
  room,
  players,
  currentPlayer,
  gameState,
  onUpdateState,
  onEndGame
}: WavelengthGameProps) {
  const [clueInput, setClueInput] = useState('');
  const [guessValue, setGuessValue] = useState(50);

  const isClueGiver = gameState.clueGiver === currentPlayer.player_id;
  const hasGuessed = !!gameState.guesses[currentPlayer.player_id];
  const clueGiverPlayer = players.find(p => p.player_id === gameState.clueGiver);

  const handleSubmitClue = () => {
    if (!clueInput.trim()) return;

    onUpdateState({
      clue: clueInput,
      phase: 'guessing'
    });
  };

  const handleGuess = (value: number) => {
    if (hasGuessed || isClueGiver) return;

    const newGuesses = { ...gameState.guesses, [currentPlayer.player_id]: value };
    onUpdateState({ guesses: newGuesses });

    if (Object.keys(newGuesses).length === players.length - 1) {
      setTimeout(() => {
        if (currentPlayer.player_id === room.host_id) {
          onUpdateState({ phase: 'reveal' });
        }
      }, 1000);
    }
  };

  const calculateScore = (guess: number, target: number) => {
    const distance = Math.abs(guess - target);
    if (distance <= 5) return 4;
    if (distance <= 10) return 3;
    if (distance <= 20) return 2;
    if (distance <= 35) return 1;
    return 0;
  };

  if (gameState.phase === 'clue') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-4">
        <div className="max-w-4xl mx-auto space-y-6 py-8">
          <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
            <div className="text-center">
              <TrendingUp className="w-12 h-12 text-indigo-600 mx-auto mb-3" />
              <h1 className="text-3xl font-black text-gray-800 mb-2">📊 Wavelength</h1>
              <p className="text-gray-600">Guess where on the spectrum the target is!</p>
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-100 to-blue-100 border-2 border-indigo-300">
              <div className="flex items-center justify-between mb-4">
                <div className="text-center flex-1">
                  <p className="text-2xl font-bold text-gray-800">{gameState.spectrum.left}</p>
                  <p className="text-xs text-gray-600 mt-1">0</p>
                </div>
                <div className="px-4">
                  <div className="w-16 h-1 bg-gradient-to-r from-indigo-400 to-blue-400 rounded-full"></div>
                </div>
                <div className="text-center flex-1">
                  <p className="text-2xl font-bold text-gray-800">{gameState.spectrum.right}</p>
                  <p className="text-xs text-gray-600 mt-1">100</p>
                </div>
              </div>
            </div>

            {isClueGiver ? (
              <div className="space-y-4">
                <div className="p-6 rounded-2xl bg-gradient-to-r from-yellow-100 to-orange-100 border-2 border-yellow-300">
                  <p className="text-sm font-bold text-yellow-800 mb-2">🎯 SECRET TARGET</p>
                  <div className="flex items-center justify-center gap-3">
                    <Target className="w-8 h-8 text-yellow-700" />
                    <p className="text-4xl font-black text-gray-900">{gameState.target}</p>
                  </div>
                  <p className="text-sm text-gray-700 mt-3 text-center">
                    Give a clue that hints at this position on the spectrum!
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Your Clue</label>
                  <input
                    type="text"
                    value={clueInput}
                    onChange={(e) => setClueInput(e.target.value)}
                    placeholder="Give a hint..."
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none transition-colors text-lg"
                    maxLength={50}
                  />
                </div>

                <button
                  onClick={handleSubmitClue}
                  disabled={!clueInput.trim()}
                  className="w-full bg-gradient-to-r from-indigo-500 to-blue-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  Submit Clue
                </button>
              </div>
            ) : (
              <div className="text-center p-8">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <span className="text-3xl">{clueGiverPlayer?.avatar}</span>
                  <p className="text-lg text-gray-600">
                    <span className="font-bold text-gray-800">{clueGiverPlayer?.name}</span> is giving a clue...
                  </p>
                </div>
                <div className="animate-pulse flex justify-center gap-2">
                  <div className="w-3 h-3 bg-indigo-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-indigo-400 rounded-full animation-delay-200"></div>
                  <div className="w-3 h-3 bg-indigo-400 rounded-full animation-delay-400"></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (gameState.phase === 'guessing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-4">
        <div className="max-w-4xl mx-auto space-y-6 py-8">
          <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
            <div className="text-center">
              <TrendingUp className="w-12 h-12 text-indigo-600 mx-auto mb-3" />
              <h1 className="text-3xl font-black text-gray-800 mb-2">Make Your Guess!</h1>
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-100 to-blue-100 border-2 border-indigo-300">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xl font-bold text-gray-800">{gameState.spectrum.left}</p>
                <p className="text-xl font-bold text-gray-800">{gameState.spectrum.right}</p>
              </div>
              <div className="text-center mb-4">
                <p className="text-sm text-gray-600 font-semibold mb-2">CLUE</p>
                <p className="text-3xl font-black text-gray-900">{gameState.clue}</p>
                <p className="text-sm text-gray-600 mt-2">
                  by <span className="font-bold">{clueGiverPlayer?.name}</span>
                </p>
              </div>
            </div>

            {!isClueGiver && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-bold text-gray-700">Your Guess</label>
                    <span className="text-2xl font-black text-indigo-600">{guessValue}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={guessValue}
                    onChange={(e) => setGuessValue(Number(e.target.value))}
                    disabled={hasGuessed}
                    className="w-full h-3 bg-gradient-to-r from-indigo-200 to-blue-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0</span>
                    <span>25</span>
                    <span>50</span>
                    <span>75</span>
                    <span>100</span>
                  </div>
                </div>

                <button
                  onClick={() => handleGuess(guessValue)}
                  disabled={hasGuessed}
                  className="w-full bg-gradient-to-r from-indigo-500 to-blue-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {hasGuessed ? '✓ Guess Submitted' : 'Lock In Guess'}
                </button>
              </div>
            )}

            {isClueGiver && (
              <div className="text-center p-6 bg-yellow-50 rounded-2xl">
                <p className="text-gray-600">
                  You're the clue giver! Wait for others to guess...
                </p>
              </div>
            )}

            <p className="text-center text-sm text-gray-500">
              {Object.keys(gameState.guesses).length} / {players.length - 1} players guessed
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (gameState.phase === 'reveal') {
    const guessesArray = Object.entries(gameState.guesses).map(([playerId, guess]) => ({
      player: players.find(p => p.player_id === playerId)!,
      guess,
      score: calculateScore(guess, gameState.target)
    })).sort((a, b) => b.score - a.score);

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-4">
        <div className="max-w-4xl mx-auto space-y-6 py-8">
          <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
            <div className="text-center">
              <Award className="w-16 h-16 text-yellow-500 mx-auto mb-3" />
              <h1 className="text-4xl font-black text-gray-800 mb-2">🎯 Results!</h1>
            </div>

            <div className="relative p-6 rounded-2xl bg-gradient-to-r from-indigo-100 to-blue-100 border-2 border-indigo-300">
              <div className="flex items-center justify-between mb-4">
                <p className="text-lg font-bold text-gray-800">{gameState.spectrum.left}</p>
                <p className="text-lg font-bold text-gray-800">{gameState.spectrum.right}</p>
              </div>

              <div className="relative h-12 bg-gradient-to-r from-indigo-200 via-purple-200 to-blue-200 rounded-lg mb-4">
                <div
                  className="absolute top-0 h-full w-1 bg-yellow-500 shadow-lg"
                  style={{ left: `${gameState.target}%` }}
                >
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
                    <Target className="w-6 h-6 text-yellow-500" />
                  </div>
                  <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs font-bold text-yellow-700">
                    {gameState.target}
                  </div>
                </div>
              </div>

              <p className="text-center text-sm text-gray-600 mt-8">
                Clue: <span className="font-bold text-gray-800">{gameState.clue}</span>
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4">Scoreboard</h2>
              <div className="space-y-3">
                {guessesArray.map((item, idx) => {
                  const distance = Math.abs(item.guess - gameState.target);
                  return (
                    <div
                      key={item.player.id}
                      className={`p-5 rounded-2xl border-2 ${
                        idx === 0
                          ? 'bg-gradient-to-r from-yellow-100 to-orange-100 border-yellow-400'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {idx === 0 && <Award className="w-6 h-6 text-yellow-500" />}
                        <span className="text-3xl">{item.player.avatar}</span>
                        <div className="flex-1">
                          <p className="font-bold text-gray-800">{item.player.name}</p>
                          <p className="text-sm text-gray-600">
                            Guessed: {item.guess} (off by {distance})
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-3xl font-black text-indigo-600">{item.score}</p>
                          <p className="text-xs text-gray-500">points</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={onEndGame}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
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
