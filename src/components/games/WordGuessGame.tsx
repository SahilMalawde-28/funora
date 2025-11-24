import { useEffect, useState, useMemo } from "react";
import { Room, Player } from "../../lib/supabase";
import { WordGuessGameState, generateWordHint } from "../../lib/gameLogic";
import {
  Lightbulb,
  Zap,
  Heart,
  Eye,
  HelpCircle,
  Timer,
  Trophy,
  Crown,
  Users,
  Sparkles,
} from "lucide-react";

interface WordGuessGameProps {
  room: Room;
  players: Player[];
  currentPlayer: Player;
  gameState: WordGuessGameState;
  onUpdateState: (newState: Partial<WordGuessGameState>) => void;
  onEndGame: () => void;
}

// Local mirror of powerup type (to avoid extra imports)
type Power =
  | "MISGUIDE"
  | "PEEK"
  | "HINT"
  | "LETTER_DROP"
  | "EXTRA_LIFE"
  | "OP";

export default function WordGuessGame({
  room,
  players,
  currentPlayer,
  gameState,
  onUpdateState,
  onEndGame,
}: WordGuessGameProps) {
  const myId = currentPlayer.player_id;
  const isHost = room.host_id === myId;

  const myState = gameState.players[myId];

  // Local grid for editing (so we don't spam Supabase on every keystroke)
  const [localGrid, setLocalGrid] = useState<string[]>([]);
  // Timers
  const [powerTimer, setPowerTimer] = useState(10);
  const [lettersTimer, setLettersTimer] = useState(20);

  // Powerup UI state
  const [pendingPower, setPendingPower] = useState<Power | null>(null);
  const [powerTargetId, setPowerTargetId] = useState<string | null>(null);

  // Peek powerup – temporarily show another player's grid
  const [peekTargetId, setPeekTargetId] = useState<string | null>(null);

  // LETTER_DROP & OP local reveals
  const [droppedLetter, setDroppedLetter] = useState<string | null>(null);
  const [opJumble, setOpJumble] = useState<string | null>(null);

  // Keep localGrid synced with server state when gameState/myState changes
  useEffect(() => {
    if (!myState) return;
    const wordLen = gameState.targetWord.length;
    const base: string[] = new Array(wordLen).fill("");

    // Copy current server grid letters into local grid
    myState.grid.forEach((ch, idx) => {
      if (ch) base[idx] = ch.toUpperCase();
    });
    setLocalGrid(base);
  }, [myState, gameState.targetWord]);

  // POWERUP TIMER (10s visual only)
  useEffect(() => {
    if (gameState.phase !== "powerup") return;
    setPowerTimer(10);
    const id = setInterval(() => {
      setPowerTimer((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [gameState.phase, gameState.round]);

  // LETTERS TIMER (20s visual only)
  useEffect(() => {
    if (gameState.phase !== "letters") return;
    setLettersTimer(20);
    const id = setInterval(() => {
      setLettersTimer((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [gameState.phase, gameState.round]);

  // PEEK: auto-hide after 3 seconds
  useEffect(() => {
    if (!peekTargetId) return;
    const id = setTimeout(() => setPeekTargetId(null), 3000);
    return () => clearTimeout(id);
  }, [peekTargetId]);

  if (!myState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 flex items-center justify-center">
        <p>Loading WordGrid Battle...</p>
      </div>
    );
  }

  const wordLen = gameState.targetWord.length;
  const targetWord = gameState.targetWord.toUpperCase();

  // Helpers
  const findPlayer = (id: string) =>
    players.find((p) => p.player_id === id) || null;

  const otherPlayers = players.filter((p) => p.player_id !== myId);

  const alivePlayersIds = useMemo(
    () =>
      Object.entries(gameState.players)
        .filter(([, st]) => !st.eliminated && st.hearts > 0)
        .map(([pid]) => pid),
    [gameState.players]
  );

  const myAlive = !myState.eliminated && myState.hearts > 0;

  // ========================
  // ROUND & HOST CONTROLS
  // ========================

  const handleHostNextRound = () => {
    if (!isHost) return;
    if (gameState.phase !== "letters") return;
    if (gameState.winnerId) return;

    const newRound = gameState.round + 1;
    const newPlayers = { ...gameState.players };

    // After every 2 completed rounds, unlock one new correct letter per alive player
    const shouldUnlock =
      newRound > 1 && newRound % 2 === 1; // e.g. 3, 5, 7...

    if (shouldUnlock) {
      Object.entries(newPlayers).forEach(([pid, st]) => {
        if (st.eliminated || st.hearts <= 0) return;
        const unlockedPositions: number[] = [];
        for (let i = 0; i < wordLen; i++) {
          if (!st.locked[i]) unlockedPositions.push(i);
        }
        if (unlockedPositions.length === 0) return;
        const idx =
          unlockedPositions[Math.floor(Math.random() * unlockedPositions.length)];
        const updatedGrid = [...st.grid];
        const updatedLocked = [...st.locked];
        updatedGrid[idx] = targetWord[idx];
        updatedLocked[idx] = true;
        newPlayers[pid] = {
          ...st,
          grid: updatedGrid,
          locked: updatedLocked,
          placedThisRound: false,
          usedPowerupThisRound: false,
        };
      });
    } else {
      // Just reset per-round flags
      Object.entries(newPlayers).forEach(([pid, st]) => {
        newPlayers[pid] = {
          ...st,
          placedThisRound: false,
          usedPowerupThisRound: false,
        };
      });
    }

    onUpdateState({
      round: newRound,
      phase: "powerup",
      players: newPlayers,
    });
  };

  const handleHostStartLettersPhase = () => {
    if (!isHost) return;
    if (gameState.phase !== "powerup") return;
    onUpdateState({
      phase: "letters",
    });
  };

  // ==================
  // POWERUP LOGIC
  // ==================

  const hasPowerupsLeft = myState.powerups && myState.powerups.length > 0;

  const powerupDisabled =
    !myAlive ||
    gameState.phase !== "powerup" ||
    gameState.winnerId !== null ||
    powerTimer === 0 ||
    myState.usedPowerupThisRound ||
    !hasPowerupsLeft;

  const powerLabels: Record<Power, { label: string; desc: string; emoji: string }> =
    {
      MISGUIDE: {
        label: "Misguide",
        desc: "Next correct letter of a target counts as wrong once.",
        emoji: "🎭",
      },
      PEEK: {
        label: "Peek",
        desc: "Glance at someone’s grid for 3 seconds.",
        emoji: "👁",
      },
      HINT: {
        label: "Hint",
        desc: "Unlock an extra cryptic hint.",
        emoji: "💡",
      },
      LETTER_DROP: {
        label: "Letter Drop",
        desc: "Reveal a letter from the word (no position).",
        emoji: "🔤",
      },
      EXTRA_LIFE: {
        label: "Extra Life",
        desc: "Gain +1 heart (max capped).",
        emoji: "❤️",
      },
      OP: {
        label: "OP Jumble",
        desc: "See the full word jumbled once.",
        emoji: "⚡",
      },
    };

  const consumePowerFromMe = (p: Power) => {
    const myPowers = [...myState.powerups] as Power[];
    const idx = myPowers.indexOf(p);
    if (idx >= 0) {
      myPowers.splice(idx, 1);
    }
    return myPowers;
  };

  const applyMisguideOnTarget = (targetId: string) => {
    const target = gameState.players[targetId];
    if (!target) return;

    const updatedPlayers = {
      ...gameState.players,
      [targetId]: {
        ...target,
        misguideActive: true,
      },
      [myId]: {
        ...myState,
        powerups: consumePowerFromMe("MISGUIDE"),
        usedPowerupThisRound: true,
      },
    };

    onUpdateState({ players: updatedPlayers });
  };

  const handleUsePowerup = (p: Power) => {
    if (powerupDisabled) return;
    if (!myState.powerups.includes(p)) return;

    // Target-based powers: MISGUIDE & PEEK
    if (p === "MISGUIDE" || p === "PEEK") {
      const possibleTargets = alivePlayersIds.filter((id) => id !== myId);
      if (possibleTargets.length === 0) return;

      if (possibleTargets.length === 1) {
        executeTargetPowerup(p, possibleTargets[0]);
      } else {
        // Ask user to pick target
        setPendingPower(p);
        setPowerTargetId(null);
      }
      return;
    }

    // Non-target powers
    executeSelfPowerup(p);
  };

  const executeTargetPowerup = (p: Power, targetId: string) => {
    if (p === "MISGUIDE") {
      applyMisguideOnTarget(targetId);
      setPendingPower(null);
      setPowerTargetId(null);
      return;
    }

    if (p === "PEEK") {
      // Just local peek + consume power from me
      const updatedPlayers = {
        ...gameState.players,
        [myId]: {
          ...myState,
          powerups: consumePowerFromMe("PEEK"),
          usedPowerupThisRound: true,
        },
      };
      onUpdateState({ players: updatedPlayers });
      setPeekTargetId(targetId);
      setPendingPower(null);
      setPowerTargetId(null);
      return;
    }
  };

  const executeSelfPowerup = (p: Power) => {
    const maxHearts = gameState.maxHearts || 10;

    if (p === "HINT") {
      const allHints = gameState.hints || [];
      const current = new Set(myState.hintIndices || []);
      const available: number[] = [];
      for (let i = 0; i < allHints.length; i++) {
        if (!current.has(i)) available.push(i);
      }
      if (available.length === 0) {
        // nothing new to unlock
        return;
      }
      const idx =
        available[Math.floor(Math.random() * available.length)];
      const newIndices = [...(myState.hintIndices || []), idx];

      const updatedPlayers = {
        ...gameState.players,
        [myId]: {
          ...myState,
          hintIndices: newIndices,
          powerups: consumePowerFromMe("HINT"),
          usedPowerupThisRound: true,
        },
      };
      onUpdateState({ players: updatedPlayers });
      return;
    }

    if (p === "LETTER_DROP") {
      // Reveal a random letter from the word (no position), local only
      const indices = targetWord.split("").map((_, i) => i);
      const idx =
        indices[Math.floor(Math.random() * indices.length)];
      setDroppedLetter(targetWord[idx]);
      const updatedPlayers = {
        ...gameState.players,
        [myId]: {
          ...myState,
          powerups: consumePowerFromMe("LETTER_DROP"),
          usedPowerupThisRound: true,
        },
      };
      onUpdateState({ players: updatedPlayers });
      return;
    }

    if (p === "EXTRA_LIFE") {
      if (myState.hearts >= maxHearts) return;
      const updatedPlayers = {
        ...gameState.players,
        [myId]: {
          ...myState,
          hearts: myState.hearts + 1,
          powerups: consumePowerFromMe("EXTRA_LIFE"),
          usedPowerupThisRound: true,
        },
      };
      onUpdateState({ players: updatedPlayers });
      return;
    }

    if (p === "OP") {
      // Show jumbled word locally
      const chars = targetWord.split("");
      for (let i = chars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]];
      }
      setOpJumble(chars.join(""));
      const updatedPlayers = {
        ...gameState.players,
        [myId]: {
          ...myState,
          opSeenJumble: true,
          powerups: consumePowerFromMe("OP"),
          usedPowerupThisRound: true,
        },
      };
      onUpdateState({ players: updatedPlayers });
      return;
    }
  };

  // ======================
  // LETTER INPUT + SUBMIT
  // ======================

  const handleGridInput = (index: number, value: string) => {
    if (!myAlive) return;
    if (gameState.phase !== "letters") return;
    if (myState.locked[index]) return; // can't edit locked letters

    const v = value.toUpperCase().replace(/[^A-Z]/g, "");
    const next = [...localGrid];
    next[index] = v.slice(-1); // only last char
    setLocalGrid(next);
  };

  const handleSubmitLetters = () => {
    if (!myAlive) return;
    if (gameState.phase !== "letters") return;
    if (gameState.winnerId) return;

    let hearts = myState.hearts;
    let misguideActive = myState.misguideActive;
    const locked = [...myState.locked];
    const newGrid = [...myState.grid];
    let placedSomething = false;

    for (let i = 0; i < wordLen; i++) {
      if (locked[i]) continue;
      const inputChar = (localGrid[i] || "").toUpperCase();
      if (!inputChar) continue;

      placedSomething = true;

      if (inputChar === targetWord[i]) {
        if (misguideActive) {
          // Correct but misguided → treat as wrong once (no reveal, lose heart)
          hearts -= 1;
          misguideActive = false;
          newGrid[i] = null;
          const tempLocal = [...localGrid];
          tempLocal[i] = "";
          setLocalGrid(tempLocal);
        } else {
          // correct placement
          newGrid[i] = targetWord[i];
          locked[i] = true;
        }
      } else {
        // wrong placement
        hearts -= 1;
        newGrid[i] = null;
        const tempLocal = [...localGrid];
        tempLocal[i] = "";
        setLocalGrid(tempLocal);
      }
    }

    if (!placedSomething) {
      // skip penalty
      hearts -= 1;
    }

    let eliminated = hearts <= 0;
    if (hearts < 0) hearts = 0;

    const updatedMe = {
      ...myState,
      grid: newGrid,
      locked,
      hearts,
      misguideActive: false, // consumed if it existed
      placedThisRound: true,
      eliminated,
    };

    // Check win condition: all letters locked
    const allLocked = locked.every((v) => v);
    const updatedPlayers = {
      ...gameState.players,
      [myId]: updatedMe,
    };

    let winnerId: string | null = gameState.winnerId || null;
    let phase: WordGuessGameState["phase"] = gameState.phase;

    if (!winnerId && allLocked && !eliminated) {
      winnerId = myId;
      phase = "reveal";
    } else if (!winnerId) {
      const stillAliveIds = Object.entries(updatedPlayers)
        .filter(([, st]) => !st.eliminated && st.hearts > 0)
        .map(([pid]) => pid);
      if (stillAliveIds.length === 1) {
        winnerId = stillAliveIds[0];
        phase = "reveal";
      }
    }

    const patch: Partial<WordGuessGameState> = {
      players: updatedPlayers,
    };
    if (winnerId && phase === "reveal") {
      patch.winnerId = winnerId;
      patch.phase = "reveal";
    }

    onUpdateState(patch);
  };

  // ======================
  // REVEAL / GAME OVER UI
  // ======================

  if (gameState.phase === "reveal" && gameState.winnerId) {
    const winner = findPlayer(gameState.winnerId);
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-slate-950 to-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-xl w-full bg-slate-950/80 rounded-3xl border border-indigo-500/60 shadow-2xl p-8 text-center space-y-5">
          <Trophy className="w-14 h-14 text-yellow-400 mx-auto" />
          <h1 className="text-3xl font-black tracking-wide">
            WordGrid Battle – Result
          </h1>
          <p className="text-lg text-slate-200">
            The word was{" "}
            <span className="font-extrabold text-indigo-300">
              {gameState.targetWord.toUpperCase()}
            </span>
          </p>
          <p className="text-base text-slate-300">
            Winner:{" "}
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-300">
              <Crown className="w-4 h-4" />
              {winner?.name ?? "Unknown"}
            </span>
          </p>

          <button
            onClick={onEndGame}
            className="mt-4 w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 font-bold shadow-lg hover:shadow-xl hover:scale-105 transition"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  // ======================
  // MAIN IN-GAME UI
  // ======================

  // Hints visible to me (indexes from myState.hintIndices)
  const myHints =
    (myState.hintIndices || [])
      .sort((a, b) => a - b)
      .map((idx) => generateWordHint(gameState.targetWord, idx)) || [];

  const phaseText =
    gameState.phase === "powerup"
      ? "Powerup time – use at most one before the round starts."
      : gameState.phase === "letters"
      ? "Place letters carefully. Wrong or skipped → lose hearts."
      : "";

  const phaseBadge =
    gameState.phase === "powerup" ? "Powerup Phase" : "Letter Phase";

  // render hearts as icons
  const renderHearts = (count: number) => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push(<Heart key={i} className="w-3 h-3 fill-red-500 text-red-500" />);
    }
    return <div className="flex gap-0.5">{arr}</div>;
  };

  const myPowerups = myState.powerups as Power[];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 flex flex-col">
      {/* PEEK MODAL */}
      {peekTargetId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40 p-3">
          <div className="max-w-md w-full bg-slate-950 rounded-3xl border border-indigo-500/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-indigo-300" />
              <p className="text-sm font-semibold">
                Sneak Peek – {findPlayer(peekTargetId)?.name}
              </p>
            </div>
            <p className="text-xs text-slate-400">
              You can see their current grid for 3 seconds. Remember it.
            </p>
            <div className="flex flex-wrap justify-center gap-1">
              {gameState.players[peekTargetId].grid.map((ch, idx) => (
                <div
                  key={idx}
                  className="w-8 h-10 md:w-10 md:h-12 rounded-xl border border-slate-600 bg-slate-900 flex items-center justify-center text-sm md:text-base font-bold"
                >
                  {ch ? ch.toUpperCase() : ""}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* OP / LETTER DROP small banner */}
      {(droppedLetter || opJumble) && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30">
          <div className="bg-slate-950/90 border border-indigo-500/60 rounded-2xl px-4 py-2 flex items-center gap-3 text-xs">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            {droppedLetter && (
              <span>
                Letter Drop: the word contains{" "}
                <span className="font-bold text-yellow-300">
                  {droppedLetter}
                </span>
              </span>
            )}
            {opJumble && (
              <span>
                OP Jumble:{" "}
                <span className="font-mono font-bold text-emerald-300">
                  {opJumble}
                </span>
              </span>
            )}
            <button
              onClick={() => {
                setDroppedLetter(null);
                setOpJumble(null);
              }}
              className="ml-2 text-slate-400 hover:text-slate-200 text-[10px]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Target Selection Overlay for MISGUIDE/PEEK */}
      {pendingPower && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-3">
          <div className="bg-slate-950 rounded-3xl border border-slate-700 p-4 max-w-sm w-full space-y-3">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              Choose a target for {powerLabels[pendingPower].label}
            </p>
            <p className="text-xs text-slate-400">
              Only alive players can be targeted.
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {alivePlayersIds
                .filter((id) => id !== myId)
                .map((id) => {
                  const p = findPlayer(id);
                  if (!p) return null;
                  return (
                    <button
                      key={id}
                      onClick={() => executeTargetPowerup(pendingPower, id)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs"
                    >
                      <span>{p.name}</span>
                      <span className="text-[10px] text-slate-400">
                        Hearts: {gameState.players[id].hearts}
                      </span>
                    </button>
                  );
                })}
            </div>
            <button
              onClick={() => {
                setPendingPower(null);
                setPowerTargetId(null);
              }}
              className="w-full mt-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* TOP HEADER */}
      <div className="p-3 border-b border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-indigo-600/80 flex items-center justify-center shadow-lg">
              <Lightbulb className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-black tracking-wide">
                WordGrid Battle
              </h1>
              <p className="text-xs text-slate-400">
                Guess the word. Survive the hearts. Outsmart with powerups.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center justify-end text-[11px]">
            <div className="px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700 flex items-center gap-2">
              <Users className="w-3 h-3 text-slate-300" />
              <span>Players: {players.length}</span>
              <span className="text-slate-500">|</span>
              <span>Round {gameState.round}</span>
            </div>
            <div className="px-3 py-1 rounded-full bg-indigo-900/70 border border-indigo-500/60 text-indigo-100 flex items-center gap-2">
              <Zap className="w-3 h-3" />
              <span>{phaseBadge}</span>
              {gameState.phase === "powerup" && (
                <span className="flex items-center gap-1 text-[10px]">
                  <Timer className="w-3 h-3" /> {powerTimer}s
                </span>
              )}
              {gameState.phase === "letters" && (
                <span className="flex items-center gap-1 text-[10px]">
                  <Timer className="w-3 h-3" /> {lettersTimer}s
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN BODY */}
      <div className="flex-1 p-3">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* LEFT: YOUR GRID & HEARTS */}
          <div className="lg:col-span-2 space-y-3">
            <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">You</p>
                  <p className="text-sm font-semibold">
                    {currentPlayer.name}{" "}
                    {!myAlive && (
                      <span className="ml-1 text-red-400 text-[11px]">
                        (Eliminated)
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-xs">
                    <Heart className="w-3 h-3 text-red-400" />
                    <span>{myState.hearts}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <HelpCircle className="w-3 h-3 text-indigo-300" />
                    <span>
                      Locked:{" "}
                      {
                        myState.locked.filter((v: boolean) => v === true)
                          .length
                      }
                      /{wordLen}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400">{phaseText}</p>

              {/* WORD GRID */}
              <div className="flex flex-wrap gap-1 justify-center md:justify-start">
                {Array.from({ length: wordLen }).map((_, idx) => {
                  const isLocked = myState.locked[idx];
                  const val = isLocked
                    ? (myState.grid[idx] || "").toUpperCase()
                    : localGrid[idx] || "";

                  return (
                    <div
                      key={idx}
                      className={`w-10 h-12 md:w-12 md:h-14 rounded-2xl border flex items-center justify-center text-lg font-black tracking-widest ${
                        isLocked
                          ? "bg-emerald-900/70 border-emerald-500/70 text-emerald-100"
                          : "bg-slate-900 border-slate-700 text-slate-100"
                      }`}
                    >
                      {isLocked ? (
                        val
                      ) : (
                        <input
                          value={val}
                          maxLength={1}
                          onChange={(e) =>
                            handleGridInput(idx, e.target.value)
                          }
                          disabled={
                            !myAlive || gameState.phase !== "letters"
                          }
                          className="w-full h-full text-center bg-transparent outline-none text-lg font-black uppercase"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* SUBMIT BUTTON */}
              <div className="flex justify-end">
                <button
                  onClick={handleSubmitLetters}
                  disabled={
                    !myAlive ||
                    gameState.phase !== "letters" ||
                    !!gameState.winnerId
                  }
                  className="px-4 py-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-xs md:text-sm font-semibold shadow-md hover:shadow-lg hover:scale-[1.02] transition disabled:opacity-40"
                >
                  Lock Letters for this Round
                </button>
              </div>
            </div>

            {/* HINTS BOX */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <Lightbulb className="w-3 h-3 text-yellow-300" /> Your
                  Hints
                </p>
                <p className="text-[10px] text-slate-500">
                  You’ll unlock more with Hint powerup.
                </p>
              </div>
              {myHints.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  No hints unlocked yet. Try using the Hint powerup.
                </p>
              ) : (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {myHints.map((h, idx) => (
                    <div
                      key={idx}
                      className="text-[11px] bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5"
                    >
                      <span className="font-semibold text-indigo-300">
                        #{idx + 1}:{" "}
                      </span>
                      <span className="text-slate-200">{h}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: POWERUPS + OPPONENT SUMMARY */}
          <div className="space-y-3">
            {/* POWERUPS */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-yellow-300" /> Powerups
                </p>
                <p className="text-[10px] text-slate-500">
                  Use at most one per round.
                </p>
              </div>
              {myPowerups.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  You’ve used all your powerups.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {myPowerups.map((p, idx) => {
                    const info = powerLabels[p];
                    return (
                      <button
                        key={p + idx}
                        disabled={powerupDisabled}
                        onClick={() => handleUsePowerup(p)}
                        className="flex-1 min-w-[120px] px-3 py-2 rounded-2xl bg-slate-900 border border-slate-700 hover:border-indigo-400 hover:bg-slate-800 text-left text-[11px] disabled:opacity-40"
                      >
                        <span className="flex items-center gap-1 mb-0.5">
                          <span>{info.emoji}</span>
                          <span className="font-semibold">{info.label}</span>
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {info.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {gameState.phase === "powerup" && (
                <p className="text-[10px] text-slate-500 mt-1">
                  Timer is just visual; host decides when to start the
                  letter phase.
                </p>
              )}
            </div>

            {/* OPPONENTS OVERVIEW */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-4 space-y-2">
              <p className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Users className="w-3 h-3 text-sky-300" /> Players Progress
              </p>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {players.map((p) => {
                  const st = gameState.players[p.player_id];
                  if (!st) return null;
                  const lockedCount = st.locked.filter((v) => v).length;
                  const me = p.player_id === myId;

                  return (
                    <div
                      key={p.player_id}
                      className={`flex items-center justify-between px-3 py-1.5 rounded-2xl text-[11px] ${
                        me
                          ? "bg-indigo-900/40 border border-indigo-500/50"
                          : "bg-slate-900/70 border border-slate-800"
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold">
                          {p.name}{" "}
                          {me && (
                            <span className="text-[9px] text-indigo-300 ml-1">
                              (You)
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Locked {lockedCount}/{wordLen}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Heart className="w-3 h-3 text-red-400" />
                          <span>{st.hearts}</span>
                        </div>
                        {st.eliminated && (
                          <span className="text-[9px] text-red-400">
                            OUT
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* HOST CONTROLS */}
            {isHost && !gameState.winnerId && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-3 space-y-2">
                <p className="text-[11px] font-semibold text-slate-300">
                  Host Controls
                </p>
                {gameState.phase === "powerup" && (
                  <button
                    onClick={handleHostStartLettersPhase}
                    className="w-full py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-indigo-500/60 text-xs font-semibold"
                  >
                    Start Letter Phase
                  </button>
                )}
                {gameState.phase === "letters" && (
                  <button
                    onClick={handleHostNextRound}
                    className="w-full py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-600 text-xs font-semibold"
                  >
                    End Round &amp; Next (may unlock new letter)
                  </button>
                )}
                <p className="text-[10px] text-slate-500">
                  You control when rounds change so people don’t get
                  scammed by lag.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
