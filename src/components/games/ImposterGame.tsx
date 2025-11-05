import { useState, useEffect } from 'react';
import { Room, Player } from '../../lib/supabase';
import { ImposterGameState } from '../../lib/gameLogic';
import { Eye, Vote, Crown } from 'lucide-react';

interface ImposterGameProps {
  room: Room;
  players: Player[];
  currentPlayer: Player;
  gameState: ImposterGameState;
  onUpdateState: (newState: Partial<ImposterGameState>) => void;
  onEndGame: () => void;
}

export default function ImposterGame({
  room,
  players,
  currentPlayer,
  gameState,
  onUpdateState,
  onEndGame
}: ImposterGameProps) {
  const [selectedVote, setSelectedVote] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState(gameState.discussionTime);

  const myWord = gameState.assignments[currentPlayer.player_id] === 'imposter'
    ? gameState.imposterWord
    : gameState.word;

  const myRole = gameState.assignments[currentPlayer.player_id];
  const hasVoted = !!gameState.votes[currentPlayer.player_id];

  useEffect(() => {
    if (gameState.phase === 'discussion' && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (currentPlayer.player_id === room.host_id) {
              onUpdateState({ phase: 'voting' });
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [gameState.phase, timeLeft]);

  const handleVote = (playerId: string) => {
    if (hasVoted) return;

    const newVotes = { ...gameState.votes, [currentPlayer.player_id]: playerId };
    onUpdateState({ votes: newVotes });
    setSelectedVote(playerId);

    if (Object.keys(newVotes).length === players.length && currentPlayer.player_id === room.host_id) {
      onUpdateState({ phase: 'reveal' });
    }

  };

  const getVoteResults = () => {
    const voteCounts: { [key: string]: number } = {};
    Object.values(gameState.votes).forEach(votedId => {
      voteCounts[votedId] = (voteCounts[votedId] || 0) + 1;
    });
    return voteCounts;
  };

  const getWinner = () => {
    const voteCounts = getVoteResults();
    const mostVoted = Object.entries(voteCounts).sort((a, b) => b[1] - a[1])[0];
    if (!mostVoted) return null;

    const mostVotedId = mostVoted[0];
    const isImposter = gameState.assignments[mostVotedId] === 'imposter';

    return {
      playerId: mostVotedId,
      isImposter,
      votes: mostVoted[1],
      correctGuess: isImposter
    };
  };

  if (gameState.phase === 'discussion') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 p-4">
        <div className="max-w-4xl mx-auto space-y-6 py-8">
          <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-black text-gray-800">🕵️ Guess the Imposter</h1>
                <p className="text-gray-500">Discuss and find the imposters!</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600 font-semibold">Time Left</p>
                <p className="text-4xl font-black text-purple-600">{timeLeft}s</p>
              </div>
            </div>

            <div className={`text-center p-8 rounded-2xl ${
              myRole === 'imposter'
                ? 'bg-gradient-to-r from-red-100 to-orange-100 border-2 border-red-300'
                : 'bg-gradient-to-r from-green-100 to-emerald-100 border-2 border-green-300'
            }`}>
              <div className="flex items-center justify-center gap-3 mb-4">
                <Eye className={`w-8 h-8 ${myRole === 'imposter' ? 'text-red-600' : 'text-green-600'}`} />
                <h2 className="text-2xl font-black text-gray-800">Your Word</h2>
              </div>
              <p className="text-5xl font-black text-gray-900 mb-3">{myWord}</p>
              <p className={`text-sm font-bold ${myRole === 'imposter' ? 'text-red-700' : 'text-green-700'}`}>
                {myRole === 'imposter' ? '🎭 You are the IMPOSTER!' : '✅ You are NORMAL'}
              </p>
            </div>

            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-3">Discussion Tips</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p>• Describe your word WITHOUT saying it directly</p>
                <p>• Listen carefully to what others say</p>
                <p>• Look for suspicious behavior or vague answers</p>
                <p>• Imposters: blend in and survive!</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (gameState.phase === 'voting') {
  const allVoted = Object.keys(gameState.votes).length === players.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6 py-8">
        <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
          <div className="text-center">
            <Vote className="w-12 h-12 text-purple-600 mx-auto mb-3" />
            <h1 className="text-3xl font-black text-gray-800 mb-2">Vote Time!</h1>
            <p className="text-gray-600">Who do you think is the imposter?</p>
          </div>

          <div className="grid gap-3">
            {players.map((player) => {
              const voteCount = Object.values(gameState.votes).filter(v => v === player.player_id).length;
              const isSelected = selectedVote === player.player_id;

              return (
                <button
                  key={player.id}
                  onClick={() => handleVote(player.player_id)}
                  disabled={hasVoted}
                  className={`p-5 rounded-2xl border-2 transition-all text-left ${
                    isSelected
                      ? 'border-purple-500 bg-gradient-to-r from-purple-100 to-pink-100 scale-105'
                      : hasVoted
                      ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                      : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">{player.avatar}</span>
                    <div className="flex-1">
                      <p className="font-bold text-gray-800">{player.name}</p>
                      {voteCount > 0 && (
                        <p className="text-sm text-purple-600 font-semibold">
                          {voteCount} vote{voteCount > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    {isSelected && <Vote className="w-6 h-6 text-purple-600" />}
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-center text-sm text-gray-500">
            {Object.keys(gameState.votes).length} / {players.length} players voted
          </p>

          {allVoted && currentPlayer.player_id === room.host_id && (
            <div className="text-center mt-6">
              <button
                onClick={() => onUpdateState({ phase: 'reveal' })}
                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-xl font-bold text-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all"
              >
                Show Results
              </button>
              <p className="text-xs text-gray-500 mt-2">(Only host can reveal results)</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


  if (gameState.phase === 'reveal') {
    const winner = getWinner();
    const imposters = players.filter(p => gameState.assignments[p.player_id] === 'imposter');

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 p-4">
        <div className="max-w-4xl mx-auto space-y-6 py-8">
          <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
            <div className="text-center">
              <Crown className={`w-16 h-16 mx-auto mb-4 ${
                winner?.correctGuess ? 'text-green-500' : 'text-red-500'
              }`} />
              <h1 className="text-4xl font-black text-gray-800 mb-3">
                {winner?.correctGuess ? '🎉 Imposters Found!' : '😈 Imposters Win!'}
              </h1>
              <p className="text-gray-600 text-lg">
                {winner?.correctGuess
                  ? 'Great job! You caught the imposters!'
                  : 'The imposters fooled everyone!'}
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4">The Imposters Were...</h2>
              <div className="grid gap-3">
                {imposters.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-red-100 to-orange-100 border-2 border-red-300"
                  >
                    <span className="text-4xl">{player.avatar}</span>
                    <div className="flex-1">
                      <p className="font-bold text-gray-800">{player.name}</p>
                      <p className="text-sm text-red-700 font-semibold">
                        Word: {gameState.imposterWord}
                      </p>
                    </div>
                    <span className="text-2xl">🎭</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4">Voting Results</h2>
              {players.map((player) => {
                const votes = Object.values(gameState.votes).filter(v => v === player.player_id).length;
                return (
                  <div key={player.id} className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{player.avatar}</span>
                    <span className="font-semibold text-gray-800">{player.name}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-3 ml-3">
                      <div
                        className="bg-purple-500 h-3 rounded-full transition-all"
                        style={{ width: `${(votes / players.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-600">{votes}</span>
                  </div>
                );
              })}
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
