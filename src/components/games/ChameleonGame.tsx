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

  const isActive = gameState.activePlayers
    ? gameState.activePlayers.includes(currentPlayer.player_id)
    : true;

  const [hintInput, setHintInput] = useState("");
  const [selectedVote, setSelectedVote] = useState<string | null>(null);

  const hasGivenHint = !!gameState.hints[currentPlayer.player_id];
  const hasVoted = currentPlayer.player_id in gameState.votes;

  const allHintsGiven = gameState.activePlayers
    ? gameState.activePlayers.every((id) => !!gameState.hints[id])
    : Object.keys(gameState.hints).length === players.length;

  const allVoted = gameState.activePlayers
    ? gameState.activePlayers.every((id) => gameState.votes.hasOwnProperty(id))
    : Object.keys(gameState.votes).length === players.length;

  const imposterId = Object.entries(gameState.assignments).find(
    ([_, r]) => r === "imposter"
  )?.[0];

  const currentHintPlayerId =
    gameState.hintOrder[gameState.currentHintIndex] ?? null;

  const isMyTurnToHint =
    gameState.phase === "hinting" &&
    currentHintPlayerId === currentPlayer.player_id &&
    isActive;

  // ─────────────────────────────────────────────────────
  // Host transitions
  // ─────────────────────────────────────────────────────

  const handleHostContinueFromHinting = () => {
    if (!allHintsGiven) return;
    onUpdateState({
      phase: "voting",
      votes: {},
      imposterGuess: null,
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
    if (!isActive || hasVoted) return;

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
  // Results helpers (multi-round logic)
  // ─────────────────────────────────────────────────────

  const getVoteCounts = () => {
    const counts: Record<string, number> = {};
    Object.entries(gameState.votes).forEach(([pid, voted]) => {
      if (!voted) return;
      counts[voted] = (counts[voted] || 0) + 1;
    });
    return counts;
  };

  const getMostVotedPlayerId = () => {
  const counts = getVoteCounts(); // { playerId or null: count }

  // If no votes → no elimination
  if (Object.keys(counts).length === 0) return null;

  const entries = Object.entries(counts); // [pid, count]

  // Sort by vote count
  entries.sort((a, b) => b[1] - a[1]);

  const [topId, topCount] = entries[0];

  // Find if tie exists
  const tied = entries.filter(([_, count]) => count === topCount);

  // 🔸 Rule 1: If tie → eliminate no one
  if (tied.length > 1) {
    return null;
  }

  // 🔸 Rule 2: If highest vote is "skip" (null) → eliminate no one
  if (topId === "null" || topId === null) {
    return null;
  }

  // 🔸 Otherwise this is the eliminated person
  return topId;
};


  const mostVotedPlayerId = getMostVotedPlayerId();

  // 🔥 Core round resolution:
  // returns: roundWinner (if game ends), eliminatedPlayerId (if any), nextActivePlayers, willContinue
  const computeRoundResolution = () => {
    if (!imposterId) {
      return {
        roundWinner: null as "imposter" | "players" | null,
        eliminatedPlayerId: null as string | null,
        nextActivePlayers: [...gameState.activePlayers],
        willContinue: false,
      };
    }

    // 1) If chameleon guessed correctly -> immediate win, no more rounds
    if (gameState.imposterGuess === gameState.targetWord) {
      return {
        roundWinner: "imposter" as const,
        eliminatedPlayerId: null,
        nextActivePlayers: [...gameState.activePlayers],
        willContinue: false,
      };
    }

    // 2) Voting outcome
    if (mostVotedPlayerId === imposterId) {
      // Chameleon caught
      return {
        roundWinner: "players" as const,
        eliminatedPlayerId: imposterId,
        nextActivePlayers: gameState.activePlayers.filter(
          (id) => id !== imposterId
        ),
        willContinue: false,
      };
    }

    // 3) Wrong vote: eliminate that player (if any)
    let eliminatedPlayerId: string | null = null;
    let nextActivePlayers = [...gameState.activePlayers];

    if (mostVotedPlayerId && mostVotedPlayerId !== imposterId) {
      eliminatedPlayerId = mostVotedPlayerId;
      nextActivePlayers = nextActivePlayers.filter(
        (id) => id !== mostVotedPlayerId
      );
    }

    // 4) Check "only 2 left and one is chameleon" -> chameleon wins
    if (
      nextActivePlayers.length <= 2 &&
      nextActivePlayers.includes(imposterId)
    ) {
      return {
        roundWinner: "imposter" as const,
        eliminatedPlayerId,
        nextActivePlayers,
        willContinue: false,
      };
    }

    // 5) No one won yet -> more rounds
    return {
      roundWinner: null as "imposter" | "players" | null,
      eliminatedPlayerId,
      nextActivePlayers,
      willContinue: true,
    };
  };

  const resolution = computeRoundResolution();

  const handleNextRound = () => {
    if (!resolution.willContinue) return;

    // New hint order only for active players
    const newHintOrder = [...resolution.nextActivePlayers].sort(
      () => Math.random() - 0.5
    );

    onUpdateState({
      phase: "hinting",
      round: gameState.round + 1,
      activePlayers: resolution.nextActivePlayers,
      hints: {},
      votes: {},
      imposterGuess: null,
      hintOrder: newHintOrder,
      currentHintIndex: 0,
    });
  };

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
          isActive &&
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
      {gameState.activePlayers.map((pid) => {
        const pl = players.find((p) => p.player_id === pid);
        return (
          <div
            key={pid}
            className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2"
          >
            <span className="text-xs font-semibold text-gray-500 mt-[2px]">
              {pl?.name ?? "Player"}
            </span>
            <span className="text-sm text-gray-800">
              {gameState.hints[pid] ?? (
                <span className="italic text-gray-400">No hint yet</span>
              )}
            </span>
          </div>
        );
      })}
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
              <div className="flex items-center gap-2 mb-1">
                <Eye className="w-7 h-7 text-indigo-600" />
                <h1 className="text-2xl md:text-3xl font-black text-gray-800">
                  Chameleon – Round {gameState.round}
                </h1>
              </div>
              <p className="text-gray-600 text-sm">
                Everyone gives a hint. Chameleon has to blend in. 🦎
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
              {!isActive && (
                <p className="text-[11px] text-red-500 mt-1">
                  You are eliminated (spectator).
                </p>
              )}
            </div>
          </div>

          {/* Topic & secret word info */}
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

          {/* Hint input or waiting / spectator */}
          {isActive ? (
            isMyTurnToHint ? (
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
                {currentHintPlayer
                  ? `Waiting for ${currentHintPlayer.name} to give their hint...`
                  : "Waiting for hints..."}
              </div>
            )
          ) : (
            <div className="p-3 border border-gray-200 rounded-2xl text-center text-sm text-gray-600">
              You are out this game. Watching as spectator.
            </div>
          )}

          <p className="text-center text-xs text-gray-500">
            {Object.keys(gameState.hints).length}/{gameState.activePlayers.length} hints done
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
              <h1 className="text-2xl md:text-3xl font-black text-gray-800">
                Voting & Final Guess
              </h1>
              <p className="text-gray-600 text-sm">
                Vote out the Chameleon. Chameleon gets a last click.
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
              {!isActive && (
                <p className="text-[11px] text-red-500 mt-1">
                  You are eliminated (spectator).
                </p>
              )}
            </div>
          </div>

          {/* Secret word + grid & hints */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              {/* SECRET WORD CARD (🔴 FIXED: hidden for chameleon) */}
              <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200">
                <p className="text-xs font-bold text-orange-700 mb-1">
                  SECRET WORD
                </p>
                {isImposter ? (
                  <p className="text-sm text-gray-700">
                    The secret word is hidden from you. Use hints + grid to guess.
                  </p>
                ) : (
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-orange-600" />
                    <p className="text-2xl font-black">{gameState.targetWord}</p>
                  </div>
                )}
              </div>

              {/* Hints */}
              <div>
                <p className="text-xs font-bold text-gray-500 mb-1">Hints:</p>
                {renderHintsList()}
              </div>
            </div>

            {/* Grid with imposter click */}
            <div>
              <p className="text-xs font-bold text-gray-500 mb-1">
                Chameleon Guess Grid
              </p>
              {renderGrid(true)}

              {/* Imposter info */}
              {isImposter ? (
                <div className="mt-2 text-xs text-purple-700 bg-purple-50 border border-purple-200 p-3 rounded-xl">
                  {gameState.imposterGuess ? (
                    <>
                      You chose <b>{gameState.imposterGuess}</b>. Final check in results.
                    </>
                  ) : (
                    <>Click one word as your final guess. Only one chance.</>
                  )}
                </div>
              ) : (
                <div className="mt-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 p-3 rounded-xl">
                  The Chameleon can click exactly one word. If correct, they can still win.
                </div>
              )}
            </div>
          </div>

          {/* Voting */}
          <div>
            <p className="text-xs font-bold text-gray-500 mb-1">
              Vote the Chameleon
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {gameState.activePlayers.map((pid) => {
                const pl = players.find((p) => p.player_id === pid);
                const active = selectedVote === pid;
                return (
                  <button
                    key={pid}
                    disabled={!isActive || hasVoted}
                    onClick={() => handleVote(pid)}
                    className={`p-3 rounded-2xl border text-left ${
                      active
                        ? "border-red-500 bg-red-50"
                        : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                    } disabled:opacity-50`}
                  >
                    <span className="font-semibold">{pl?.name ?? "Player"}</span>
                  </button>
                );
              })}

              <button
                disabled={!isActive || hasVoted}
                onClick={() => handleVote(null)}
                className={`p-3 rounded-2xl border text-left ${
                  selectedVote === null
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                } disabled:opacity-50`}
              >
                Skip (Not sure)
              </button>
            </div>

            <p className="text-center text-xs text-gray-500 mt-1">
              {Object.keys(gameState.votes).length}/{gameState.activePlayers.length} voted
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
  // PHASE 3 — RESULTS (with multi-round handling)
  // ─────────────────────────────────────────────────────

  if (gameState.phase === "results") {
    const voteCounts = getVoteCounts();

    const imposterPlayer =
      imposterId && players.find((p) => p.player_id === imposterId);

    const mostVotedPlayer =
      mostVotedPlayerId &&
      players.find((p) => p.player_id === mostVotedPlayerId);

    const roundWinner = resolution.roundWinner;
    const eliminatedPlayerId = resolution.eliminatedPlayerId;
    const eliminatedPlayer =
      eliminatedPlayerId &&
      players.find((p) => p.player_id === eliminatedPlayerId);

    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-orange-50 p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl p-8 space-y-6 text-center">

          <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-3" />

          <h1 className="text-3xl font-black text-gray-800">
            Round {gameState.round} Results 🏁
          </h1>

          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl text-left">
              <p className="font-bold text-gray-600 mb-2">Voting</p>
              <p className="text-sm">
                Most voted:{" "}
                <b>{mostVotedPlayer?.name ?? "No clear target"}</b>
              </p>
              <p className="text-sm">
                Actual Chameleon: <b>***</b>
              </p>

              <div className="mt-2 text-xs">
                <p>Vote counts:</p>
                {Object.entries(voteCounts).map(([pid, c]) => {
                  const pl = players.find((p) => p.player_id === pid);
                  return (
                    <p key={pid}>
                      {pl?.name ?? "Player"} — {c} vote(s)
                    </p>
                  );
                })}
              </div>

              {eliminatedPlayer && !roundWinner && (
                <p className="mt-2 text-xs text-red-600">
                  Eliminated this round: <b>{eliminatedPlayer.name}</b>
                </p>
              )}
            </div>

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl text-left">
              <p className="font-bold text-gray-600 mb-2">Chameleon’s Guess</p>
              <p className="text-sm">
                Secret word: 
                <b>
                  {isImposter && !roundWinner ? "Hidden" : gameState.targetWord}
                </b>
              </p>
              <p className="text-sm">
                Guess: <b>{gameState.imposterGuess ?? "No guess"}</b>
              </p>

              <div className="mt-3 text-lg font-black">
                {roundWinner === "imposter" ? (
                  <span className="text-purple-600">Chameleon Wins! 🦎</span>
                ) : roundWinner === "players" ? (
                  <span className="text-green-600">Players Win! 🎉</span>
                ) : (
                  <span className="text-gray-700">
                    No winner yet, game continues…
                  </span>
                )}
              </div>

              {!roundWinner && (
                <p className="mt-2 text-xs text-gray-500">
                  Active players for next round:{" "}
                  {resolution.nextActivePlayers
                    .map(
                      (id) => players.find((p) => p.player_id === id)?.name ?? "Player"
                    )
                    .join(", ")}
                </p>
              )}
            </div>
          </div>

          {/* Buttons */}
          {roundWinner ? (
            <button
              onClick={onEndGame}
              className="mt-6 w-full bg-green-600 text-white py-3 rounded-2xl"
            >
              Back to Lobby
            </button>
          ) : (
            isHost && (
              <button
                onClick={handleNextRound}
                className="mt-6 w-full bg-blue-600 text-white py-3 rounded-2xl"
              >
                Start Next Round (Round {gameState.round + 1})
              </button>
            )
          )}
        </div>
      </div>
    );
  }

  // fallback
  return <p className="text-center mt-10">Loading Chameleon...</p>;
}
