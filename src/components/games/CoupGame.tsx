import { useState } from "react";
import { Room, Player } from "../../lib/supabase";
import {
  CoupGameState,
  CoupPlayerState,
  CoupRole,
  CoupInfluence,
  shuffleC,
} from "../../lib/gameLogic";
import {
  Coins,
  Swords,
  Shield,
  UserCircle2,
  Crown,
  AlertTriangle,
  Shuffle,
  Users,
  Info,
} from "lucide-react";

interface CoupGameProps {
  room: Room;
  players: Player[];
  currentPlayer: Player;
  gameState: CoupGameState;
  onUpdateState: (patch: Partial<CoupGameState>) => void;
  onEndGame: () => void;
}

export default function CoupGame({
  room,
  players,
  currentPlayer,
  gameState,
  onUpdateState,
  onEndGame,
}: CoupGameProps) {
  const myId = currentPlayer.player_id;
  const isHost = room.host_id === myId;

  const [pendingTargetAction, setPendingTargetAction] = useState<
    | null
    | "assassinate"
    | "steal"
    | "coup"
  >(null);

  const myState = gameState.players[myId];

  const currentTurnPlayerId = gameState.turnOrder[gameState.currentTurnIndex];
  const currentTurnPlayerState = gameState.players[currentTurnPlayerId];

  const isMyTurn =
    gameState.phase === "choose_action" && currentTurnPlayerId === myId;

  const alivePlayers = gameState.turnOrder
    .map((pid) => gameState.players[pid])
    .filter((p) => p.alive);

  const findPlayer = (id: string) =>
    players.find((p) => p.player_id === id) || null;

  const addLog = (text: string) => {
    const log: CoupGameState["activityLog"] = [
      ...gameState.activityLog,
      {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        text,
        ts: Date.now(),
      },
    ];
    onUpdateState({ activityLog: log });
  };

  const getNextTurnIndex = (state: CoupGameState): number => {
    const { turnOrder, currentTurnIndex, players } = state;
    const len = turnOrder.length;
    let idx = currentTurnIndex;
    for (let i = 0; i < len; i++) {
      idx = (idx + 1) % len;
      const pid = turnOrder[idx];
      if (players[pid]?.alive) return idx;
    }
    return currentTurnIndex;
  };

  const checkGameOver = (state: CoupGameState): CoupGameState => {
    const aliveIds = Object.values(state.players)
      .filter((p) => p.alive)
      .map((p) => p.playerId);
    if (aliveIds.length === 1) {
      return {
        ...state,
        phase: "game_over",
        winnerId: aliveIds[0],
      };
    }
    return state;
  };

  const loseInfluence = (
    state: CoupGameState,
    playerId: string,
    influenceId: string
  ): CoupGameState => {
    const player = state.players[playerId];
    if (!player) return state;

    const newInfluences = player.influences.map((inf) =>
      inf.id === influenceId ? { ...inf, revealed: true } : inf
    );

    const stillAlive = newInfluences.some((inf) => !inf.revealed);

    const newPlayers = {
      ...state.players,
      [playerId]: {
        ...player,
        influences: newInfluences,
        alive: stillAlive,
      },
    };

    let newState: CoupGameState = {
      ...state,
      players: newPlayers,
      revealInfo: null,
      phase: "choose_action",
    };

    newState = checkGameOver(newState);

    if (newState.phase !== "game_over") {
      newState.currentTurnIndex = getNextTurnIndex(newState);
    }

    return newState;
  };

  const applyCoinsChange = (
    state: CoupGameState,
    playerId: string,
    delta: number
  ): CoupGameState => {
    const p = state.players[playerId];
    if (!p) return state;
    return {
      ...state,
      players: {
        ...state.players,
        [playerId]: {
          ...p,
          coins: Math.max(0, p.coins + delta),
        },
      },
    };
  };

  const applyActionEffect = (state: CoupGameState): CoupGameState => {
    const action = state.pendingAction;
    if (!action) return state;

    let s = { ...state };

    if (action.type === "income") {
      s = applyCoinsChange(s, action.actorId, +1);
      addLog(`+1 coin (Income) to ${findPlayer(action.actorId)?.name ?? "?"}`);
    }

    if (action.type === "foreign_aid") {
      s = applyCoinsChange(s, action.actorId, +2);
      addLog(
        `+2 coins (Foreign Aid) to ${
          findPlayer(action.actorId)?.name ?? "?"
        }`
      );
    }

    if (action.type === "tax") {
      s = applyCoinsChange(s, action.actorId, +3);
      addLog(
        `💼 Chancellor move: ${
          findPlayer(action.actorId)?.name ?? "?"
        } takes 3 coins`
      );
    }

    if (action.type === "steal" && action.targetId) {
      const target = s.players[action.targetId];
      if (target && target.alive) {
        const stolen = Math.min(2, target.coins);
        if (stolen > 0) {
          s = applyCoinsChange(s, action.targetId, -stolen);
          s = applyCoinsChange(s, action.actorId, +stolen);
          addLog(
            `🕵️ Agent: ${
              findPlayer(action.actorId)?.name ?? "?"
            } steals ${stolen} coin(s) from ${
              findPlayer(action.targetId)?.name ?? "?"
            }`
          );
        } else {
          addLog(
            `🕵️ Agent: ${
              findPlayer(action.actorId)?.name ?? "?"
            } tried to steal, but ${
              findPlayer(action.targetId)?.name ?? "?"
            } had no coins`
          );
        }
      }
    }

    if (action.type === "assassinate" && action.targetId) {
      const target = s.players[action.targetId];
      if (target && target.alive) {
        addLog(
          `🗡 Shadow: ${
            findPlayer(action.actorId)?.name ?? "?"
          } successfully assassinates ${
            findPlayer(action.targetId)?.name ?? "?"
          }`
        );
        s = {
          ...s,
          phase: "choose_influence_to_lose",
          revealInfo: {
            ...s.revealInfo,
            loserPlayerId: action.targetId,
          },
        };
        return s;
      }
    }

    if (action.type === "coup" && action.targetId) {
      const target = s.players[action.targetId];
      if (target && target.alive) {
        addLog(
          `💣 Coup: ${
            findPlayer(action.actorId)?.name ?? "?"
          } coups ${
            findPlayer(action.targetId)?.name ?? "?"
          } for 7 coins`
        );
        s = {
          ...s,
          phase: "choose_influence_to_lose",
          revealInfo: {
            ...s.revealInfo,
            loserPlayerId: action.targetId,
          },
        };
        return s;
      }
    }

    if (action.type === "exchange") {
      const actor = s.players[action.actorId];
      if (actor && actor.alive) {
        const newDeck = [...s.deck];
        const drawn: CoupInfluence[] = [];
        for (let i = 0; i < 2 && newDeck.length > 0; i++) {
          const card = newDeck.pop();
          if (card) drawn.push(card);
        }
        const pool = [...actor.influences.filter((i) => !i.revealed), ...drawn];
        const keep = shuffleC(pool).slice(0, actor.influences.length);
        const newInfluences = keep.concat(
          actor.influences.filter((i) => i.revealed)
        );

        const newPlayers = {
          ...s.players,
          [actor.playerId]: {
            ...actor,
            influences: newInfluences,
          },
        };

        addLog(
          `🎭 Diplomat: ${
            findPlayer(action.actorId)?.name ?? "?"
          } exchanges cards`
        );

        s = {
          ...s,
          players: newPlayers,
          deck: newDeck,
        };
      }
    }

    s.pendingAction = null;
    s.pendingBlock = null;
    s.challengeWindow = null;
    s.revealInfo = null;
    s.phase = "choose_action";

    s.currentTurnIndex = getNextTurnIndex(s);
    s = checkGameOver(s);
    return s;
  };

  const startAction = (type: CoupActionType, targetId?: string) => {
    if (!isMyTurn || !myState?.alive) return;

    let s: CoupGameState = { ...gameState };

    if (type === "income") {
      s.pendingAction = { actorId: myId, type };
      s = applyActionEffect(s);
      onUpdateState(s);
      return;
    }

    if (type === "foreign_aid") {
      s.pendingAction = { actorId: myId, type };
      s.phase = "pending_block"; // only Chancellor (Duke) can block foreign aid
      addLog(
        `💰 ${
          findPlayer(myId)?.name ?? "?"
        } takes Foreign Aid (+2 coins) – Chancellor can block`
      );
      onUpdateState(s);
      return;
    }

    if (type === "tax") {
      s.pendingAction = {
        actorId: myId,
        type,
        claimedRole: "chancellor",
      };
      s.phase = "pending_challenge_on_action";
      addLog(
        `💼 ${findPlayer(myId)?.name ?? "?"} claims CHANCELLOR to take 3 coins`
      );
      onUpdateState(s);
      return;
    }

    if (type === "assassinate") {
      if (!targetId) return;
      if (myState.coins < 3) return;
      s = applyCoinsChange(s, myId, -3);
      s.pendingAction = {
        actorId: myId,
        type,
        claimedRole: "shadow",
        targetId,
      };
      s.phase = "pending_challenge_on_action";
      addLog(
        `🗡 ${findPlayer(myId)?.name ?? "?"} claims SHADOW to assassinate ${
          findPlayer(targetId)?.name ?? "?"
        } (pays 3 coins)`
      );
      onUpdateState(s);
      return;
    }

    if (type === "steal") {
      if (!targetId) return;
      s.pendingAction = {
        actorId: myId,
        type,
        claimedRole: "agent",
        targetId,
      };
      s.phase = "pending_challenge_on_action";
      addLog(
        `🕵️ ${findPlayer(myId)?.name ?? "?"} claims AGENT to steal from ${
          findPlayer(targetId)?.name ?? "?"
        }`
      );
      onUpdateState(s);
      return;
    }

    if (type === "exchange") {
      s.pendingAction = {
        actorId: myId,
        type,
        claimedRole: "diplomat",
      };
      s.phase = "pending_challenge_on_action";
      addLog(
        `🎭 ${findPlayer(myId)?.name ?? "?"} claims DIPLOMAT to exchange cards`
      );
      onUpdateState(s);
      return;
    }

    if (type === "coup") {
      if (!targetId) return;
      if (myState.coins < 7) return;
      s = applyCoinsChange(s, myId, -7);
      s.pendingAction = {
        actorId: myId,
        type,
        targetId,
      };
      addLog(
        `💣 ${findPlayer(myId)?.name ?? "?"} launches a COUP on ${
          findPlayer(targetId)?.name ?? "?"
        }`
      );
      s = applyActionEffect(s);
      onUpdateState(s);
      return;
    }
  };

  const handlePlayerCardClick = (pid: string) => {
    if (!isMyTurn || !pendingTargetAction) return;
    if (pid === myId) return;
    startAction(pendingTargetAction, pid);
    setPendingTargetAction(null);
  };

  const canChallengeAction = () => {
    if (!gameState.pendingAction) return false;
    if (gameState.phase !== "pending_challenge_on_action") return false;
    if (!myState?.alive) return false;
    if (myId === gameState.pendingAction.actorId) return false;
    return true;
  };

  const canBlock = () => {
    if (!gameState.pendingAction) return false;
    if (gameState.phase !== "pending_block") return false;
    if (!myState?.alive) return false;

    const act = gameState.pendingAction;
    if (act.type === "foreign_aid") {
      return myState.alive;
    }
    if (act.type === "assassinate" && act.targetId === myId) {
      return myState.alive;
    }
    if (act.type === "steal" && act.targetId === myId) {
      return myState.alive;
    }
    return false;
  };

  const canChallengeBlock = () => {
    if (!gameState.pendingBlock) return false;
    if (gameState.phase !== "pending_challenge_on_block") return false;
    if (!myState?.alive) return false;
    if (myId === gameState.pendingBlock.blockerId) return false;
    return true;
  };

  const resolveChallenge = (truthful: boolean, challengedId: string, role: CoupRole, challengerId: string) => {
    let s: CoupGameState = { ...gameState };

    if (truthful) {
      addLog(
        `✅ Challenge failed: ${
          findPlayer(challengedId)?.name ?? "?"
        } really has ${role.toUpperCase()}. ${
          findPlayer(challengerId)?.name ?? "?"
        } loses a card.`
      );
      s.phase = "choose_influence_to_lose";
      s.revealInfo = {
        revealedPlayerId: challengedId,
        revealedRole: role,
        loserPlayerId: challengerId,
      };
      s.challengeWindow = null;
    } else {
      addLog(
        `❌ Bluff caught: ${
          findPlayer(challengedId)?.name ?? "?"
        } lied about ${role.toUpperCase()} and loses a card.`
      );
      s.phase = "choose_influence_to_lose";
      s.revealInfo = {
        revealedPlayerId: challengedId,
        revealedRole: role,
        loserPlayerId: challengedId,
      };
      s.challengeWindow = null;
      s.pendingAction = null;
      s.pendingBlock = null;
    }

    onUpdateState(s);
  };

  const handleChallengeAction = () => {
    const act = gameState.pendingAction;
    if (!canChallengeAction() || !act || !act.claimedRole) return;

    const actorState = gameState.players[act.actorId];
    const hasRole = actorState.influences.some(
      (inf) => !inf.revealed && inf.role === act.claimedRole
    );
    resolveChallenge(hasRole, act.actorId, act.claimedRole, myId);
  };

  const handleChallengeBlock = () => {
    const pb = gameState.pendingBlock;
    if (!canChallengeBlock() || !pb) return;

    const blockerState = gameState.players[pb.blockerId];
    const hasRole = blockerState.influences.some(
      (inf) => !inf.revealed && inf.role === pb.role
    );
    resolveChallenge(hasRole, pb.blockerId, pb.role, myId);
  };

  const handleHostNoChallengeOnAction = () => {
    if (!isHost) return;
    if (gameState.phase !== "pending_challenge_on_action") return;
    let s: CoupGameState = { ...gameState };
    const act = s.pendingAction;
    if (!act) return;

    if (act.type === "tax") {
      s = applyActionEffect(s);
    } else if (act.type === "exchange") {
      s = applyActionEffect(s);
    } else if (act.type === "assassinate" || act.type === "steal") {
      s.phase = "pending_block";
      addLog(`➡ Waiting for possible block...`);
    }

    onUpdateState(s);
  };

  const handleBlock = (role: CoupRole) => {
    const act = gameState.pendingAction;
    if (!canBlock() || !act) return;

    if (act.type === "foreign_aid" && role !== "chancellor") return;
    if (act.type === "assassinate" && role !== "protector") return;
    if (
      act.type === "steal" &&
      role !== "agent" &&
      role !== "diplomat"
    )
      return;

    let s: CoupGameState = { ...gameState };
    s.pendingBlock = {
      blockerId: myId,
      role,
      blockingAction: act.type,
    };
    s.phase = "pending_challenge_on_block";
    addLog(
      `🛡 ${findPlayer(myId)?.name ?? "?"} blocks ${
        act.type
      } claiming ${role.toUpperCase()}`
    );
    onUpdateState(s);
  };

  const handleHostNoBlock = () => {
    if (!isHost) return;
    if (gameState.phase !== "pending_block") return;
    let s = applyActionEffect({ ...gameState });
    onUpdateState(s);
  };

  const handleHostNoChallengeOnBlock = () => {
    if (!isHost) return;
    if (gameState.phase !== "pending_challenge_on_block") return;

    const pb = gameState.pendingBlock;
    let s: CoupGameState = { ...gameState };

    if (!pb || !gameState.pendingAction) {
      s.pendingBlock = null;
      s.phase = "choose_action";
      s.currentTurnIndex = getNextTurnIndex(s);
      s = checkGameOver(s);
      onUpdateState(s);
      return;
    }

    if (pb.blockingAction === "foreign_aid") {
      addLog(`💼 Chancellor successfully blocks Foreign Aid.`);
      s.pendingAction = null;
      s.pendingBlock = null;
      s.phase = "choose_action";
      s.currentTurnIndex = getNextTurnIndex(s);
      s = checkGameOver(s);
      onUpdateState(s);
      return;
    }

    if (pb.blockingAction === "assassinate") {
      addLog(`🛡 Protector blocks assassination.`);
      s.pendingAction = null;
      s.pendingBlock = null;
      s.phase = "choose_action";
      s.currentTurnIndex = getNextTurnIndex(s);
      s = checkGameOver(s);
      onUpdateState(s);
      return;
    }

    if (pb.blockingAction === "steal") {
      addLog(`🛡 Steal blocked by ${pb.role.toUpperCase()}.`);
      s.pendingAction = null;
      s.pendingBlock = null;
      s.phase = "choose_action";
      s.currentTurnIndex = getNextTurnIndex(s);
      s = checkGameOver(s);
      onUpdateState(s);
      return;
    }
  };

  const handleChooseInfluenceToLose = (influenceId: string) => {
    if (gameState.phase !== "choose_influence_to_lose") return;
    const loserId = gameState.revealInfo?.loserPlayerId;
    if (!loserId || loserId !== myId) return;

    const newState = loseInfluence(gameState, loserId, influenceId);
    onUpdateState(newState);
  };

  if (!myState) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p>Loading Coup...</p>
      </div>
    );
  }

  const renderRoleCard = (
    emoji: string,
    title: string,
    keyRole: CoupRole,
    action: string,
    extra: string
  ) => (
    <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-3 text-sm flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xl">{emoji}</span>
        <p className="font-semibold text-slate-100">{title}</p>
      </div>
      <p className="text-xs text-slate-400">{action}</p>
      <p className="text-[11px] text-slate-500">{extra}</p>
    </div>
  );

  const renderInfluenceCard = (inf: CoupInfluence, selectable: boolean) => {
    const roleMap: Record<CoupRole, { emoji: string; name: string }> = {
      chancellor: { emoji: "💼", name: "Chancellor" },
      shadow: { emoji: "🗡", name: "Shadow" },
      agent: { emoji: "🕵️", name: "Agent" },
      diplomat: { emoji: "🎭", name: "Diplomat" },
      protector: { emoji: "🛡", name: "Protector" },
    };

    const r = roleMap[inf.role];

    return (
      <button
        key={inf.id}
        disabled={!selectable}
        onClick={() =>
          selectable ? handleChooseInfluenceToLose(inf.id) : undefined
        }
        className={`flex flex-col items-center justify-center rounded-2xl border w-28 h-40 text-xs font-semibold
          ${
            inf.revealed
              ? "border-red-500/60 bg-red-950/70 text-red-200 line-through"
              : "border-slate-600 bg-slate-900 text-slate-100"
          }
          ${selectable ? "hover:border-red-400 hover:bg-red-950/60" : ""}
        `}
      >
        <span className="text-3xl mb-2">{r.emoji}</span>
        <span>{r.name}</span>
        {inf.revealed && <span className="mt-1 text-[10px]">LOST</span>}
      </button>
    );
  };

  const phaseHint = (() => {
    if (gameState.phase === "choose_action") {
      return "Your turn: choose an action.";
    }
    if (gameState.phase === "pending_challenge_on_action") {
      return "Someone has claimed a role. Others may challenge.";
    }
    if (gameState.phase === "pending_block") {
      return "Action can be blocked. Target/players may block.";
    }
    if (gameState.phase === "pending_challenge_on_block") {
      return "Block has been declared. Others may challenge the block.";
    }
    if (gameState.phase === "choose_influence_to_lose") {
      return "A player must choose a card to lose.";
    }
    if (gameState.phase === "game_over") {
      return "Game over.";
    }
    return "";
  })();

  if (gameState.phase === "game_over" && gameState.winnerId) {
    const winner = findPlayer(gameState.winnerId);
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-purple-900 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900/90 rounded-3xl border border-purple-500/50 shadow-2xl p-8 text-center space-y-4">
          <Crown className="w-12 h-12 text-yellow-400 mx-auto mb-2" />
          <h1 className="text-3xl font-black">Game Over</h1>
          <p className="text-lg">
            Winner:{" "}
            <span className="font-bold text-purple-300">
              {winner?.name ?? "Unknown"}
            </span>
          </p>
          <button
            onClick={onEndGame}
            className="mt-4 w-full py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 font-bold shadow hover:scale-105 transition"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 flex flex-col">
      <div className="flex flex-col md:flex-row gap-4 p-4 items-start">
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Crown className="w-6 h-6 text-purple-400" />
              <h1 className="text-xl md:text-2xl font-black tracking-wide">
                COUP – Funora Edition
              </h1>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <Info className="w-4 h-4" />
              <span>{phaseHint}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Users className="w-4 h-4" />
            <span>Current turn: </span>
            <span className="font-semibold text-slate-100">
              {findPlayer(currentTurnPlayerId)?.name ?? "?"}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {gameState.turnOrder.map((pid) => {
              const ps = gameState.players[pid];
              const pMeta = findPlayer(pid);
              const isTurn = pid === currentTurnPlayerId;
              const isMe = pid === myId;

              return (
                <button
                  key={pid}
                  onClick={() => handlePlayerCardClick(pid)}
                  className={`relative rounded-2xl border p-3 flex flex-col gap-2 text-left transition
                    ${
                      !ps.alive
                        ? "opacity-40 border-slate-700 bg-slate-900"
                        : "border-slate-700 bg-slate-900/70 hover:border-purple-500/60 hover:bg-slate-900/90"
                    }
                    ${
                      pendingTargetAction && ps.alive && !isMe
                        ? "ring-2 ring-yellow-400/70"
                        : ""
                    }
                  `}
                >
                  <div className="flex items-center gap-2">
                    {pMeta?.avatar ? (
                      <img
                        src={pMeta.avatar}
                        alt={pMeta.name}
                        className="w-8 h-8 rounded-full border border-slate-600 object-cover"
                      />
                    ) : (
                      <UserCircle2 className="w-8 h-8 text-slate-500" />
                    )}
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">
                        {pMeta?.name ?? "Player"}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {ps.alive ? "Alive" : "Eliminated"}
                      </span>
                    </div>
                    {isTurn && (
                      <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-purple-600/30 text-purple-200">
                        TURN
                      </span>
                    )}
                    {isMe && (
                      <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-600/30 text-blue-200">
                        YOU
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-800 border border-slate-700">
                      <Coins className="w-3 h-3" />
                      <span>{ps.coins}</span>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-800 border border-slate-700">
                      <Shield className="w-3 h-3" />
                      <span>
                        {
                          ps.influences.filter((inf) => !inf.revealed)
                            .length
                        }{" "}
                        / {ps.influences.length}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="w-full md:w-80 space-y-3">
          <div className="bg-slate-950/80 border border-slate-700 rounded-2xl p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-300 flex items-center gap-1">
              <Info className="w-4 h-4 text-purple-400" /> Roles & Abilities
            </p>
            <div className="grid grid-cols-1 gap-2 text-xs">
              {renderRoleCard(
                "💼",
                "Chancellor",
                "chancellor",
                "Tax: Take 3 coins.",
                "Blocks Foreign Aid."
              )}
              {renderRoleCard(
                "🗡",
                "Shadow",
                "shadow",
                "Assassinate: Pay 3 coins to remove 1 influence.",
                "Blocked by Protector."
              )}
              {renderRoleCard(
                "🕵️",
                "Agent",
                "agent",
                "Steal: Take up to 2 coins from a player.",
                "Blocked by Agent or Diplomat."
              )}
              {renderRoleCard(
                "🎭",
                "Diplomat",
                "diplomat",
                "Exchange: Refresh your hidden cards.",
                "Blocks Steal."
              )}
              {renderRoleCard(
                "🛡",
                "Protector",
                "protector",
                "No action.",
                "Blocks Assassinate."
              )}
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-700 rounded-2xl p-3 space-y-2 max-h-60 overflow-y-auto">
            <p className="text-xs font-semibold text-slate-300 flex items-center gap-1">
              <Swords className="w-4 h-4 text-red-400" /> Action Log
            </p>
            {gameState.activityLog
              .slice()
              .reverse()
              .map((entry) => (
                <p
                  key={entry.id}
                  className="text-[11px] text-slate-400 border-b border-slate-800/80 pb-1 mb-1 last:border-none last:pb-0 last:mb-0"
                >
                  {entry.text}
                </p>
              ))}
          </div>
        </div>
      </div>

      <div className="mt-auto p-4 border-t border-slate-800 bg-slate-950/90">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-xs text-slate-400 mb-1">Your Influence</p>
            <div className="flex gap-2 flex-wrap">
              {myState.influences.map((inf) =>
                renderInfluenceCard(
                  inf,
                  gameState.phase === "choose_influence_to_lose" &&
                    gameState.revealInfo?.loserPlayerId === myId &&
                    !inf.revealed
                )
              )}
            </div>

            {gameState.phase === "choose_influence_to_lose" &&
              gameState.revealInfo?.loserPlayerId === myId && (
                <p className="text-[11px] text-red-400 flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3 h-3" />
                  Choose which card to sacrifice.
                </p>
              )}
          </div>

          <div className="flex-1 flex flex-col gap-2 items-stretch">
            <div className="flex flex-wrap gap-2 justify-end text-xs">
              {isMyTurn && myState.alive && (
                <>
                  <button
                    onClick={() => startAction("income")}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 flex items-center gap-1"
                  >
                    <Coins className="w-3 h-3" />
                    <span>Income (+1)</span>
                  </button>
                  <button
                    onClick={() => startAction("foreign_aid")}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600"
                  >
                    Foreign Aid (+2)
                  </button>
                  <button
                    onClick={() => startAction("tax")}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-purple-500/70"
                  >
                    💼 Tax (3 coins)
                  </button>
                  <button
                    disabled={myState.coins < 3}
                    onClick={() => setPendingTargetAction("assassinate")}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-red-500/70 disabled:opacity-40"
                  >
                    🗡 Assassinate (3)
                  </button>
                  <button
                    onClick={() => setPendingTargetAction("steal")}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-yellow-500/70"
                  >
                    🕵️ Steal (2)
                  </button>
                  <button
                    onClick={() => startAction("exchange")}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-blue-500/70"
                  >
                    <Shuffle className="w-3 h-3" />
                    <span>Exchange</span>
                  </button>
                  <button
                    disabled={myState.coins < 7}
                    onClick={() => setPendingTargetAction("coup")}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-pink-500/70 disabled:opacity-40"
                  >
                    💣 Coup (7)
                  </button>
                </>
              )}

              {!isMyTurn && myState.alive && (
                <>
                  {canChallengeAction() && (
                    <button
                      onClick={handleChallengeAction}
                      className="px-3 py-2 rounded-xl bg-red-900/80 hover:bg-red-800 border border-red-500/80 flex items-center gap-1"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      <span>Challenge Action</span>
                    </button>
                  )}
                  {canBlock() && (
                    <div className="flex gap-1 flex-wrap">
                      {gameState.pendingAction?.type === "foreign_aid" && (
                        <button
                          onClick={() => handleBlock("chancellor")}
                          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-purple-500/80"
                        >
                          Block as 💼 Chancellor
                        </button>
                      )}
                      {gameState.pendingAction?.type === "assassinate" && (
                        <button
                          onClick={() => handleBlock("protector")}
                          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-green-500/80"
                        >
                          Block as 🛡 Protector
                        </button>
                      )}
                      {gameState.pendingAction?.type === "steal" && (
                        <>
                          <button
                            onClick={() => handleBlock("agent")}
                            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-yellow-500/80"
                          >
                            Block as 🕵️ Agent
                          </button>
                          <button
                            onClick={() => handleBlock("diplomat")}
                            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-blue-500/80"
                          >
                            Block as 🎭 Diplomat
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {canChallengeBlock() && (
                    <button
                      onClick={handleChallengeBlock}
                      className="px-3 py-2 rounded-xl bg-red-900/80 hover:bg-red-800 border border-red-500/80 flex items-center gap-1"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      <span>Challenge Block</span>
                    </button>
                  )}
                </>
              )}
            </div>

            {isHost && (
              <div className="flex flex-wrap gap-2 justify-end text-[11px] mt-1 text-slate-300">
                {gameState.phase === "pending_challenge_on_action" && (
                  <button
                    onClick={handleHostNoChallengeOnAction}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600"
                  >
                    Host: No one challenged
                  </button>
                )}
                {gameState.phase === "pending_block" && (
                  <button
                    onClick={handleHostNoBlock}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600"
                  >
                    Host: No one blocked
                  </button>
                )}
                {gameState.phase === "pending_challenge_on_block" && (
                  <button
                    onClick={handleHostNoChallengeOnBlock}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600"
                  >
                    Host: No challenge on block
                  </button>
                )}
              </div>
            )}

            {pendingTargetAction && isMyTurn && (
              <p className="text-[11px] text-yellow-300 text-right flex items-center gap-1 justify-end mt-1">
                <Swords className="w-3 h-3" />
                Select a target player on the table.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
