import { useEffect, useState } from "react";
import { Room, Player } from "../../lib/supabase";
import { Flame, Sparkles, Trophy } from "lucide-react";

interface BoilingWaterState {
  round: number;
  phase: "answer" | "reveal" | "result";
  answers: { [playerId: string]: number }; // selections
  scores: { [playerId: string]: number }; // heat (negative values)
  eliminated: string[]; // player_id
  hostId: string; // player_id of host
  commentary?: string;
  lastRound?: {
    avg: number | null;
    target: number | null;
    winnerId: string | null;
    penalties: { [playerId: string]: number } | null;
  } | null;
}

interface BoilingWaterProps {
  room: Room;
  players: Player[]; // players[].player_id used as keys
  currentPlayer: Player;
  gameState: BoilingWaterState;
  onUpdateState: (newState: Partial<BoilingWaterState>) => void;
  onEndGame: () => void;
}

export default function BoilingWater({
  room,
  players,
  currentPlayer,
  gameState,
  onUpdateState,
  onEndGame,
}: BoilingWaterProps) {
  // local selection state only for UI responsiveness
  const [localChoice, setLocalChoice] = useState<number | null>(null);

  // protect against missing gameState fields
  const round = gameState?.round ?? 1;
  const phase = gameState?.phase ?? "answer";
  const answers = gameState?.answers ?? {};
  const scores = gameState?.scores ?? {};
  const eliminated = gameState?.eliminated ?? [];
  const hostId = gameState?.hostId ?? room?.host_id ?? "";
  const commentary = gameState?.commentary ?? "";
  const lastRound = gameState?.lastRound ?? null;

  const myId = currentPlayer.player_id;
  const isHost = myId === hostId;

  // active players' ids (not eliminated)
  const activePlayerIds = players
    .filter((p) => !eliminated.includes(p.player_id))
    .map((p) => p.player_id);

  const hasSubmitted = answers[myId] !== undefined;
  const activeSubmittedCount = activePlayerIds.filter((id) => answers[id] !== undefined).length;
  const allActiveSubmitted = activePlayerIds.length > 0 && activeSubmittedCount === activePlayerIds.length;

  // keep localChoice synced if already answered
  useEffect(() => {
    if (answers[myId] !== undefined) setLocalChoice(answers[myId]);
  }, [answers, myId]);

  // BUTTON: player submits their choice (writes to shared gameState)
  const handleSubmit = () => {
    if (localChoice === null) return;
    // avoid overwriting if server already saved it
    if (answers[myId] !== undefined) return;
    const newAnswers = { ...answers, [myId]: localChoice };
    onUpdateState({ answers: newAnswers });
  };

  // Host: move to reveal phase
  const handleReveal = () => {
    if (!isHost) return;
    // It's okay if not everyone submitted — host still allowed to reveal,
    // but it's better UX to warn. We'll still allow reveal.
    onUpdateState({ phase: "reveal" });
  };

  // Host: finalize (compute avg, target, winner, apply penalties and eliminations)
  const handleFinalize = () => {
    if (!isHost) return;

    // compute participants for this round (alive players)
    const alive = activePlayerIds.slice();
    if (alive.length === 0) return;

    // build list of valid answers (those alive and have chosen)
    const valid = alive
      .filter((pid) => answers[pid] !== undefined)
      .map((pid) => ({ pid, val: answers[pid] as number }));

    if (valid.length === 0) {
      // no answers to evaluate
      onUpdateState({
        commentary: "No answers submitted — nothing changes this round.",
        lastRound: { avg: null, target: null, winnerId: null, penalties: null },
        phase: "result",
      });
      return;
    }

    const avg = valid.reduce((s, v) => s + v.val, 0) / valid.length;
    const targetFloat = avg * 0.8;
    const target = Math.round(targetFloat);

    // find closest to target (tie-breaker: first encountered)
    let winnerId: string | null = null;
    let bestDiff = Infinity;
    valid.forEach((v) => {
      const d = Math.abs(v.val - target);
      if (d < bestDiff) {
        bestDiff = d;
        winnerId = v.pid;
      }
    });

    // base penalties: everyone except winner gets -1
    const penalties: { [pid: string]: number } = {};
let roundComment = "";

// === NEW RULE: Duplicate answer rule for 4 or fewer alive ===
if (alive.length <= 4) {
  // group answers
  const answerGroups: { [val: number]: string[] } = {};
  valid.forEach((v) => {
    if (!answerGroups[v.val]) answerGroups[v.val] = [];
    answerGroups[v.val].push(v.pid);
  });

  // find duplicates
  const duplicateGroups = Object.entries(answerGroups).filter(([_, pids]) => pids.length > 1);
  if (duplicateGroups.length > 0) {
    duplicateGroups.forEach(([_, pids]) => {
      pids.forEach((pid) => {
        penalties[pid] = (penalties[pid] ?? 0) - 1;
      });
    });

    // commentary
    const dupPlayers = duplicateGroups
      .flatMap(([_, pids]) => pids)
      .map((id) => players.find((p) => p.player_id === id)?.name)
      .filter(Boolean)
      .join(", ");
    roundComment = `⚠️ ${dupPlayers} chose the same number! Each gets -1. Round ends immediately.`;

    // apply immediately and stop round
    const newScores = { ...scores };
    Object.entries(penalties).forEach(([pid, delta]) => {
      newScores[pid] = (newScores[pid] ?? 0) + delta;
    });

    // elimination check
    const newlyEliminated = Object.entries(newScores)
      .filter(([pid, sc]) => sc <= -6 && !eliminated.includes(pid))
      .map(([pid]) => pid);

    if (newlyEliminated.length > 0) {
      const names = newlyEliminated
        .map((id) => players.find((p) => p.player_id === id)?.name)
        .filter(Boolean)
        .join(", ");
      roundComment += ` 💀 ${names} reached -6 and got eliminated!`;
    }

    onUpdateState({
      phase: "result",
      scores: newScores,
      eliminated: [...eliminated, ...newlyEliminated],
      commentary: roundComment,
      lastRound: { avg: null, target: null, winnerId: null, penalties },
    });
    return; // 🔥 round ends here
  }
}

// === EXISTING LOGIC CONTINUES BELOW ===
valid.forEach((v) => {
  if (v.pid === winnerId) penalties[v.pid] = (penalties[v.pid] ?? 0) + 0;
  else penalties[v.pid] = (penalties[v.pid] ?? 0) - 1;
});

// rule: if 3 players alive -> exact guess(es) cause others -2
if (alive.length === 3) {
  const exactIds = valid.filter((v) => v.val === target).map((v) => v.pid);
  if (exactIds.length > 0) {
    valid.forEach((v) => {
      if (!exactIds.includes(v.pid)) penalties[v.pid] = (penalties[v.pid] ?? 0) - 1;
    });
    const names = exactIds
      .map((id) => players.find((p) => p.player_id === id)?.name)
      .filter(Boolean)
      .join(", ");
    roundComment = `💥 ${names} guessed the exact number ${target}! Everyone else gets -2.`;
  }
}

// rule: if 2 players alive -> 0 vs 100 rule
if (alive.length === 2) {
  const [a, b] = alive;
  const na = answers[a];
  const nb = answers[b];
  if ((na === 0 && nb === 100) || (na === 100 && nb === 0)) {
    const loser = na === 0 ? a : b;
    const win = na === 100 ? a : b;
    penalties[loser] = (penalties[loser] ?? 0) - 1;
    penalties[win] = (penalties[win] ?? 0) + 1;
    const loserName = players.find((p) => p.player_id === loser)?.name;
    roundComment = `⚔️ 100 beats 0 — ${loserName} takes an extra -1!`;
  }
}

// if no special comment set, use default closest comment
if (!roundComment && alive.length > 1) {
  const winnerName = players.find((p) => p.player_id === winnerId)?.name ?? "Someone";
  roundComment = `🔥 ${winnerName} was closest to ${target} (avg × 0.8). Others get -1.`;
}

// apply penalties to scores
const newScores = { ...scores };
Object.entries(penalties).forEach(([pid, delta]) => {
  newScores[pid] = (newScores[pid] ?? 0) + delta;
});

// determine newly eliminated (score <= -6)
const newlyEliminated = Object.entries(newScores)
  .filter(([pid, sc]) => sc <= -6 && !eliminated.includes(pid))
  .map(([pid]) => pid);

if (newlyEliminated.length > 0) {
  const names = newlyEliminated
    .map((id) => players.find((p) => p.player_id === id)?.name)
    .filter(Boolean)
    .join(", ");
  roundComment += ` 💀 ${names} reached -6 and got eliminated!`;
}

const lastRound = { avg, target, winnerId, penalties };

onUpdateState({
  phase: "result",
  scores: newScores,
  eliminated: [...eliminated, ...newlyEliminated],
  commentary: roundComment,
  lastRound,
});

  };

  // Host moves to next round: reset answers (keep scores & eliminated)
  const handleNextRound = () => {
    if (!isHost) return;

    // check for end condition
    const remaining = players.filter((p) => !([...(gameState?.eliminated ?? [])].includes(p.player_id)));
    if (remaining.length <= 1) {
      const winner = remaining[0];
      const finalText = winner ? `🏆 ${winner.name} survived the boiling water!` : "No survivors.";
      onUpdateState({ commentary: finalText });
      // call parent's end handler if you want game to end immediately:
      // onEndGame();
      return;
    }

    // reset answers for the next round only for non-eliminated players
    onUpdateState({
      round: (gameState.round ?? 1) + 1,
      phase: "answer",
      answers: {},
      commentary: "",
      lastRound: null,
    });
    setLocalChoice(null);
  };

  // small helpers
  const nameOf = (pid?: string | null) => pid ? players.find((p) => p.player_id === pid)?.name ?? "Unknown" : "—";

  // Number button component
  const NumberButton = ({ n }: { n: number }) => {
    const chosen = (localChoice === n) || answers[myId] === n;
    const disabled = eliminated.includes(myId) || phase !== "answer" || answers[myId] !== undefined;
    return (
      <button
        key={n}
        onClick={() => !disabled && setLocalChoice(n)}
        disabled={disabled}
        className={`rounded-md py-2 text-sm transition text-center ${chosen ? "bg-red-500 text-white font-bold shadow-md" : "bg-gray-800 hover:bg-gray-700 text-gray-200"}`}
        style={{ userSelect: "none" }}
      >
        {n}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-950 to-gray-900 text-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="text-3xl text-orange-500"><Flame /></div>
            <h1 className="text-3xl font-extrabold">Boiling Water — Round {round}</h1>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Host</div>
            <div className="font-semibold">{nameOf(hostId)}</div>
          </div>
        </div>

        {/* scoreboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {players.map((p) => {
            const isElim = eliminated.includes(p.player_id);
            const heat = scores[p.player_id] ?? 0;
            return (
              <div key={p.player_id} className={`p-4 rounded-xl border flex items-center justify-between ${isElim ? "border-gray-700 bg-gray-800/60 text-gray-400" : "border-orange-600 bg-gray-900"}`}>
                <div>
                  <div className="font-semibold text-lg">{p.name}</div>
                  <div className="text-sm text-gray-400">{isElim ? "Eliminated" : `Heat: ${heat}`}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-300">{p.avatar}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* phase panel */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          {/* ANSWER PHASE */}
          {phase === "answer" && (
            <>
              <p className="mb-4 text-gray-300">Pick a number from <b>0–100</b>. Target will be <span className="text-orange-400">avg × 0.8</span>.</p>

              <div className="grid grid-cols-10 gap-2 max-h-[320px] overflow-auto p-2 rounded-md bg-gray-800/30 mb-4">
                {Array.from({ length: 101 }).map((_, i) => <NumberButton n={i} key={i} />)}
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  {!hasSubmitted ? (
                    <button onClick={handleSubmit} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-md font-semibold" disabled={localChoice === null}>
                      Submit {localChoice !== null && `(${localChoice})`}
                    </button>
                  ) : (
                    <div className="text-green-400 font-semibold">✅ Submitted: {answers[myId]}</div>
                  )}
                </div>

                <div className="text-sm text-gray-400">
                  Active: <b>{activePlayerIds.length}</b> • Submitted: <b>{activeSubmittedCount}/{activePlayerIds.length}</b>
                </div>

                {isHost && (
                  <div className="flex items-center gap-2">
                    <button onClick={handleReveal} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-md font-semibold">
                      Reveal Answers
                    </button>
                    <button onClick={handleFinalize} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md font-semibold">
                      Force Result
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* REVEAL PHASE */}
          {phase === "reveal" && (
            <>
              <p className="mb-3 text-gray-300">Host has revealed choices — check them before finalizing.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {activePlayerIds.map((pid) => (
                  <div key={pid} className="p-3 bg-gray-800 rounded-md border border-gray-700">
                    <div className="text-sm text-gray-400">{nameOf(pid)}</div>
                    <div className="text-2xl font-bold text-orange-400">{answers[pid] ?? "—"}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-300">When ready, host finalizes round to apply penalties.</div>
                {isHost && (
                  <button onClick={handleFinalize} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md font-semibold">
                    Finalize Round
                  </button>
                )}
              </div>
            </>
          )}

          {/* RESULT PHASE */}
          {phase === "result" && (
            <>
              <div className="mb-4">
                <h3 className="text-xl font-bold text-green-400 flex items-center gap-2"><Sparkles /> Round Summary</h3>
                <div className="text-gray-300 mt-2">
                  <div><b>Average:</b> {lastRound?.avg !== null ? Math.round((lastRound.avg ?? 0) * 100) / 100 : "—"}</div>
                  <div><b>Target (avg × 0.8):</b> {lastRound?.target ?? "—"}</div>
                  <div><b>Winner:</b> {nameOf(lastRound?.winnerId ?? null)}</div>
                </div>
              </div>

              <div className="bg-gray-800/60 p-4 rounded-md mb-4 text-gray-200">
                {commentary ?? "No commentary."}
              </div>

              <div className="flex items-center justify-between">
                <div />
                {isHost && (
                  <button onClick={handleNextRound} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-semibold">
                    Next Round
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* footer */}
        <div className="mt-6 text-center text-gray-400">
          Tip: Host controls reveal & next-round to avoid sync issues — press reveal when you're satisfied with submissions.
        </div>
      </div>
    </div>
  );
}
