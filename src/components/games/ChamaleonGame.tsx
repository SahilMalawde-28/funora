import { useState } from "react";
import { Room, Player } from "../../lib/supabase";
import { ChameleonGameState } from "../../lib/gameLogic";
import { Eye, Users, Target, HelpCircle, Trophy } from "lucide-react";

interface ChameleonGameProps {
  room: Room;
  players: Player[];
  currentPlayer: Player;
  gameState: ChameleonGameState;
  onUpdateState: (newState: Partial<ChameleonGameState>) => void;
  onEndGame: () => void;
}

export default function ChamaleonGame({
  room,
  players,
  currentPlayer,
  gameState,
  onUpdateState,
  onEndGame,
}: ChameleonGameProps) {
  const myRole = gameState.assignments[currentPlayer.player_id];
  const isImposter = myRole === "imposter";
  const isHost = currentPlayer.player_id === room.host_id;

  const [hintInput, setHintInput] = useState("");
  const [selectedVote, setSelectedVote] = useState<string | null>(null);

  const hasGivenHint = !!gameState.hints[currentPlayer.player_id];
  const hasVoted = currentPlayer.player_id in gameState.votes;

  const allHintsGiven = Object.keys(gameState.hints).length === players.length;
  const allVoted = Object.keys(gameState.votes).length === players.length;

  const imposterId = Object.entries(gameState.assignments).find(
    ([_, r]) => r === "imposter"
  )?.[0];

  const currentHintPlayerId =
    gameState.hintOrder[gameState.currentHintIndex] ?? null;

  const isMyTurnToHint =
    gameState.phase === "hinting" &&
    currentHintPlayerId === currentPlayer.player_id;

  // ─────────────────────────────────────────────────────
  // Host transitions
  // ─────────────────────────────────────────────────────

  const handleHostContinueFromHinting = () => {
    if (!allHintsGiven) return;
    onUpdateState({
      phase: "voting",
      votes: {},
    });
  };

  const handleHostContinueFromVoting = () => {
    onUpdateState({
      phase: "results",
    });
  };

  // ─────────────────────────────────────────────────────
  // Hint submission
  // ─────────────────────────────────────────────────────

  const handleSubmitHint = () => {
    if (!hintInput.trim() || hasGivenHint || !isMyTurnToHint) return;

    const newHints = {
      ...gameState.hints,
      [currentPlayer.player_id]: hintInput.trim(),
    };

    let nextIndex = gameState.currentHintIndex + 1;
    if (nextIndex >= gameState.hintOrder.length) {
      nextIndex = gameState.hintOrder.length - 1;
    }

    onUpdateState({
      hints: newHints,
      currentHintIndex: nextIndex,
    });

    setHintInput("");
  };

  // ─────────────────────────────────────────────────────
  // Voting
  // ─────────────────────────────────────────────────────

  const handleVote = (playerId: string | null) => {
    if (hasVoted) return;

    setSelectedVote(playerId);

    onUpdateState({
      votes: {
        ...gameState.votes,
        [currentPlayer.player_id]: playerId,
      },
    });
  };

  // ─────────────────────────────────────────────────────
  // Imposter guess click
  // ─────────────────────────────────────────────────────

  const handleImposterGuess = (word: string) => {
    if (!isImposter) return;
    if (gameState.phase !== "voting") return;
    if (gameState.imposterGuess) return;

    onUpdateState({
      imposterGuess: word,
    });
  };

  // ─────────────────────────────────────────────────────
  // Results helpers
  // ─────────────────────────────────────────────────────

  const getVoteCounts = () => {
    const counts: Record<string, number> = {};
    Object.values(gameState.votes).forEach((v) => {
      if (!v) return;
      counts[v] = (counts[v] || 0) + 1;
    });
    return counts;
  };

  const mostVotedPlayerId = (() => {
    const counts = getVoteCounts();
    const arr = Object.entries(counts);
    if (arr.length === 0) return null;
    arr.sort((a, b) => b[1] - a[1]);
    return arr[0][0];
  })();

  const computeFinalWinner = (): "imposter" | "players" => {
    if (!imposterId) return "players";

    // Voting result first
    let baseline: "imposter" | "players" = "imposter";

    if (mostVotedPlayerId === imposterId) baseline = "players";
    else baseline = "imposter";

    // Imposter last chance
    if (gameState.imposterGuess) {
      if (gameState.imposterGuess === gameState.targetWord) {
        return "imposter";
      }
      return baseline;
    }

    return baseline;
  };

  const finalWinner = computeFinalWinner();

  // ─────────────────────────────────────────────────────
  // UI helpers
  // ─────────────────────────────────────────────────────

  const renderGrid = (canImposterClick: boolean) => (
    <div className="grid grid-cols-4 gap-3">
      {gameState.gridWords.map((word) => {
        const isTarget = word === gameState.targetWord;
        const isChosen = word === gameState.imposterGuess;

        const base = "p-3 rounded-2xl border text-center font-semibold";

        const normalHighlight =
          !isImposter && isTarget
            ? "border-green-500 bg-green-50"
            : "border-gray-200 bg-white hover:bg-gray-50";

        const guessHighlight = isChosen ? "border-purple-600 bg-purple-50" : "";

        const classes = `${base} ${normalHighlight} ${guessHighlight}`;

        const clickable =
          canImposterClick &&
          isImposter &&
          gameState.phase === "voting" &&
          !gameState.imposterGuess;

        if (!clickable) {
          return (
            <div key={word} className={classes}>
              {word}
            </div>
          );
        }

        return (
          <button
            key={word}
            className={`${classes} hover:border-purple-400 hover:bg-purple-50`}
            onClick={() => handleImposterGuess(word)}
          >
            {word}
          </button>
        );
      })}
    </div>
  );

  const renderHintsList = () => (
    <div className="space-y-2">
      {players.map((pl) => (
        <div
          key={pl.player_id}
          className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2"
        >
          <span className="text-xs font-semibold text-gray-500 mt-[2px]">
            {pl.name}
          </span>
          <span className="text-sm text-gray-800">
            {gameState.hints[pl.player_id] ?? (
              <span className="italic text-gray-400">No hint yet</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );

  // ─────────────────────────────────────────────────────
  // PHASE 1 — HINTING
  // ─────────────────────────────────────────────────────

  if (gameState.phase === "hinting") {
    const currentHintPlayer = players.find(
      (p) => p.player_id === currentHintPlayerId
    );

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-6">
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-3xl shadow-xl space-y-6">

          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-8 h-8 text-indigo-600" />
                <h1 className="text-3xl font-black text-gray-800">
                  Chameleon – Hint Round
                </h1>
              </div>
              <p className="text-gray-600 text-sm">
                Everyone gives one hint. The Chameleon has no clue. 🦎
              </p>
            </div>

            <div className="text-right text-xs text-gray-500">
              <p className="font-semibold">Your role:</p>
              <p
                className={`text-sm font-bold ${
                  isImposter ? "text-purple-600" : "text-green-600"
                }`}
              >
                {isImposter ? "CHAMELEON" : "NORMAL"}
              </p>
            </div>
          </div>

          {/* Secret word or Chameleon info */}
          <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200">
            <p className="text-xs font-bold text-indigo-700 mb-1">Topic</p>
            <p className="text-lg font-black text-gray-900 mb-2">
              {gameState.topic}
            </p>

            {!isImposter ? (
              <>
                <p className="text-xs font-semibold text-gray-600">
                  SECRET WORD
                </p>
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-green-600" />
                  <p className="text-2xl font-black">{gameState.targetWord}</p>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-700">
                You are the Chameleon. You don’t know the word.
              </p>
            )}
          </div>

          {/* Grid */}
          <div>
            <p className="text-xs font-bold text-gray-500 mb-2">
              Topic Grid (16 Words)
            </p>
            {renderGrid(false)}
          </div>

          {/* Hint box or waiting */}
          {isMyTurnToHint ? (
            <>
              <textarea
                value={hintInput}
                onChange={(e) => setHintInput(e.target.value)}
                className="w-full p-3 border-2 border-gray-200 rounded-2xl"
                placeholder="Type your hint..."
              />
              <button
                onClick={handleSubmitHint}
                className="w-full bg-indigo-500 text-white py-2 rounded-2xl"
              >
                Submit Hint
              </button>
            </>
          ) : (
            <div className="p-3 border border-gray-200 rounded-2xl text-center text-sm text-gray-600">
              Waiting for {currentHintPlayer?.name} to give their hint...
            </div>
          )}

          <p className="text-center text-xs text-gray-500">
            {Object.keys(gameState.hints).length}/{players.length} hints done
          </p>

          <div>
            <p className="text-xs font-bold text-gray-500">Hints so far:</p>
            {renderHintsList()}
          </div>

          {isHost && allHintsGiven && (
            <button
              onClick={handleHostContinueFromHinting}
              className="w-full bg-green-500 text-white py-3 rounded-2xl"
            >
              Continue → Voting
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────
  // PHASE 2 — VOTING (with Imposter click)
  // ─────────────────────────────────────────────────────

  if (gameState.phase === "voting") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-yellow-50 p-6">
        <div className="max-w-5xl mx-auto bg-white p-8 rounded-3xl shadow-xl space-y-6">

          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-black text-gray-800">Voting & Final Guess</h1>
              <p className="text-gray-600 text-sm">
                Vote out the Chameleon. Imposter gets a last chance.
              </p>
            </div>

            <div className="text-right text-xs text-gray-500">
              <p className="font-semibold">Your role:</p>
              <p
                className={`text-sm font-bold ${
                  isImposter ? "text-purple-600" : "text-green-600"
                }`}
              >
                {isImposter ? "CHAMELEON" : "NORMAL"}
              </p>
            </div>
          </div>

          {/* Secret word + grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            <div className="space-y-4">
              {/* Secret word */}
              <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200">
                <p className="text-xs font-bold text-orange-700 mb-1">
                  SECRET WORD
                </p>
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-orange-600" />
                  <p className="text-2xl font-black">{gameState.targetWord}</p>
                </div>
              </div>

              {/* Hints */}
              <div>
                <p className="text-xs font-bold text-gray-500 mb-1">Hints:</p>
                {renderHintsList()}
              </div>
            </div>

            {/* Grid with imposter click */}
            <div>
              <p className="text-xs font-bold text-gray-500 mb-1">Chameleon Guess Grid</p>
              {renderGrid(true)}

              {/* Imposter Choices */}
              {isImposter ? (
                <div className="mt-2 text-xs text-purple-700 bg-purple-50 border border-purple-200 p-3 rounded-xl">
                  {gameState.imposterGuess ? (
                    <>You chose <b>{gameState.imposterGuess}</b>. Final outcome in results.</>
                  ) : (
                    <>Click one word above as your final guess.</>
                  )}
                </div>
              ) : (
                <div className="mt-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 p-3 rounded-xl">
                  The Chameleon can click exactly one word.
                </div>
              )}
            </div>
          </div>

          {/* Voting */}
          <div>
            <p className="text-xs font-bold text-gray-500 mb-1">Vote the Chameleon</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {players.map((pl) => {
                const active = selectedVote === pl.player_id;
                return (
                  <button
                    key={pl.player_id}
                    disabled={hasVoted}
                    onClick={() => handleVote(pl.player_id)}
                    className={`p-3 rounded-2xl border text-left ${
                      active
                        ? "border-red-500 bg-red-50"
                        : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                    }`}
                  >
                    <span className="font-semibold">{pl.name}</span>
                  </button>
                );
              })}

              <button
                disabled={hasVoted}
                onClick={() => handleVote(null)}
                className={`p-3 rounded-2xl border text-left ${
                  selectedVote === null
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                }`}
              >
                Skip (Not sure)
              </button>
            </div>

            <p className="text-center text-xs text-gray-500 mt-1">
              {Object.keys(gameState.votes).length}/{players.length} voted
            </p>
          </div>

          {isHost && allVoted && (
            <button
              onClick={handleHostContinueFromVoting}
              className="w-full bg-purple-500 text-white py-3 rounded-2xl mt-3"
            >
              Continue → Results
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────
  // PHASE 3 — RESULTS
  // ─────────────────────────────────────────────────────

  if (gameState.phase === "results") {
    const voteCounts = getVoteCounts();

    const imposterPlayer =
      imposterId && players.find((p) => p.player_id === imposterId);

    const mostVotedPlayer =
      mostVotedPlayerId &&
      players.find((p) => p.player_id === mostVotedPlayerId);

    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-orange-50 p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl p-8 space-y-6 text-center">

          <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-3" />

          <h1 className="text-3xl font-black text-gray-800">
            Round Results 🏁
          </h1>

          {/* Voting summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl text-left">
              <p className="font-bold text-gray-600 mb-2">Voting</p>
              <p className="text-sm">
                Most voted:{" "}
                <b>{mostVotedPlayer?.name ?? "No consensus"}</b>
              </p>
              <p className="text-sm">
                Actual Chameleon: <b>{imposterPlayer?.name}</b>
              </p>

              <div className="mt-2 text-xs">
                <p>Vote counts:</p>
                {Object.entries(voteCounts).map(([pid, c]) => {
                  const pl = players.find((p) => p.player_id === pid);
                  return (
                    <p key={pid}>
                      {pl?.name ?? "Player"} — {c} votes
                    </p>
                  );
                })}
              </div>
            </div>

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl text-left">
              <p className="font-bold text-gray-600 mb-2">Chameleon’s Last Guess</p>
              <p className="text-sm">
                Secret word: <b>{gameState.targetWord}</b>
              </p>
              <p className="text-sm">
                Guess: <b>{gameState.imposterGuess ?? "No guess"}</b>
              </p>

              <p className="mt-3 text-lg font-black">
                {finalWinner === "imposter" ? (
                  <span className="text-purple-600">Chameleon Wins! 🦎</span>
                ) : (
                  <span className="text-green-600">Players Win! 🎉</span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onEndGame}
            className="mt-6 w-full bg-green-600 text-white py-3 rounded-2xl"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  // fallback
  return <p className="text-center mt-10">Loading Chameleon...</p>;
}
