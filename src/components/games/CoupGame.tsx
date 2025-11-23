import { useEffect, useState } from "react";
import { Room, Player } from "../../lib/supabase";
import {
  CoupGameState,
  CoupRole,
  CoupInfluence,
  shuffleC,
} from "../../lib/gameLogic";
import {
  Coins,
  Swords,
  Shield,
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

// Helper to track special chain after someone loses a card
type AfterLoseFlag = "continue_action" | "block_stands";

export default function CoupGame({
  room,
  players,
  currentPlayer,
  gameState,
  onUpdateState,
  onEndGame,
}: CoupGameProps) {
  const myId = currentPlayer.player_id;
  const myState = gameState.players[myId];
  const isHost = room.host_id === myId;

  const [pendingTargetAction, setPendingTargetAction] = useState<
    null | "assassinate" | "steal" | "coup"
  >(null);

  // Diplomat modal
  const [exchangeOptions, setExchangeOptions] = useState<CoupInfluence[] | null>(
    null
  );
  const [exchangeSelectedIds, setExchangeSelectedIds] = useState<string[]>([]);

  // Click lock for smooth UX
  const [clickLocked, setClickLocked] = useState(false);
  const lockClick = () => {
    setClickLocked(true);
    setTimeout(() => setClickLocked(false), 450);
  };

  const findPlayer = (id: string) =>
    players.find((p) => p.player_id === id) || null;

  const currentTurnPlayerId = gameState.turnOrder[gameState.currentTurnIndex];
  const isMyTurn =
    gameState.phase === "choose_action" && currentTurnPlayerId === myId;

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

  // Basic loseInfluence (used when we aren’t in fancy chain flow)
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

  // Apply final effect of an action once all challenges/blocks resolved
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
        `💼 Chancellor: ${
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
          } assassinates ${
            findPlayer(action.targetId)?.name ?? "?"
          } (if not blocked)`
        );
        s = {
          ...s,
          phase: "choose_influence_to_lose",
          revealInfo: {
            ...(s.revealInfo as any),
            loserPlayerId: action.targetId,
          } as any,
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
            ...(s.revealInfo as any),
            loserPlayerId: action.targetId,
          } as any,
        };
        return s;
      }
    }

    // Diplomat: actual exchange is done via modal later
    s.pendingAction = null;
    s.pendingBlock = null;
    s.challengeWindow = null;
    s.revealInfo = null;
    s.phase = "choose_action";

    s.currentTurnIndex = getNextTurnIndex(s);
    s = checkGameOver(s);
    return s;
  };

  // === START ACTIONS ===

  const startAction = (
    type:
      | "income"
      | "foreign_aid"
      | "tax"
      | "assassinate"
      | "steal"
      | "exchange"
      | "coup",
    targetId?: string
  ) => {
    if (!isMyTurn || !myState?.alive || clickLocked) return;

    let s: CoupGameState = { ...gameState };
    lockClick();

    if (type === "income") {
      s.pendingAction = { actorId: myId, type };
      s = applyActionEffect(s);
      onUpdateState(s);
      return;
    }

    if (type === "foreign_aid") {
      s.pendingAction = { actorId: myId, type };
      s.phase = "pending_block";
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
      if (!targetId || myState.coins < 3) return;
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
      if (!targetId || myState.coins < 7) return;
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
    if (!isMyTurn || !pendingTargetAction || clickLocked) return;
    if (pid === myId) return;
    startAction(pendingTargetAction, pid);
    setPendingTargetAction(null);
  };

  // === CHALLENGE / BLOCK PERMISSIONS ===

  const canChallengeAction = () => {
    const act = gameState.pendingAction;
    if (!act) return false;
    if (gameState.phase !== "pending_challenge_on_action") return false;
    if (!myState?.alive) return false;
    if (myId === act.actorId) return false;
    return true;
  };

  const canBlock = () => {
    const act = gameState.pendingAction;
    if (!act) return false;
    if (gameState.phase !== "pending_block") return false;
    if (!myState?.alive) return false;
    // Target-only (except Foreign Aid where anyone can block)
    if (act.type === "foreign_aid") return true;
    return act.targetId === myId;
  };

  const canChallengeBlock = () => {
    const pb = gameState.pendingBlock;
    if (!pb) return false;
    if (gameState.phase !== "pending_challenge_on_block") return false;
    if (!myState?.alive) return false;
    if (myId === pb.blockerId) return false;
    return true;
  };

  // === CHALLENGE RESOLUTION (with truthful card replacement) ===

  const resolveChallenge = (
    truthful: boolean,
    challengedId: string,
    role: CoupRole,
    challengerId: string
  ) => {
    let s: CoupGameState = { ...gameState };

    const isActionChallenge =
      gameState.phase === "pending_challenge_on_action";
    const isBlockChallenge =
      gameState.phase === "pending_challenge_on_block";

    if (truthful) {
      // ✅ Challenged player was telling the truth
      addLog(
        `✅ Challenge failed: ${
          findPlayer(challengedId)?.name ?? "?"
        } really has ${role.toUpperCase()}. ${
          findPlayer(challengerId)?.name ?? "?"
        } loses a card.`
      );

      // 🃏 Replace the revealed truthful card with a new one from the deck
      const player = s.players[challengedId];
      if (player) {
        // Choose a hidden card of that role
        const hiddenOfRole = player.influences.filter(
          (inf) => !inf.revealed && inf.role === role
        );
        const cardToReplace = hiddenOfRole[0];

        if (cardToReplace && s.deck.length > 0) {
          const remainingInfluences = player.influences.filter(
            (inf) => inf.id !== cardToReplace.id
          );

          // Draw top card from deck
          const newCard = s.deck[s.deck.length - 1];
          let newDeck = s.deck.slice(0, -1);

          const updatedInfluences: CoupInfluence[] = [
            ...remainingInfluences,
            { ...newCard, revealed: false },
          ];

          // Put revealed card at bottom of deck (face-down)
          newDeck.unshift({ ...cardToReplace, revealed: false });

          s.players = {
            ...s.players,
            [challengedId]: {
              ...player,
              influences: updatedInfluences,
            },
          };
          s.deck = newDeck;
        }
      }

      const afterLose: AfterLoseFlag | undefined = isActionChallenge
        ? "continue_action"
        : isBlockChallenge
        ? "block_stands"
        : undefined;

      s.phase = "choose_influence_to_lose";
      s.revealInfo = {
        revealedPlayerId: challengedId,
        revealedRole: role,
        loserPlayerId: challengerId,
        afterLose,
      } as any;
      s.challengeWindow = null;
    } else {
      // ❌ Liar
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
      } as any;
      s.challengeWindow = null;
      s.pendingAction = null;
      s.pendingBlock = null;
    }

    onUpdateState(s);
  };

  const handleChallengeAction = () => {
    const act = gameState.pendingAction;
    if (!canChallengeAction() || !act || !act.claimedRole || clickLocked)
      return;
    lockClick();

    const actorState = gameState.players[act.actorId];
    const hasRole = actorState.influences.some(
      (inf) => !inf.revealed && inf.role === act.claimedRole
    );
    resolveChallenge(hasRole, act.actorId, act.claimedRole, myId);
  };

  const handleChallengeBlock = () => {
    const pb = gameState.pendingBlock;
    if (!canChallengeBlock() || !pb || clickLocked) return;
    lockClick();

    const blockerState = gameState.players[pb.blockerId];
    const hasRole = blockerState.influences.some(
      (inf) => !inf.revealed && inf.role === pb.role
    );
    resolveChallenge(hasRole, pb.blockerId, pb.role, myId);
  };

  // === HOST “NO ONE CHALLENGED/BLOCKED” HELPERS ===

  const handleHostNoChallengeOnAction = () => {
    if (!isHost || clickLocked) return;
    if (gameState.phase !== "pending_challenge_on_action") return;
    lockClick();

    let s: CoupGameState = { ...gameState };
    const act = s.pendingAction;
    if (!act) return;

    if (act.type === "tax") {
      s = applyActionEffect(s);
    } else if (act.type === "exchange") {
      s.phase = "exchange_cards";
      addLog(
        `🎭 ${findPlayer(act.actorId)?.name ?? "?"} is exchanging cards...`
      );
    } else if (act.type === "assassinate" || act.type === "steal") {
      s.phase = "pending_block";
      addLog(`➡ Waiting for possible block...`);
    } else {
      s = applyActionEffect(s);
    }

    onUpdateState(s);
  };

  const handleBlock = (role: CoupRole) => {
    const act = gameState.pendingAction;
    if (!canBlock() || !act || clickLocked) return;

    if (act.type === "foreign_aid" && role !== "chancellor") return;
    if (act.type === "assassinate" && role !== "protector") return;
    if (
      act.type === "steal" &&
      role !== "agent" &&
      role !== "diplomat"
    )
      return;

    lockClick();
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

  const handleSkipBlock = () => {
    const act = gameState.pendingAction;
    if (!canBlock() || !act || clickLocked) return;
    lockClick();
    let s = applyActionEffect({ ...gameState });
    onUpdateState(s);
  };

  const handleHostNoBlock = () => {
    if (!isHost || clickLocked) return;
    if (gameState.phase !== "pending_block") return;
    lockClick();
    let s = applyActionEffect({ ...gameState });
    onUpdateState(s);
  };

  const handleHostNoChallengeOnBlock = () => {
    if (!isHost || clickLocked) return;
    if (gameState.phase !== "pending_challenge_on_block") return;
    lockClick();

    let s: CoupGameState = { ...gameState };
    const pb = s.pendingBlock;
    if (!pb || !s.pendingAction) {
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
    } else if (pb.blockingAction === "assassinate") {
      addLog(`🛡 Protector blocks assassination.`);
      s.pendingAction = null;
      s.pendingBlock = null;
    } else if (pb.blockingAction === "steal") {
      addLog(`🛡 Steal blocked by ${pb.role.toUpperCase()}.`);
      s.pendingAction = null;
      s.pendingBlock = null;
    }

    s.phase = "choose_action";
    s.currentTurnIndex = getNextTurnIndex(s);
    s = checkGameOver(s);
    onUpdateState(s);
  };

  // === LOSING INFLUENCE WITH SPECIAL AFTER-LOSE FLOW ===

  const handleChooseInfluenceToLose = (influenceId: string) => {
    if (gameState.phase !== "choose_influence_to_lose") return;
    const loserId = gameState.revealInfo?.loserPlayerId;
    if (!loserId || loserId !== myId || clickLocked) return;
    lockClick();

    const afterLose = (gameState.revealInfo as any)
      ?.afterLose as AfterLoseFlag | undefined;

    if (!afterLose) {
      const newS = loseInfluence(gameState, loserId, influenceId);
      onUpdateState(newS);
      return;
    }

    let s: CoupGameState = { ...gameState };
    const pl = s.players[loserId];
    const newInf = pl.influences.map((inf) =>
      inf.id === influenceId ? { ...inf, revealed: true } : inf
    );
    const alive = newInf.some((inf) => !inf.revealed);

    s.players = {
      ...s.players,
      [loserId]: {
        ...pl,
        influences: newInf,
        alive,
      },
    };
    s.revealInfo = null;

    if (afterLose === "continue_action") {
      const act = s.pendingAction;
      if (!act) {
        onUpdateState(s);
        return;
      }

      if (act.type === "assassinate" || act.type === "steal") {
        s.phase = "pending_block";
        addLog(`➡ Waiting for possible block...`);
        onUpdateState(s);
        return;
      }

      s = applyActionEffect(s);
      onUpdateState(s);
      return;
    }

    if (afterLose === "block_stands") {
      s.pendingAction = null;
      s.pendingBlock = null;
      s.phase = "choose_action";
      s.currentTurnIndex = getNextTurnIndex(s);
      s = checkGameOver(s);
      onUpdateState(s);
      return;
    }
  };

  // === DIPLOMAT EXCHANGE ===

  useEffect(() => {
    const act = gameState.pendingAction;
    if (
      gameState.phase === "exchange_cards" &&
      act?.type === "exchange" &&
      act.actorId === myId &&
      myState?.alive
    ) {
      if (!exchangeOptions) {
        const me = gameState.players[myId];
        const alive = me.influences.filter((i) => !i.revealed);
        const deck = gameState.deck;
        const drawn: CoupInfluence[] = [];
        for (let i = 0; i < 2 && deck.length - 1 - i >= 0; i++) {
          drawn.push(deck[deck.length - 1 - i]);
        }
        const options = [...alive, ...drawn];
        setExchangeOptions(options);
        if (alive.length === 1) {
          setExchangeSelectedIds([alive[0].id]);
        } else {
          setExchangeSelectedIds([]);
        }
      }
    } else {
      if (exchangeOptions) {
        setExchangeOptions(null);
        setExchangeSelectedIds([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.phase, gameState.pendingAction, gameState.deck, myId]);

  const isExchangeActor =
    gameState.phase === "exchange_cards" &&
    gameState.pendingAction?.type === "exchange" &&
    gameState.pendingAction.actorId === myId &&
    myState?.alive;

  const handleToggleExchangeSelect = (id: string) => {
    if (!exchangeOptions || !isExchangeActor) return;
    const me = gameState.players[myId];
    const alive = me.influences.filter((i) => !i.revealed);
    const aliveIds = alive.map((a) => a.id);
    const drawn = exchangeOptions.filter((opt) => !aliveIds.includes(opt.id));
    const drawnIds = drawn.map((d) => d.id);

    if (alive.length === 1) {
      setExchangeSelectedIds([id]);
      return;
    }

    let next = [...exchangeSelectedIds];
    if (next.includes(id)) {
      next = next.filter((x) => x !== id);
    } else {
      if (next.length >= alive.length) return;
      const isNew = drawnIds.includes(id);
      if (isNew) {
        const newCount = next.filter((selId) =>
          drawnIds.includes(selId)
        ).length;
        if (newCount >= 1) {
          return;
        }
      }
      next.push(id);
    }
    setExchangeSelectedIds(next);
  };

  const handleConfirmExchange = () => {
    if (!isExchangeActor || !exchangeOptions || clickLocked) return;
    lockClick();

    const me = gameState.players[myId];
    const alive = me.influences.filter((i) => !i.revealed);
    const revealed = me.influences.filter((i) => i.revealed);
    const aliveIds = alive.map((a) => a.id);
    const drawn = exchangeOptions.filter((opt) => !aliveIds.includes(opt.id));
    const drawnIds = drawn.map((d) => d.id);

    if (alive.length === 1) {
      if (exchangeSelectedIds.length !== 1) return;
    } else {
      if (exchangeSelectedIds.length !== alive.length) return;
      const newCount = exchangeSelectedIds.filter((id) =>
        drawnIds.includes(id)
      ).length;
      if (newCount > 1) return;
    }

    const selected = exchangeOptions.filter((opt) =>
      exchangeSelectedIds.includes(opt.id)
    );
    const notSelected = exchangeOptions.filter(
      (opt) => !exchangeSelectedIds.includes(opt.id)
    );

    let baseDeck = gameState.deck.filter(
      (card) => !drawnIds.includes(card.id)
    );
    baseDeck = [...baseDeck, ...notSelected];
    const newDeck = shuffleC(baseDeck);

    const newInfluences = [...selected, ...revealed];

    const newPlayers = {
      ...gameState.players,
      [myId]: {
        ...me,
        influences: newInfluences,
      },
    };

    let s: CoupGameState = {
      ...gameState,
      players: newPlayers,
      deck: newDeck,
      pendingAction: null,
      pendingBlock: null,
      challengeWindow: null,
      revealInfo: null,
      phase: "choose_action",
    };

    s.currentTurnIndex = getNextTurnIndex(s);
    s = checkGameOver(s);
    addLog(
      `🎭 ${findPlayer(myId)?.name ?? "?"} completes a Diplomat exchange.`
    );
    onUpdateState(s);

    setExchangeOptions(null);
    setExchangeSelectedIds([]);
  };

  // === UI HELPERS ===

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
    action: string,
    extra: string
  ) => (
    <div className="bg-slate-900/90 border border-slate-700 rounded-2xl p-3 text-xs flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-lg">{emoji}</span>
        <p className="font-semibold text-slate-100">{title}</p>
      </div>
      <p className="text-[11px] text-slate-300">{action}</p>
      <p className="text-[10px] text-slate-500">{extra}</p>
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
        className={`flex flex-col items-center justify-center rounded-2xl border w-24 h-32 md:w-28 md:h-40 text-[10px] md:text-xs font-semibold
          ${
            inf.revealed
              ? "border-red-500/60 bg-red-950/70 text-red-200 line-through"
              : "border-slate-600 bg-slate-900 text-slate-100"
          }
          ${selectable ? "hover:border-red-400 hover:bg-red-950/60" : ""}
        `}
      >
        <span className="text-2xl md:text-3xl mb-2">{r.emoji}</span>
        <span>{r.name}</span>
        {inf.revealed && <span className="mt-1 text-[9px]">LOST</span>}
      </button>
    );
  };

  const phaseHint = (() => {
    if (gameState.phase === "choose_action") {
      return "Your turn: choose an action.";
    }
    if (gameState.phase === "pending_challenge_on_action") {
      return "Role claimed. Others may challenge.";
    }
    if (gameState.phase === "pending_block") {
      return "Action can be blocked.";
    }
    if (gameState.phase === "pending_challenge_on_block") {
      return "Block claimed. Others may challenge.";
    }
    if (gameState.phase === "choose_influence_to_lose") {
      return "A player must choose a card to lose.";
    }
    if (gameState.phase === "exchange_cards") {
      return "Diplomat is exchanging cards.";
    }
    if (gameState.phase === "game_over") {
      return "Game over.";
    }
    return "";
  })();

  const actionBannerText = (() => {
    const act = gameState.pendingAction;
    const pb = gameState.pendingBlock;

    if (gameState.phase === "pending_challenge_on_action" && act) {
      const n = findPlayer(act.actorId)?.name ?? "Someone";
      if (act.type === "tax") return `${n} claims 💼 Chancellor to take 3 coins.`;
      if (act.type === "assassinate" && act.targetId)
        return `${n} claims 🗡 Shadow to assassinate ${
          findPlayer(act.targetId)?.name ?? "someone"
        }.`;
      if (act.type === "steal" && act.targetId)
        return `${n} claims 🕵️ Agent to steal from ${
          findPlayer(act.targetId)?.name ?? "someone"
        }.`;
      if (act.type === "exchange")
        return `${n} claims 🎭 Diplomat to exchange cards.`;
    }

    if (gameState.phase === "pending_block" && act) {
      const n = findPlayer(act.actorId)?.name ?? "Someone";
      if (act.type === "foreign_aid")
        return `${n} is taking Foreign Aid. Chancellor can block.`;
      if (act.type === "assassinate" && act.targetId)
        return `${n}'s assassination can be blocked by Protector.`;
      if (act.type === "steal" && act.targetId)
        return `${n}'s steal can be blocked by Agent/Diplomat.`;
    }

    if (gameState.phase === "pending_challenge_on_block" && pb) {
      const n = findPlayer(pb.blockerId)?.name ?? "Someone";
      return `${n} is blocking as ${pb.role.toUpperCase()}. Others may challenge.`;
    }

    return "";
  })();

  if (gameState.phase === "game_over" && gameState.winnerId) {
    const winner = findPlayer(gameState.winnerId);
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-purple-900 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900/90 rounded-3xl border border-purple-500/50 shadow-2xl p-6 text-center space-y-4">
          <Crown className="w-10 h-10 text-yellow-400 mx-auto mb-1" />
          <h1 className="text-2xl font-black">Game Over</h1>
          <p className="text-base">
            Winner:{" "}
            <span className="font-bold text-purple-300">
              {winner?.name ?? "Unknown"}
            </span>
          </p>
          <button
            onClick={onEndGame}
            className="mt-3 w-full py-2.5 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 font-bold shadow hover:scale-105 transition"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  const roleMapSmall: Record<CoupRole, { emoji: string; name: string }> = {
    chancellor: { emoji: "💼", name: "Chancellor" },
    shadow: { emoji: "🗡", name: "Shadow" },
    agent: { emoji: "🕵️", name: "Agent" },
    diplomat: { emoji: "🎭", name: "Diplomat" },
    protector: { emoji: "🛡", name: "Protector" },
  };

  // === MAIN RENDER ===

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 flex flex-col">
      {/* Diplomat modal */}
      {isExchangeActor && exchangeOptions && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-3">
          <div className="max-w-md w-full bg-slate-900 rounded-3xl border border-slate-700 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Shuffle className="w-5 h-5 text-blue-400" />
                <p className="text-sm font-semibold">
                  Diplomat Exchange – Choose Your Card(s)
                </p>
              </div>
              <span className="text-[10px] text-slate-400">
                At most 1 new card.
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              Tap the card(s) you want to keep. Then confirm.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {exchangeOptions.map((opt) => {
                const meP = gameState.players[myId];
                const alive = meP.influences.filter((i) => !i.revealed);
                const aliveIds = alive.map((a) => a.id);
                const isNew = !aliveIds.includes(opt.id);
                const isSel = exchangeSelectedIds.includes(opt.id);
                const r = roleMapSmall[opt.role];

                return (
                  <button
                    key={opt.id}
                    onClick={() => handleToggleExchangeSelect(opt.id)}
                    className={`flex flex-col items-center justify-center rounded-2xl border w-20 h-28 text-[10px] font-semibold transition
                      ${
                        isSel
                          ? "border-blue-400 bg-blue-950/70"
                          : "border-slate-600 bg-slate-900"
                      } hover:border-blue-400 hover:bg-blue-950/50
                    `}
                  >
                    <span className="text-2xl mb-1">{r.emoji}</span>
                    <span>{r.name}</span>
                    <span className="mt-1 text-[9px] text-slate-400">
                      {isNew ? "NEW" : "OLD"}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={handleConfirmExchange}
              className="w-full mt-1 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-sm font-semibold"
            >
              Confirm Exchange
            </button>
          </div>
        </div>
      )}

      {/* Top content */}
      <div className="flex flex-col lg:flex-row gap-3 p-3 items-start">
        {/* Left: header + players */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-purple-400" />
              <h1 className="text-lg md:text-xl font-black tracking-wide">
                Coup – Funora Edition
              </h1>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400">
              <Info className="w-3 h-3" />
              <span>{phaseHint}</span>
            </div>
          </div>

          {actionBannerText && (
            <div className="mt-1 text-[11px] text-yellow-300 bg-yellow-500/10 border border-yellow-500/40 rounded-xl px-2 py-1">
              {actionBannerText}
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Users className="w-4 h-4" />
            <span>Turn: </span>
            <span className="font-semibold text-slate-100">
              {findPlayer(currentTurnPlayerId)?.name ?? "?"}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {gameState.turnOrder.map((pid) => {
              const ps = gameState.players[pid];
              const pMeta = findPlayer(pid);
              const isTurn = pid === currentTurnPlayerId;
              const isMe = pid === myId;

              const initials =
                (pMeta?.name || "?")
                  .split(" ")
                  .map((part) => part[0]?.toUpperCase() || "")
                  .slice(0, 2)
                  .join("") || "?";

              return (
                <button
                  key={pid}
                  onClick={() => handlePlayerCardClick(pid)}
                  className={`relative rounded-2xl border p-2 flex flex-col gap-2 text-left transition
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
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-100 border border-slate-500">
                      {initials}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold">
                        {pMeta?.name ?? "Player"}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {ps.alive ? "Alive" : "Eliminated"}
                      </span>
                    </div>
                    {isTurn && (
                      <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full bg-purple-600/30 text-purple-200">
                        TURN
                      </span>
                    )}
                    {isMe && (
                      <span className="ml-1 text-[9px] px-2 py-0.5 rounded-full bg-blue-600/30 text-blue-200">
                        YOU
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[10px]">
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

        {/* Right: roles panel + rules + log */}
        <div className="w-full lg:w-80 space-y-2">
          <div className="bg-slate-950/80 border border-slate-700 rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                <Info className="w-3 h-3 text-purple-400" /> Roles & Abilities
              </p>
              <p className="text-[10px] text-slate-500 sm:hidden">
                (Scroll ↓)
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs max-h-40 overflow-y-auto">
              {renderRoleCard(
                "💼",
                "Chancellor",
                "Tax: Take 3 coins.",
                "Blocks Foreign Aid."
              )}
              {renderRoleCard(
                "🗡",
                "Shadow",
                "Assassinate: Pay 3 coins to remove 1 influence.",
                "Blocked by Protector."
              )}
              {renderRoleCard(
                "🕵️",
                "Agent",
                "Steal: Take up to 2 coins from a player.",
                "Blocked by Agent or Diplomat."
              )}
              {renderRoleCard(
                "🎭",
                "Diplomat",
                "Exchange: Refresh your hidden cards.",
                "At most 1 new card per exchange."
              )}
              {renderRoleCard(
                "🛡",
                "Protector",
                "No action.",
                "Blocks Assassinate."
              )}
            </div>
          </div>

          {/* Simple rules */}
          <div className="bg-slate-950/80 border border-slate-700 rounded-2xl p-3 space-y-1">
            <p className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
              <Info className="w-3 h-3 text-blue-400" /> How to Play
            </p>
            <ul className="text-[10px] text-slate-400 space-y-1">
              <li>• Start with 2 hidden roles and 2 coins.</li>
              <li>• On your turn, choose an action (Income, Tax, Steal, etc.).</li>
              <li>• You can lie about your role to use stronger actions.</li>
              <li>• Anyone can Challenge role claims.</li>
              <li>• True claim: challenger loses a card, claimant swaps shown role.</li>
              <li>• False claim: liar loses a card and action is cancelled.</li>
              <li>• Assassinate & Coup force the target to lose influence.</li>
              <li>• Lose all influence = you’re out. Last player alive wins.</li>
            </ul>
          </div>

          {/* Log */}
          <div className="bg-slate-950/80 border border-slate-700 rounded-2xl p-3 space-y-1 max-h-52 overflow-y-auto">
            <p className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
              <Swords className="w-3 h-3 text-red-400" /> Action Log
            </p>
            {gameState.activityLog
              .slice()
              .reverse()
              .map((entry) => (
                <p
                  key={entry.id}
                  className="text-[10px] text-slate-400 border-b border-slate-800/80 pb-1 mb-1 last:border-none last:pb-0 last:mb-0"
                >
                  {entry.text}
                </p>
              ))}
          </div>
        </div>
      </div>

      {/* Bottom: your cards + action bar */}
      <div className="mt-auto p-3 border-t border-slate-800 bg-slate-950/95">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
          {/* Your influence */}
          <div className="flex flex-col gap-1">
            <p className="text-[11px] text-slate-400 mb-1">Your Influence</p>
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
                <p className="text-[10px] text-red-400 flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3 h-3" />
                  Choose which card to sacrifice.
                </p>
              )}
          </div>

          {/* Actions */}
          <div className="flex-1 flex flex-col gap-2 items-stretch">
            <div className="flex flex-wrap gap-2 justify-end text-[11px] md:text-xs">
              {isMyTurn && myState.alive && (
                <>
                  <button
                    onClick={() => startAction("income")}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 flex items-center gap-1"
                  >
                    <Coins className="w-3 h-3" />
                    <span>Income (+1)</span>
                  </button>
                  <button
                    onClick={() => startAction("foreign_aid")}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600"
                  >
                    Foreign Aid (+2)
                  </button>
                  <button
                    onClick={() => startAction("tax")}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-purple-500/70"
                  >
                    💼 Tax (3)
                  </button>
                  <button
                    disabled={myState.coins < 3}
                    onClick={() => setPendingTargetAction("assassinate")}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-red-500/70 disabled:opacity-40"
                  >
                    🗡 Assassinate (3)
                  </button>
                  <button
                    onClick={() => setPendingTargetAction("steal")}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-yellow-500/70"
                  >
                    🕵️ Steal (2)
                  </button>
                  <button
                    onClick={() => startAction("exchange")}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-blue-500/70 flex items-center gap-1"
                  >
                    <Shuffle className="w-3 h-3" />
                    <span>Exchange</span>
                  </button>
                  <button
                    disabled={myState.coins < 7}
                    onClick={() => setPendingTargetAction("coup")}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-pink-500/70 disabled:opacity-40"
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
                      className="px-3 py-1.5 rounded-xl bg-red-900/80 hover:bg-red-800 border border-red-500/80 flex items-center gap-1"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      <span>Challenge Action</span>
                    </button>
                  )}
                  {canBlock() && (
                    <div className="flex flex-wrap gap-1 justify-end">
                      {gameState.pendingAction?.type === "foreign_aid" && (
                        <button
                          onClick={() => handleBlock("chancellor")}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-purple-500/80"
                        >
                          Block as 💼 Chancellor
                        </button>
                      )}
                      {gameState.pendingAction?.type === "assassinate" && (
                        <button
                          onClick={() => handleBlock("protector")}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-green-500/80"
                        >
                          Block as 🛡 Protector
                        </button>
                      )}
                      {gameState.pendingAction?.type === "steal" && (
                        <>
                          <button
                            onClick={() => handleBlock("agent")}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-yellow-500/80"
                          >
                            Block as 🕵️ Agent
                          </button>
                          <button
                            onClick={() => handleBlock("diplomat")}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-blue-500/80"
                          >
                            Block as 🎭 Diplomat
                          </button>
                        </>
                      )}
                      <button
                        onClick={handleSkipBlock}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600"
                      >
                        Skip Block
                      </button>
                    </div>
                  )}
                  {canChallengeBlock() && (
                    <button
                      onClick={handleChallengeBlock}
                      className="px-3 py-1.5 rounded-xl bg-red-900/80 hover:bg-red-800 border border-red-500/80 flex items-center gap-1"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      <span>Challenge Block</span>
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Host helpers */}
            {isHost && (
              <div className="flex flex-wrap gap-2 justify-end text-[10px] mt-1 text-slate-300">
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
              <p className="text-[10px] text-yellow-300 text-right flex items-center gap-1 justify-end mt-1">
                <Swords className="w-3 h-3" />
                Select a target player on the table.
              </p>
            )}

            <div className="sm:hidden text-[10px] text-slate-400 text-right mt-1">
              {phaseHint}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
