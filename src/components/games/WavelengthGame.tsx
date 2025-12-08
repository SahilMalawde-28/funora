import { useState, useMemo } from "react";
import { Room, Player } from "../../lib/supabase";
import { WavelengthGameState } from "../../lib/gameLogic";
import { TrendingUp, Target, Award, Users, Trophy, Zap } from "lucide-react";

const spectrums = [
    // 🔥 Temperature / Intensity
    { left: '❄️ Freezing Cold', right: '🔥 Burning Hot' },
    { left: '🌧️ Mild', right: '🌪️ Extreme' },

    // 😂 Humor / Fun
    { left: '😐 Boring', right: '🤣 Hilarious' },
    { left: '🥱 Dry Joke', right: '😂 Killer Joke' },

    // 😇 Morality
    { left: '😇 Innocent', right: '😈 Evil' },
    { left: '🧘‍♂️ Peaceful', right: '💥 Chaotic' },

    // 🐌 Speed / Energy
    { left: '🐌 Slow', right: '⚡ Fast' },
    { left: '😴 Low Energy', right: '🚀 Hyperactive' },

    // 🤓 Vibe
    { left: '🤓 Nerdy', right: '😎 Cool' },
    { left: '🫥 Forgettable', right: '🌟 Iconic' },

    // 💼 Risk / Danger
    { left: '🪵 Safe', right: '🧨 Risky' },
    { left: '🕊️ Peace', right: '⚔️ War' },

    // 💰 Value / Quality
    { left: '🪙 Cheap', right: '💎 Premium' },
    { left: '🤢 Bad Quality', right: '👌 Top Quality' },

    // 💀 Fear
    { left: '🙂 Not Scary', right: '👻 Terrifying' },
    { left: '😌 Comfortable', right: '😱 Nightmare Fuel' },

    // 🎉 Social Competence
    { left: '🙃 Awkward', right: '🕺 Charismatic' },
    { left: '🤐 Quiet', right: '🎤 Loud' },

    // 📚 Knowledge
    { left: '🧒 Beginner', right: '🧙‍♂️ Expert' },
    { left: '📕 Ignorant', right: '📚 Knowledgeable' },

    // 🔥 Popularity / Trend
    { left: '🧓 Outdated', right: '⚡ Trendy' },
    { left: '📉 Underrated', right: '📈 Overhyped' },

    // 🍕 Food Taste
    { left: '🤮 Terrible', right: '🤤 Delicious' },
    { left: '🌶️ Mild', right: '🥵 Spicy' },

    // 🎭 Drama
    { left: '🙂 Low Drama', right: '🎭 High Drama' },

    // ❤️ Romance
    { left: '💔 Not Romantic', right: '🥰 Extremely Romantic' },

    // 🧠 Intelligence Scale
    { left: '🤪 Dumb Move', right: '🧠 Galaxy Brain Move' },

    // 🧹 Cleanliness
    { left: '🗑️ Messy', right: '✨ Immaculate' },

    // 💪 Strength
    { left: '🪶 Weak', right: '🏋️ Strong' },

    // 🎮 Skill / Difficulty
    { left: '🍼 Very Easy', right: '🔪 Impossible' },

    // 💬 Conversation Type
    { left: '🤫 Serious', right: '🤣 Chaotic' },

    // 🎶 Music Taste
    { left: '🤢 Bad Taste', right: '🎶 Elite Taste' },

    // 🌍 Size / Scale
    { left: '🪱 Tiny', right: '🌋 Massive' },

    // 📺 Entertainment
    { left: '😴 Snoozefest', right: '🔥 Banger' },

    // 💼 Workload
    { left: '🛀 Light Work', right: '⚙️ Overload' },

    // 🚗 Speed
    { left: '🐢 Slow Motion', right: '🚗💨 Lightning Fast' },

    // 💥 Impact
    { left: '🧊 Cold Take', right: '🔥 Hot Take' },
  ];

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
  onEndGame,
}: WavelengthGameProps) {
  const [clueInput, setClueInput] = useState("");
  const [guessValue, setGuessValue] = useState(50);

  const isHost = currentPlayer.player_id === room.host_id;
  const isClueGiver = gameState.clueGiver === currentPlayer.player_id;

  // scores with safe default
  const scores: Record<string, number> = useMemo(
    () => gameState.scores || {},
    [gameState.scores]
  );

  // total rounds logic: default = players.length * 2, but can be extended by host
  const baseRounds = players.length * 2;
  const totalRounds = gameState.maxRounds ?? baseRounds;
  const isLastRound = gameState.round >= totalRounds;

  const hasGuessed = !!gameState.guesses[currentPlayer.player_id];
  const clueGiverPlayer = players.find(
    (p) => p.player_id === gameState.clueGiver
  );

  // === SCORING RULES ===
  // returns: { playerDelta, clueDelta, allOffTen }
  const computeRoundDeltas = () => {
    const deltas: Record<string, number> = {};
    let clueDelta = 0;
    let allOffTen = true;

    const target = gameState.target;
    const guesses = gameState.guesses || {};
    const clueId = gameState.clueGiver;

    Object.entries(guesses).forEach(([pid, guess]) => {
      if (pid === clueId) return; // safety; clue giver never guesses
      const g = Number(guess);
      const distance = Math.abs(g - target);

      let delta = 0;

      if (distance === 0) {
        // PERFECT
        delta = 30;
        clueDelta += 20;
        allOffTen = false;
      } else if (distance <= 5) {
        delta = 10;
        clueDelta += 5;
        allOffTen = false;
      } else if (distance <= 10) {
        delta = 5;
        clueDelta += 3;
        allOffTen = false;
      } else {
        delta = -10;
        // still might be allOffTen if all guesses are like this
      }

      deltas[pid] = delta;
    });

    if (allOffTen) {
      clueDelta -= 20;
    }

    return { deltas, clueDelta, allOffTen };
  };

  const calculateScoreForDisplay = (guess: number, target: number) => {
    const distance = Math.abs(guess - target);
    if (distance === 0) return 30;
    if (distance <= 5) return 10;
    if (distance <= 10) return 5;
    return -10;
  };

  // === HOST ACTIONS ===

  // Host: apply scoring + go to reveal
  const handleHostRevealAndScore = () => {
    if (!isHost) return;
    if (gameState.phase !== "guessing") return;

    const { deltas, clueDelta } = computeRoundDeltas();
    const clueId = gameState.clueGiver;

    const currentScores = gameState.scores || {};
    const newScores: Record<string, number> = { ...currentScores };

    // apply player deltas
    Object.entries(deltas).forEach(([pid, delta]) => {
      newScores[pid] = (newScores[pid] || 0) + delta;
    });

    // apply clue-giver delta
    newScores[clueId] = (newScores[clueId] || 0) + clueDelta;

    onUpdateState({
      scores: newScores,
      phase: "reveal",
    });
  };

  // Host: move to next round or final results
const handleHostNextRound = () => {
  if (!isHost) return;
  if (gameState.phase !== "reveal") return;

  // If game is finished
  if (gameState.round >= gameState.totalRounds) {
    onUpdateState({ phase: "final" });
    return;
  }

  // NEW SPECTRUM every round
  const newSpectrum =
    spectrums[Math.floor(Math.random() * spectrums.length)];

  // NEW target for this spectrum
  const newTarget = Math.floor(Math.random() * 100);

  // rotate clue giver
  const currentIndex = players.findIndex(
    (p) => p.player_id === gameState.clueGiver
  );
  const nextIdx = currentIndex === -1 ? 0 : (currentIndex + 1) % players.length;
  const nextClueGiver = players[nextIdx].player_id;

  onUpdateState({
    phase: "clue",
    round: gameState.round + 1,
    spectrum: newSpectrum,        // 👈 NEW SPECTRUM SET HERE
    target: newTarget,
    clueGiver: nextClueGiver,
    clue: "",
    guesses: {}
  });
};

  // Host: extend game by one more full cycle of clue-givers
  const handleHostExtendRounds = () => {
    if (!isHost) return;
    const currentMax = gameState.maxRounds ?? baseRounds;
    const newMax = currentMax + players.length; // extend by 1 cycle
    onUpdateState({ maxRounds: newMax });
  };

  // === CLUE & GUESS HANDLERS ===

  const handleSubmitClue = () => {
    if (!clueInput.trim()) return;
    if (!isClueGiver) return;

    onUpdateState({
      clue: clueInput.trim(),
      phase: "guessing",
      guesses: {}, // reset just in case
    });
  };

  const handleGuess = (value: number) => {
    if (isClueGiver) return; // clue giver does not guess
    if (hasGuessed) return;
    if (gameState.phase !== "guessing") return;

    const newGuesses = {
      ...(gameState.guesses || {}),
      [currentPlayer.player_id]: value,
    };

    onUpdateState({ guesses: newGuesses });
  };

  // For display: guesses list in guessing/reveal
  const guessesArray = useMemo(
    () =>
      Object.entries(gameState.guesses || {}).map(([playerId, guess]) => ({
        player: players.find((p) => p.player_id === playerId),
        playerId,
        guess,
      })),
    [gameState.guesses, players]
  );

  const allNonCluePlayers = players.filter(
    (p) => p.player_id !== gameState.clueGiver
  );
  const nonClueCount = allNonCluePlayers.length;
  const guessesCount = guessesArray.length;

  // === FINAL SCREEN ===

  if (gameState.phase === "final") {
    const sortedScores = [...players].sort((a, b) => {
      const sa = scores[a.player_id] || 0;
      const sb = scores[b.player_id] || 0;
      return sb - sa;
    });
    const winner = sortedScores[0];

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-4">
        <div className="max-w-4xl mx-auto space-y-6 py-8">
          <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
            <div className="text-center">
              <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-3" />
              <h1 className="text-4xl font-black text-gray-800 mb-2">
                Wavelength – Final Scores
              </h1>
              <p className="text-gray-600">
                Rounds played:{" "}
                <span className="font-semibold">
                  {gameState.round} / {totalRounds}
                </span>
              </p>
            </div>

            <div className="space-y-3">
              {sortedScores.map((p, idx) => {
                const score = scores[p.player_id] || 0;
                const isTop = idx === 0;
                return (
                  <div
                    key={p.player_id}
                    className={`p-5 rounded-2xl border-2 flex items-center gap-4 ${
                      isTop
                        ? "bg-gradient-to-r from-yellow-100 to-orange-100 border-yellow-400"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    {isTop && (
                      <CrownIcon className="w-7 h-7 text-yellow-500" />
                    )}
                    <span className="text-3xl">{p.avatar}</span>
                    <div className="flex-1">
                      <p className="font-bold text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-500">
                        Rank #{idx + 1}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black text-indigo-600">
                        {score}
                      </p>
                      <p className="text-xs text-gray-500">total points</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {isHost && (
              <p className="text-xs text-gray-500 text-center">
                Host can end the game to go back to lobby.
              </p>
            )}

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

  // === CLUE PHASE ===

  if (gameState.phase === "clue") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-4">
        <div className="max-w-4xl mx-auto space-y-6 py-8">
          <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
              <div className="text-left">
                <TrendingUp className="w-10 h-10 text-indigo-600 mb-2" />
                <h1 className="text-2xl font-black text-gray-800">
                  📊 Wavelength
                </h1>
                <p className="text-gray-600 text-sm">
                  Round{" "}
                  <span className="font-semibold">
                    {gameState.round}/{totalRounds}
                  </span>{" "}
                  • Everyone will get chances as clue giver.
                </p>
              </div>
              <div className="text-right text-xs text-gray-500">
                <p>Players: {players.length}</p>
                <p>
                  Clue Giver:{" "}
                  <span className="font-semibold">
                    {clueGiverPlayer?.name}
                  </span>
                </p>
              </div>
            </div>

            {/* Spectrum */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-100 to-blue-100 border-2 border-indigo-300">
              <div className="flex items-center justify-between mb-4">
                <div className="text-center flex-1">
                  <p className="text-2xl font-bold text-gray-800">
                    {gameState.spectrum.left}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">0</p>
                </div>
                <div className="px-4">
                  <div className="w-16 h-1 bg-gradient-to-r from-indigo-400 to-blue-400 rounded-full" />
                </div>
                <div className="text-center flex-1">
                  <p className="text-2xl font-bold text-gray-800">
                    {gameState.spectrum.right}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">100</p>
                </div>
              </div>
            </div>

            {isClueGiver ? (
              <div className="space-y-4">
                <div className="p-6 rounded-2xl bg-gradient-to-r from-yellow-100 to-orange-100 border-2 border-yellow-300">
                  <p className="text-sm font-bold text-yellow-800 mb-2">
                    🎯 SECRET TARGET
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <Target className="w-8 h-8 text-yellow-700" />
                    <p className="text-4xl font-black text-gray-900">
                      {gameState.target}
                    </p>
                  </div>
                  <p className="text-sm text-gray-700 mt-3 text-center">
                    Give a clue that hints at this position on the spectrum,
                    without making it too obvious.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Your Clue
                  </label>
                  <input
                    type="text"
                    value={clueInput}
                    onChange={(e) => setClueInput(e.target.value)}
                    placeholder="Give a smart, indirect hint..."
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none transition-colors text-lg"
                    maxLength={50}
                  />
                </div>

                <button
                  onClick={handleSubmitClue}
                  disabled={!clueInput.trim()}
                  className="w-full bg-gradient-to-r from-indigo-500 to-blue-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  Submit Clue &amp; Start Guessing
                </button>
              </div>
            ) : (
              <div className="text-center p-8">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <span className="text-3xl">{clueGiverPlayer?.avatar}</span>
                  <p className="text-lg text-gray-600">
                    <span className="font-bold text-gray-800">
                      {clueGiverPlayer?.name}
                    </span>{" "}
                    is thinking...
                  </p>
                </div>
                <div className="animate-pulse flex justify-center gap-2">
                  <div className="w-3 h-3 bg-indigo-400 rounded-full" />
                  <div className="w-3 h-3 bg-indigo-400 rounded-full" />
                  <div className="w-3 h-3 bg-indigo-400 rounded-full" />
                </div>
              </div>
            )}

            {/* Score Summary Small */}
            <RoundScoreStrip players={players} scores={scores} />
          </div>
        </div>
      </div>
    );
  }

  // === GUESSING PHASE ===

  if (gameState.phase === "guessing") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-4">
        <div className="max-w-5xl mx-auto space-y-6 py-8">
          <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <TrendingUp className="w-10 h-10 text-indigo-600 mb-2" />
                <h1 className="text-2xl font-black text-gray-800">
                  Make Your Guess!
                </h1>
                <p className="text-gray-600 text-sm">
                  Round{" "}
                  <span className="font-semibold">
                    {gameState.round}/{totalRounds}
                  </span>
                  {" • "}
                  Clue by{" "}
                  <span className="font-semibold">
                    {clueGiverPlayer?.name}
                  </span>
                </p>
              </div>
              <div className="text-xs text-gray-500 text-right">
                <p>Players guessing: {nonClueCount}</p>
                <p>
                  Guessed: {guessesCount}/{nonClueCount}
                </p>
              </div>
            </div>

            {/* Spectrum + clue */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-100 to-blue-100 border-2 border-indigo-300">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xl font-bold text-gray-800">
                  {gameState.spectrum.left}
                </p>
                <p className="text-xl font-bold text-gray-800">
                  {gameState.spectrum.right}
                </p>
              </div>
              <div className="text-center mb-4">
                <p className="text-sm text-gray-600 font-semibold mb-2">
                  CLUE
                </p>
                <p className="text-3xl font-black text-gray-900">
                  {gameState.clue}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  by{" "}
                  <span className="font-bold">{clueGiverPlayer?.name}</span>
                </p>
              </div>
            </div>

            {/* Guess slider */}
            {!isClueGiver && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-bold text-gray-700">
                      Your Guess
                    </label>
                    <span className="text-2xl font-black text-indigo-600">
                      {guessValue}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
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
                  {hasGuessed ? "✓ Guess Submitted" : "Lock In Guess"}
                </button>
              </div>
            )}

            {isClueGiver && (
              <div className="text-center p-6 bg-yellow-50 rounded-2xl">
                <p className="text-gray-600">
                  You're the clue giver! Wait while others guess, then the host
                  will reveal and score the round.
                </p>
              </div>
            )}

            {/* Host controls inside guessing */}
            {isHost && (
              <div className="mt-4 p-4 bg-gray-50 rounded-2xl border border-gray-200 text-xs text-gray-700">
                <p className="font-semibold mb-2">Host Controls</p>
                <p className="mb-2">
                  You can reveal and score once enough players have guessed.
                </p>
                <button
                  onClick={handleHostRevealAndScore}
                  disabled={guessesCount === 0}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold disabled:opacity-40"
                >
                  Reveal &amp; Score Round
                </button>
              </div>
            )}

            <RoundScoreStrip players={players} scores={scores} />
          </div>
        </div>
      </div>
    );
  }

  // === REVEAL PHASE (per-round results + running scores) ===

  if (gameState.phase === "reveal") {
    const target = gameState.target;
    const guesses = gameState.guesses || {};
    const clueId = gameState.clueGiver;

    const revealArray = Object.entries(guesses)
      .filter(([pid]) => pid !== clueId)
      .map(([pid, guess]) => {
        const player = players.find((p) => p.player_id === pid)!;
        const g = Number(guess);
        const distance = Math.abs(g - target);
        const roundScore = calculateScoreForDisplay(g, target);
        return { player, pid, guess: g, distance, roundScore };
      })
      .sort((a, b) => a.distance - b.distance);

    const clueRoundDelta = (() => {
      const { clueDelta } = computeRoundDeltas();
      return clueDelta;
    })();

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-4">
        <div className="max-w-5xl mx-auto space-y-6 py-8">
          <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
              <div className="text-left">
                <Award className="w-12 h-12 text-yellow-500 mb-2" />
                <h1 className="text-3xl font-black text-gray-800 mb-1">
                  🎯 Round Results
                </h1>
                <p className="text-gray-600 text-sm">
                  Round{" "}
                  <span className="font-semibold">
                    {gameState.round}/{totalRounds}
                  </span>
                  {" • "} Clue by{" "}
                  <span className="font-semibold">
                    {clueGiverPlayer?.name}
                  </span>
                </p>
              </div>
              <div className="text-xs text-gray-500 text-right">
                <p>Players: {players.length}</p>
                <p>
                  Clue Giver Score Δ:{" "}
                  <span
                    className={
                      clueRoundDelta > 0
                        ? "text-green-600 font-semibold"
                        : clueRoundDelta < 0
                        ? "text-red-600 font-semibold"
                        : "font-semibold"
                    }
                  >
                    {clueRoundDelta > 0 ? "+" : ""}
                    {clueRoundDelta}
                  </span>
                </p>
              </div>
            </div>

            {/* Spectrum & target */}
            <div className="relative p-6 rounded-2xl bg-gradient-to-r from-indigo-100 to-blue-100 border-2 border-indigo-300">
              <div className="flex items-center justify-between mb-4">
                <p className="text-lg font-bold text-gray-800">
                  {gameState.spectrum.left}
                </p>
                <p className="text-lg font-bold text-gray-800">
                  {gameState.spectrum.right}
                </p>
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
                Clue:{" "}
                <span className="font-bold text-gray-800">
                  {gameState.clue}
                </span>
              </p>
            </div>

            {/* Round scoreboard */}
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-3">
                This Round
              </h2>
              {revealArray.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No one guessed this round.
                </p>
              ) : (
                <div className="space-y-3">
                  {revealArray.map((item, idx) => (
                    <div
                      key={item.pid}
                      className={`p-4 rounded-2xl border-2 flex items-center gap-4 ${
                        idx === 0
                          ? "bg-gradient-to-r from-yellow-100 to-orange-100 border-yellow-400"
                          : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      {idx === 0 && (
                        <Award className="w-6 h-6 text-yellow-500" />
                      )}
                      <span className="text-3xl">
                        {item.player.avatar}
                      </span>
                      <div className="flex-1">
                        <p className="font-bold text-gray-800">
                          {item.player.name}
                        </p>
                        <p className="text-sm text-gray-600">
                          Guessed: {item.guess} (off by{" "}
                          {item.distance})
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-2xl font-black ${
                            item.roundScore > 0
                              ? "text-green-600"
                              : item.roundScore < 0
                              ? "text-red-600"
                              : "text-gray-700"
                          }`}
                        >
                          {item.roundScore > 0 ? "+" : ""}
                          {item.roundScore}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          this round
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Running scores */}
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-3">
                Total Scores
              </h2>
              <RoundScoreStrip players={players} scores={scores} />
            </div>

            {/* Host buttons */}
            {isHost && (
              <div className="mt-4 p-4 bg-gray-50 rounded-2xl border border-gray-200 text-xs text-gray-700 space-y-2">
                <p className="font-semibold">Host Controls</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleHostNextRound}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold"
                  >
                    {isLastRound
                      ? "Finish Game (Show Final Scores)"
                      : "Next Round"}
                  </button>
                  <button
                    onClick={handleHostExtendRounds}
                    className="px-4 py-2 rounded-xl bg-white border border-slate-300 font-semibold flex items-center gap-1"
                  >
                    <Zap className="w-3 h-3 text-indigo-500" />
                    Extend Game (+{players.length} rounds)
                  </button>
                </div>
                <p className="text-[10px] text-gray-500">
                  Extension always happens in multiples of players so everyone
                  keeps getting clue turns.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/** Small component: horizontal strip of players + scores */
function RoundScoreStrip({
  players,
  scores,
}: {
  players: Player[];
  scores: Record<string, number>;
}) {
  if (!players.length) return null;

  const sorted = [...players].sort((a, b) => {
    const sa = scores[a.player_id] || 0;
    const sb = scores[b.player_id] || 0;
    return sb - sa;
  });

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-2 text-xs text-gray-600">
        <Users className="w-3 h-3" />
        <span>Scoreboard</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {sorted.map((p, idx) => {
          const s = scores[p.player_id] || 0;
          return (
            <div
              key={p.player_id}
              className={`px-3 py-2 rounded-2xl border text-xs flex items-center gap-2 ${
                idx === 0
                  ? "bg-indigo-50 border-indigo-300"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <span className="text-lg">{p.avatar}</span>
              <div>
                <p className="font-semibold text-gray-800 truncate max-w-[100px]">
                  {p.name}
                </p>
                <p className="text-[11px] text-gray-500">
                  {s >= 0 ? "+" : ""}
                  {s} pts
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CrownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M5 20h14a1 1 0 0 0 .97-.757l2-8A1 1 0 0 0 20.96 10l-4.184 1.046-3.11-6.221a1 1 0 0 0-1.79 0L8.767 11.046 4.586 10A1 1 0 0 0 2.97 11.243l2 8A1 1 0 0 0 5 20Zm3.104-2-1.2-4.8 2.21.553a1 1 0 0 0 1.07-.53L12 8.618l1.816 3.605a1 1 0 0 0 1.07.53l2.21-.553-1.2 4.8H8.104Z" />
    </svg>
  );
}
