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

  const [localGrid, setLocalGrid] = useState<string[]>([]);
  const [powerTimer, setPowerTimer] = useState(10);
  const [lettersTimer, setLettersTimer] = useState(20);

  const [pendingPower, setPendingPower] = useState<Power | null>(null);
  const [peekTargetId, setPeekTargetId] = useState<string | null>(null);

  const [droppedLetter, setDroppedLetter] = useState<string | null>(null);
  const [opJumble, setOpJumble] = useState<string | null>(null);

  // ---------------------------
  // SYNC LOCAL GRID
  // ---------------------------
  useEffect(() => {
    if (!myState) return;
    const wordLen = gameState.targetWord.length;
    const base = Array(wordLen).fill("");

    myState.grid.forEach((c, i) => {
      if (c) base[i] = c.toUpperCase();
    });

    setLocalGrid(base);
  }, [myState, gameState.targetWord]);

  // ---------------------------
  // POWERUP TIMER
  // ---------------------------
  useEffect(() => {
    if (gameState.phase !== "powerup") return;
    setPowerTimer(10);

    const id = setInterval(() => {
      setPowerTimer((t) => {
        if (t <= 1) {
          clearInterval(id);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [gameState.phase, gameState.round]);

  // ---------------------------
  // LETTERS TIMER (+ AUTO PENALTY)
  // ---------------------------
  useEffect(() => {
    if (gameState.phase !== "letters") return;

    setLettersTimer(20);
    onUpdateState({ lettersTimeUp: false });

    const id = setInterval(() => {
      setLettersTimer((t) => {
        if (t <= 1) {
          clearInterval(id);

          // TIME UP
          onUpdateState({ lettersTimeUp: true });

          // AUTO -1 HEART PENALTY
          const st = gameState.players[myId];
          if (st && !st.eliminated) {
            const newHearts = Math.max(0, st.hearts - 1);
            const eliminated = newHearts <= 0;

            onUpdateState({
              players: {
                ...gameState.players,
                [myId]: {
                  ...st,
                  hearts: newHearts,
                  eliminated,
                  placedThisRound: false,
                },
              },
            });
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [gameState.phase, gameState.round]);
  // ---------------------------
  // FINDERS & MEMOS
  // ---------------------------
  const wordLen = gameState.targetWord.length;
  const targetWord = gameState.targetWord.toUpperCase();

  const findPlayer = (id: string) =>
    players.find((p) => p.player_id === id) || null;

  const aliveIds = useMemo(
    () =>
      Object.entries(gameState.players)
        .filter(([, st]) => !st.eliminated && st.hearts > 0)
        .map(([id]) => id),
    [gameState.players]
  );

  const myAlive = !myState.eliminated && myState.hearts > 0;

  // ---------------------------
  // HANDLE LETTER INPUT
  // ---------------------------
  const handleGridInput = (idx: number, v: string) => {
    if (!myAlive) return;
    if (gameState.phase !== "letters") return;
    if (gameState.lettersTimeUp) return;
    if (myState.locked[idx]) return;

    const c = v.toUpperCase().replace(/[^A-Z]/g, "");
    const next = [...localGrid];
    next[idx] = c.slice(-1);
    setLocalGrid(next);
  };

  // ---------------------------
  // SUBMIT LETTERS
  // ---------------------------
  const handleSubmit = () => {
    if (!myAlive) return;
    if (gameState.phase !== "letters") return;
    if (gameState.lettersTimeUp) return; // prevent cheating
    if (gameState.winnerId) return;

    let hearts = myState.hearts;
    let misguide = myState.misguideActive;
    const locked = [...myState.locked];
    const newGrid = [...myState.grid];

    let placed = false;

    for (let i = 0; i < wordLen; i++) {
      if (locked[i]) continue;
      const input = (localGrid[i] || "").toUpperCase();
      if (!input) continue;

      placed = true;

      if (input === targetWord[i]) {
        if (misguide) {
          hearts -= 1;
          misguide = false;
          newGrid[i] = null;
          localGrid[i] = "";
        } else {
          newGrid[i] = targetWord[i];
          locked[i] = true;
        }
      } else {
        hearts -= 1;
        newGrid[i] = null;
        localGrid[i] = "";
      }
    }

    if (!placed) {
      // didn’t play → penalty
      hearts -= 1;
    }

    const eliminated = hearts <= 0;

    const updatedMy = {
      ...myState,
      grid: newGrid,
      locked,
      hearts: Math.max(0, hearts),
      eliminated,
      misguideActive: false,
      placedThisRound: true,
    };

    let winnerId: string | null = gameState.winnerId || null;

    if (!winnerId && locked.every((v) => v) && !eliminated) {
      winnerId = myId;
    } else if (!winnerId) {
      const alive = Object.entries({
        ...gameState.players,
        [myId]: updatedMy,
      })
        .filter(([, st]) => !st.eliminated && st.hearts > 0)
        .map(([id]) => id);
      if (alive.length === 1) {
        winnerId = alive[0];
      }
    }

    const patch: Partial<WordGuessGameState> = {
      players: {
        ...gameState.players,
        [myId]: updatedMy,
      },
    };

    if (winnerId) patch.winnerId = winnerId;
    if (winnerId) patch.phase = "reveal";

    onUpdateState(patch);
  };

  // ---------------------------
  // REVEAL SCREEN
  // ---------------------------
  if (gameState.phase === "reveal" && gameState.winnerId) {
    const w = findPlayer(gameState.winnerId);
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-100 bg-slate-950">
        <div className="p-6 rounded-3xl bg-slate-900 border border-indigo-600 text-center space-y-4">
          <Trophy className="w-12 h-12 text-yellow-400 mx-auto" />
          <p className="text-xl font-bold">Winner: {w?.name}</p>
          <p className="text-sm">
            The word was{" "}
            <span className="font-bold text-indigo-300">
              {targetWord}
            </span>
          </p>
          <button
            onClick={onEndGame}
            className="px-4 py-2 bg-indigo-600 rounded-xl"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------
  // HINTS PREPARATION
  // ---------------------------
  const allHintsArray = gameState.hints || [];
  let myHints: string[] = [];

  if (myState.hintIndices?.length > 0) {
    myHints = myState.hintIndices.map((i) =>
      generateWordHint(gameState.targetWord, i)
    );
  } else if (allHintsArray.length > 0) {
    myHints = [allHintsArray[0]];
  }

  const phaseText =
    gameState.phase === "powerup"
      ? "Use one powerup before letters."
      : gameState.phase === "letters"
      ? "Fill letters. Wrong or skip = minus heart."
      : "";

  const myPowerups = myState.powerups;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 flex flex-col">

      {/* HEADER */}
      <div className="p-3 border-b border-slate-800">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <h1 className="text-xl font-black flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-300" />
            WordGrid Battle
          </h1>

          <div className="text-xs flex gap-2">
            <span>Round {gameState.round}</span>
            <span>•</span>
            <span>
              {gameState.phase === "powerup" ? "Powerups" : "Letters"}
            </span>
            {gameState.phase === "letters" && (
              <span className="flex items-center gap-1 text-indigo-300">
                <Timer className="w-3 h-3" />
                {lettersTimer}s
              </span>
            )}
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 max-w-4xl mx-auto p-4 grid grid-cols-3 gap-3">

        {/* LEFT — GRID */}
        <div className="col-span-2 bg-slate-950/70 rounded-3xl p-4 space-y-4 border border-slate-800">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{currentPlayer.name}</p>
            <div className="flex items-center gap-2 text-xs">
              <Heart className="w-3 h-3 text-red-400" /> {myState.hearts}
            </div>
          </div>

          <p className="text-[11px] text-slate-400">{phaseText}</p>

          {/* GRID */}
          <div className="flex gap-1 flex-wrap">
            {Array.from({ length: wordLen }).map((_, idx) => {
              const locked = myState.locked[idx];
              const val = locked
                ? myState.grid[idx]
                : localGrid[idx] || "";

              const disabled =
                !myAlive ||
                gameState.phase !== "letters" ||
                gameState.lettersTimeUp;

              return (
                <div
                  key={idx}
                  className={`w-10 h-12 rounded-xl flex items-center justify-center border 
                    ${
                      locked
                        ? "bg-emerald-900/60 border-emerald-500 text-emerald-100"
                        : "bg-slate-900 border-slate-700"
                    }`}
                >
                  {locked ? (
                    val
                  ) : (
                    <input
                      value={val}
                      disabled={disabled}
                      maxLength={1}
                      onChange={(e) =>
                        handleGridInput(idx, e.target.value)
                      }
                      className="w-full h-full text-center bg-transparent text-lg font-bold"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* SUBMIT */}
          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={
                !myAlive ||
                gameState.phase !== "letters" ||
                gameState.lettersTimeUp
              }
              className="px-4 py-2 bg-indigo-600 rounded-xl text-xs disabled:opacity-30"
            >
              Lock Letters
            </button>
          </div>

          {/* HINTS */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1">
              <Lightbulb className="w-3 h-3 text-yellow-300" /> Hints
            </p>
            {myHints.map((h, i) => (
              <p key={i} className="text-[11px] text-slate-300">
                • {h}
              </p>
            ))}
          </div>
        </div>

        {/* RIGHT — POWERUPS + PLAYERS */}
        <div className="space-y-3">

          {/* POWERUPS */}
          <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1">
              <Zap className="w-3 h-3 text-yellow-300" /> Powerups
            </p>

            {myPowerups.length === 0 ? (
              <p className="text-[11px] text-slate-500">No powerups left.</p>
            ) : (
              <div className="space-y-1">
                {myPowerups.map((p, i) => (
                  <div
                    key={i}
                    className="text-[11px] bg-slate-900 border border-slate-700 rounded-xl p-2"
                  >
                    {p}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PLAYERS */}
          <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1">
              <Users className="w-3 h-3 text-sky-300" /> Players
            </p>

            {players.map((p) => {
              const st = gameState.players[p.player_id];
              const locked = st.locked.filter(Boolean).length;

              return (
                <div
                  key={p.player_id}
                  className="flex justify-between text-[11px] bg-slate-900/70 p-2 rounded-xl border border-slate-700"
                >
                  <span>{p.name}</span>
                  <span>
                    {locked}/{wordLen} | ❤️ {st.hearts}
                    {st.eliminated && (
                      <span className="text-red-400 ml-1">OUT</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {/* HOST CONTROLS */}
          {isHost && !gameState.winnerId && (
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <p className="text-xs font-semibold">Host Controls</p>

              {gameState.phase === "powerup" && (
                <button
                  onClick={() => onUpdateState({ phase: "letters" })}
                  className="w-full py-2 bg-indigo-700 rounded-xl text-xs"
                >
                  Start Letters
                </button>
              )}

              {gameState.phase === "letters" && (
                <button
                  onClick={() => {
                    onUpdateState({
                      round: gameState.round + 1,
                      phase: "powerup",
                      lettersTimeUp: false,
                    });
                  }}
                  className="w-full py-2 bg-slate-700 rounded-xl text-xs"
                >
                  End Round
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
