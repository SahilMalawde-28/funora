import { useState, useEffect } from 'react';
import { Room, Player } from '../../lib/supabase';
import { ChainGameState } from '../../lib/gameLogic';
import { Zap, Trophy, X } from 'lucide-react';

interface ChainGameProps {
  room: Room;
  players: Player[];
  currentPlayer: Player;
  gameState: ChainGameState;
  onUpdateState: (newState: Partial<ChainGameState>) => void;
  onEndGame: () => void;
}

export default function ChainGame({
  room,
  players,
  currentPlayer,
  gameState,
  onUpdateState,
  onEndGame,
}: ChainGameProps) {
  const [answer, setAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(gameState.timePerAnswer);

  const currentPlayerId = gameState.activePlayers[gameState.currentPlayerIdx];
  const isMyTurn = currentPlayerId === currentPlayer.player_id;
  const currentPlayerData = players.find(p => p.player_id === currentPlayerId);

  // ✅ Global chain from state
  const chain = Object.entries(gameState.answers || {}).map(([pid, ans]) => ({
    player: pid,
    answer: ans,
  }));

  // 🕓 TIMER logic
  useEffect(() => {
    if (gameState.phase !== 'answering' || !isMyTurn) return;

    setTimeLeft(gameState.timePerAnswer);

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onTimeoutEliminate();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState.phase, isMyTurn, gameState.currentPlayerIdx]);

  // 💀 Timeout elimination
  const onTimeoutEliminate = () => {
    const newActive = gameState.activePlayers.filter(id => id !== currentPlayerId);

    // if only one left -> reveal winner
    if (newActive.length <= 1) {
      onUpdateState({
        activePlayers: newActive,
        phase: 'reveal',
      });
      return;
    }

    // Move to next player safely
    const nextIdx = gameState.currentPlayerIdx % newActive.length;
    onUpdateState({
      activePlayers: newActive,
      currentPlayerIdx: nextIdx,
    });
  };

  // 📝 Handle answer submit
  const handleSubmitAnswer = () => {
    if (!answer.trim()) return;

    const newAnswers = { ...gameState.answers, [currentPlayerId]: answer.trim() };

    const nextIdx = (gameState.currentPlayerIdx + 1) % gameState.activePlayers.length;
    const nextPhase =
      nextIdx === 0 ? 'answering' : 'answering'; // continuous game, not reveal yet

    // eliminate none, continue
    onUpdateState({
      answers: newAnswers,
      currentPlayerIdx: nextIdx,
      phase: nextPhase,
    });

    setAnswer('');
    setTimeLeft(gameState.timePerAnswer);
  };

  // ❌ Host remove player manually
  const removePlayer = (playerId: string) => {
    if (currentPlayer.player_id !== room.host_id) return;
    const newActive = gameState.activePlayers.filter(id => id !== playerId);

    if (newActive.length <= 1) {
      onUpdateState({ activePlayers: newActive, phase: 'reveal' });
      return;
    }

    const newIdx = gameState.currentPlayerIdx % newActive.length;
    onUpdateState({ activePlayers: newActive, currentPlayerIdx: newIdx });
  };

  // === ANSWERING PHASE ===
  if (gameState.phase === 'answering') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-pink-50 p-6">
        <div className="max-w-4xl mx-auto space-y-6 py-8">
          <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
            <div className="text-center">
              <Zap className="w-12 h-12 text-red-600 mx-auto mb-3" />
              <h1 className="text-3xl font-black text-gray-800 mb-2">⚡ Chain Rapid Fire</h1>
              <p className="text-gray-600">
                Topic:{' '}
                <span className="font-bold text-lg text-red-600">{gameState.topic}</span>
              </p>
            </div>

            {isMyTurn ? (
              <>
                <div className="p-6 rounded-2xl bg-gradient-to-r from-red-100 to-pink-100 border-2 border-red-300 animate-pulse">
                  <p className="text-center text-sm text-red-700 font-bold mb-2">
                    🎯 YOUR TURN NOW!
                  </p>
                  <div className="flex items-center justify-center gap-4">
                    <p className="text-3xl font-black text-gray-900">Name a</p>
                    <p className="text-4xl font-black text-red-600">{gameState.topic}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-4">
                  <div className="text-2xl font-black text-red-600">{timeLeft}s</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-red-500 to-pink-500 h-4 transition-all duration-1000 ease-linear"
                      style={{
                        width: `${(timeLeft / gameState.timePerAnswer) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  <input
                    type="text"
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    placeholder="Type quickly..."
                    className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-red-500 outline-none transition-colors text-lg font-bold"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleSubmitAnswer()}
                  />
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={!answer.trim()}
                    className="px-6 bg-gradient-to-r from-red-500 to-pink-500 text-white py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Submit
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center p-8 bg-gray-50 rounded-2xl">
                <div className="flex items-center justify-center gap-3 mb-6">
                  <span className="text-4xl">{currentPlayerData?.avatar}</span>
                  <div>
                    <p className="text-lg font-bold text-gray-800">
                      {currentPlayerData?.name}
                    </p>
                    <p className="text-sm text-gray-600">is answering...</p>
                  </div>
                </div>

                <div className="text-2xl font-black text-red-600 mb-6 animate-pulse">
                  {timeLeft}s
                </div>

                {chain.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-600 font-semibold mb-2">
                      Chain So Far:
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {chain.map((item, idx) => {
                        const player = players.find(p => p.player_id === item.player);
                        return (
                          <div key={idx} className="flex items-center gap-1">
                            <span className="text-xl">{player?.avatar}</span>
                            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full font-bold text-sm">
                              {item.answer}
                            </span>
                            {idx < chain.length - 1 && (
                              <span className="text-red-600 font-bold">→</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-3">
                Active Players ({gameState.activePlayers.length})
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {gameState.activePlayers.map(pid => {
                  const player = players.find(p => p.player_id === pid);
                  const isActive = pid === currentPlayerId;
                  return (
                    <div
                      key={pid}
                      className={`p-3 rounded-xl border-2 flex items-center justify-between ${
                        isActive
                          ? 'bg-gradient-to-r from-red-100 to-pink-100 border-red-300'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{player?.avatar}</span>
                        <p className="font-bold text-gray-800 text-sm">{player?.name}</p>
                      </div>
                      {currentPlayer.player_id === room.host_id && !isActive && (
                        <button
                          onClick={() => removePlayer(pid)}
                          className="p-1 hover:bg-red-200 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4 text-red-600" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // === REVEAL PHASE ===
  if (gameState.phase === 'reveal') {
    const winnerId =
      gameState.activePlayers.length > 0 ? gameState.activePlayers[0] : null;
    const winner = players.find(p => p.player_id === winnerId);

    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-red-50 via-white to-pink-50 p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-3xl text-center">
          <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-4xl font-black text-gray-800 mb-6">🎉 Game Over!</h1>
          {winner ? (
            <div className="p-6 rounded-2xl bg-gradient-to-r from-yellow-100 to-orange-100">
              <p className="text-sm text-yellow-700 font-bold mb-2">FINAL SURVIVOR</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-5xl">{winner.avatar}</span>
                <p className="text-3xl font-black text-gray-900">{winner.name}</p>
              </div>
            </div>
          ) : (
            <p>No one survived 😅</p>
          )}
          <div className="mt-8">
            <button
              onClick={onEndGame}
              className="px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-bold text-lg shadow-lg hover:scale-105 transition-all"
            >
              Back to Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <div className="text-center text-gray-600 py-20">Loading game...</div>;
}
