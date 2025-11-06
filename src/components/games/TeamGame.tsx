import { useState, useEffect } from 'react';
import { Room, Player } from '../../lib/supabase';
import { TeamGameState } from '../../lib/gameLogic';
import { Users, Trophy, Sparkles } from 'lucide-react';

interface TeamGameProps {
  room: Room;
  players: Player[];
  currentPlayer: Player;
  gameState: TeamGameState;
  onUpdateState: (newState: Partial<TeamGameState>) => void;
  onEndGame: () => void;
}

export default function TeamGame({
  room,
  players,
  currentPlayer,
  gameState,
  onUpdateState,
  onEndGame
}: TeamGameProps) {
  const [selectedOption, setSelectedOption] = useState<string>('');
  const teamSize = 11; // Max players per team
  const isHost = room.host_id === currentPlayer.player_id;

  // Randomize order only at game start
  useEffect(() => {
    if (!gameState.draftOrder || gameState.draftOrder.length === 0) {
      const randomizedOrder = [...players].sort(() => Math.random() - 0.5);
      onUpdateState({ draftOrder: randomizedOrder.map(p => p.player_id), currentPicker: 0 });
    }
  }, [players, gameState.draftOrder, onUpdateState]);

  const currentPickerPlayerId = gameState.draftOrder?.[gameState.currentPicker];
  const currentPickerPlayer = players.find(p => p.player_id === currentPickerPlayerId);
  const isMyTurn = currentPickerPlayer?.player_id === currentPlayer.player_id;
  const myTeam = gameState.teams[currentPlayer.player_id] || [];

  const handlePick = (option: string) => {
    if (!isMyTurn || !option) return;
    const myTeam = gameState.teams[currentPlayer.player_id] || [];
    if (myTeam.length >= teamSize) return; // Stop if team full

    const newTeams = { ...gameState.teams };
    newTeams[currentPlayer.player_id] = [...myTeam, option];

    const newAvailable = gameState.availableOptions.filter(o => o !== option);
    let nextPicker = (gameState.currentPicker + 1) % players.length;
    let draftOrder = [...(gameState.draftOrder || players.map(p => p.player_id))];
    let round = gameState.round || 1;

    // When all players have picked once => next round
    if (nextPicker === 0) {
      round += 1;
      // Rotate draft order for round robin (e.g. 1-2-3 -> 2-3-1)
      draftOrder = [...draftOrder.slice(1), draftOrder[0]];
    }

    const everyoneFull = players.every(
      p => (newTeams[p.player_id]?.length || 0) >= teamSize
    );

    const updates: Partial<TeamGameState> = {
      teams: newTeams,
      availableOptions: newAvailable,
      currentPicker: nextPicker,
      draftOrder,
      round,
    };

    if (everyoneFull || newAvailable.length === 0) {
      updates.phase = 'reveal';
    }

    onUpdateState(updates);
    setSelectedOption('');
  };

  const handleHostProceed = () => {
    if (!isHost) return;
    onUpdateState({ phase: 'reveal' });
  };

  if (gameState.phase === 'drafting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 p-4">
        <div className="max-w-4xl mx-auto space-y-6 py-8">
          <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
            <div className="text-center">
              <Users className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <h1 className="text-3xl font-black text-gray-800 mb-2">⚔️ Make Your Team</h1>
              <p className="text-gray-600">{gameState.category}</p>
            </div>

            <div className={`p-6 rounded-2xl ${
              isMyTurn
                ? 'bg-gradient-to-r from-green-100 to-emerald-100 border-2 border-green-400'
                : 'bg-gray-50 border-2 border-gray-200'
            }`}>
              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl">{currentPickerPlayer?.avatar}</span>
                <div className="text-center">
                  <p className="text-sm text-gray-600 font-semibold">Current Picker</p>
                  <p className="text-xl font-black text-gray-800">{currentPickerPlayer?.name}</p>
                </div>
              </div>
              {isMyTurn && (
                <p className="text-center text-green-700 font-bold mt-3">🎯 Your turn to pick!</p>
              )}
            </div>

            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-3">Available Options</h2>
              <div className="grid grid-cols-2 gap-3">
                {gameState.availableOptions.map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      setSelectedOption(option);
                      handlePick(option);
                    }}
                    disabled={!isMyTurn}
                    className={`p-4 rounded-xl border-2 transition-all font-semibold ${
                      isMyTurn
                        ? 'border-green-200 bg-white hover:border-green-500 hover:bg-green-50 hover:scale-105'
                        : 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-3">Your Team</h2>
              {myTeam.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {myTeam.map((member, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-gradient-to-r from-green-100 to-emerald-100 text-center font-semibold text-gray-800"
                    >
                      {member}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-4">No picks yet</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-xl p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-3">All Teams</h2>
            <div className="space-y-3">
              {players.map((player) => {
                const team = gameState.teams[player.player_id] || [];
                return (
                  <div key={player.id} className="flex items-center gap-3">
                    <span className="text-2xl">{player.avatar}</span>
                    <div className="flex-1">
                      <p className="font-bold text-gray-800 text-sm">{player.name}</p>
                      <p className="text-xs text-gray-600">{team.length}/{teamSize} picks</p>
                    </div>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${(team.length / teamSize) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {isHost && (
            <div className="text-center">
              <button
                onClick={handleHostProceed}
                className="mt-6 bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-6 py-3 rounded-xl font-bold text-lg shadow-md hover:scale-105 transition-all"
              >
                🏁 End Draft & Reveal Teams
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (gameState.phase === 'reveal') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 p-4">
        <div className="max-w-4xl mx-auto space-y-6 py-8">
          <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
            <div className="text-center">
              <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-3" />
              <h1 className="text-4xl font-black text-gray-800 mb-2">🎉 Teams Complete!</h1>
              <p className="text-gray-600">{gameState.category}</p>
            </div>

            <div className="space-y-4">
              {players.map((player, idx) => {
                const team = gameState.teams[player.player_id] || [];
                return (
                  <div
                    key={player.id}
                    className="p-6 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      {idx === 0 && <Trophy className="w-6 h-6 text-yellow-500" />}
                      <span className="text-3xl">{player.avatar}</span>
                      <div>
                        <p className="text-xl font-black text-gray-800">{player.name}'s Team</p>
                        <p className="text-sm text-gray-600">{team.length} members</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {team.map((member, mIdx) => (
                        <div
                          key={mIdx}
                          className="p-3 rounded-lg bg-white text-center font-semibold text-gray-800 border border-green-200"
                        >
                          <Sparkles className="w-4 h-4 inline mr-1 text-green-600" />
                          {member}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-center p-6 bg-gradient-to-r from-yellow-100 to-orange-100 rounded-2xl">
              <p className="text-lg font-bold text-gray-800 mb-2">🏆 All teams look amazing!</p>
              <p className="text-sm text-gray-600">Everyone's a winner in this draft!</p>
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
