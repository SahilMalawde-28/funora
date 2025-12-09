import { useState } from 'react';
import {
  Sparkles,
  Users,
  Plus,
  PartyPopper,
  MessageCircle,
  Star,
  Gamepad2,
  Globe2,
  LayoutDashboard,
  UserCircle,
  ChevronRight,
} from 'lucide-react';
import { AVATARS } from '../lib/gameLogic';

interface HomeProps {
  onCreateRoom: (name: string, avatar: string) => void;
  onJoinRoom: (code: string, name: string, avatar: string) => void;
}

// Local copy of games list just for UI display
const GAMES = [
  {
    id: 'imposter',
    name: 'Guess the Imposter',
    description:
      'Everyone gets a word — imposters get a different one. Discuss, lie, and vote!',
    minPlayers: 3,
    emoji: '🕵️',
  },
  {
    id: 'bluff',
    name: 'Bluff & Truth',
    description: 'A question is asked; liars get a fake one. Chaos ensues!',
    minPlayers: 3,
    emoji: '🎭',
  },
  {
    id: 'team',
    name: 'Make Your Team',
    description: 'Draft-style selection: build your dream team turn-by-turn!',
    minPlayers: 2,
    emoji: '⚔️',
  },
  {
    id: 'wavelength',
    name: 'Wavelength',
    description:
      'Guess where on the scale (Hot–Cold, Funny–Serious) the hidden point is!',
    minPlayers: 3,
    emoji: '📊',
  },
  {
    id: 'wordguess',
    name: 'Word Guess',
    description: 'Get hints and guess the word! Max 15 hints before the big reveal.',
    minPlayers: 2,
    emoji: '🔤',
  },
  {
    id: 'chain',
    name: 'Chain Rapid Fire',
    description: 'Rapid-fire answers! Keep the chain going or get knocked out!',
    minPlayers: 2,
    emoji: '⚡',
  },
  {
    id: 'boilingWater',
    name: 'Boiling Water',
    description: 'Guess near the average × 0.8 — don’t let your score boil over!',
    emoji: '🔥',
    minPlayers: 3,
  },
  {
    id: 'memory',
    name: 'Grid GOAT',
    description: 'Remember, manipulate and conquer.',
    emoji: '🃏',
    minPlayers: 2,
  },
  {
    id: 'herd',
    name: 'Herd Mentality',
    description: 'Go with the crowd or you will end up lost.',
    emoji: '🐮',
    minPlayers: 2,
  },
  {
    id: 'cham',
    name: 'Chameleon',
    description: 'Blend with others.',
    emoji: '🦎',
    minPlayers: 3,
  },
  {
    id: 'coup',
    name: 'Coup – Funora',
    description: 'Bluff, block, steal, assassinate, survive.',
    emoji: '🪙',
    minPlayers: 2,
  },
];

type View =
  | 'dashboard'
  | 'create'
  | 'join'
  | 'public'
  | 'groups'
  | 'games'
  | 'profile';

export default function Home({ onCreateRoom, onJoinRoom }: HomeProps) {
  const [view, setView] = useState<View>('dashboard');

  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);

  // Dummy stats for now (later from Supabase/profile)
  const totalWins = 12;
  const totalGames = 37;
  const streakDays = 5;

  // Dummy groups & rooms (UI only for now)
  const dummyGroups = [
    { id: 'grp1', name: 'Hostel Squad', members: 8, online: 3 },
    { id: 'grp2', name: 'CSE A - Batch', members: 32, online: 10 },
    { id: 'grp3', name: 'Weekend Lobby', members: 5, online: 2 },
  ];

  const dummyPublicRooms = [
    { code: 'FUN123', game: 'Guess the Imposter', players: 6, status: 'Waiting' },
    { code: 'IMP456', game: 'Bluff & Truth', players: 4, status: 'In Game' },
    { code: 'WAVE99', game: 'Wavelength', players: 5, status: 'Waiting' },
    { code: 'CHAIN7', game: 'Chain Rapid Fire', players: 3, status: 'In Game' },
  ];

  const recentRooms = [
    { code: 'KJS491', game: 'Wavelength', status: 'Finished' },
    { code: 'BHF921', game: 'Guess the Imposter', status: 'Finished' },
    { code: 'FUN777', game: 'Chameleon', status: 'Finished' },
  ];

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onCreateRoom(name.trim(), avatar);
      // parent will typically navigate; if not, we could reset here
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!name.trim() || !roomCode.trim()) return;
    setLoading(true);
    try {
      await onJoinRoom(roomCode.toUpperCase(), name.trim(), avatar);
    } catch (error) {
      alert('Room not found!');
      setLoading(false);
    }
  };

  // =====================================================================
  // MAIN LAYOUT (SIDEBAR + MAIN PANEL)
  // =====================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-4 p-4 md:p-6">
        {/* SIDEBAR */}
        <aside className="md:w-64 bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-gray-100 p-4 flex flex-col gap-4">
          {/* Logo + mini title */}
          <div className="flex items-center gap-3 mb-1">
            <div className="relative">
              <Sparkles className="w-8 h-8 text-indigo-500" />
              <div className="absolute inset-0 bg-indigo-400 blur-xl opacity-20" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-gray-400 font-semibold">
                Party Hub
              </p>
              <h1 className="text-xl font-black text-gray-900 -mt-1">Funora</h1>
            </div>
          </div>

          {/* Profile snippet */}
          <div
            className="flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 cursor-pointer hover:shadow-md transition"
            onClick={() => setView('profile')}
          >
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center text-2xl">
              {avatar}
            </div>
            <div className="flex-1 text-left">
              <p className="text-xs text-gray-500">Signed in as</p>
              <p className="text-sm font-bold text-gray-800 truncate">
                {name.trim() || 'Player'}
              </p>
            </div>
            <UserCircle className="w-5 h-5 text-indigo-500" />
          </div>

          {/* NAVIGATION */}
          <nav className="flex-1 space-y-1 text-sm">
            <SidebarButton
              icon={<LayoutDashboard className="w-4 h-4" />}
              label="Dashboard"
              active={view === 'dashboard'}
              onClick={() => setView('dashboard')}
            />
            <SidebarButton
              icon={<Gamepad2 className="w-4 h-4" />}
              label="Play / Create Room"
              active={view === 'create' || view === 'join'}
              onClick={() => setView('create')}
            />
            <SidebarButton
              icon={<Globe2 className="w-4 h-4" />}
              label="Public Rooms"
              active={view === 'public'}
              onClick={() => setView('public')}
            />
            <SidebarButton
              icon={<Users className="w-4 h-4" />}
              label="Groups"
              active={view === 'groups'}
              onClick={() => setView('groups')}
            />
            <SidebarButton
              icon={<Star className="w-4 h-4" />}
              label="Explore Games"
              active={view === 'games'}
              onClick={() => setView('games')}
            />
          </nav>

          {/* QUICK ACTION IN SIDEBAR */}
          <button
            onClick={() => setView('create')}
            className="mt-1 w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold text-sm shadow-lg hover:shadow-xl hover:scale-[1.02] transition"
          >
            + Create Room
          </button>

          {/* Small footnote */}
          <p className="text-[11px] text-gray-400 text-center mt-1">
            Party mode, profiles & groups are coming soon. For now, create or join rooms
            like usual.
          </p>
        </aside>

        {/* MAIN PANEL */}
        <main className="flex-1">
          {view === 'dashboard' && (
            <DashboardView
              name={name}
              avatar={avatar}
              totalWins={totalWins}
              totalGames={totalGames}
              streakDays={streakDays}
              dummyPublicRooms={dummyPublicRooms}
              recentRooms={recentRooms}
              onGoCreate={() => setView('create')}
              onGoJoin={() => setView('join')}
            />
          )}

          {view === 'create' && (
            <CreateView
              name={name}
              avatar={avatar}
              loading={loading}
              setName={setName}
              setAvatar={setAvatar}
              onCreate={handleCreate}
              onSwitchToJoin={() => setView('join')}
            />
          )}

          {view === 'join' && (
            <JoinView
              name={name}
              avatar={avatar}
              roomCode={roomCode}
              loading={loading}
              setName={setName}
              setAvatar={setAvatar}
              setRoomCode={setRoomCode}
              onJoin={handleJoin}
              onSwitchToCreate={() => setView('create')}
            />
          )}

          {view === 'public' && (
            <PublicRoomsView
              rooms={dummyPublicRooms}
              onJoinClick={(code) => {
                setRoomCode(code);
                setView('join');
              }}
            />
          )}

          {view === 'groups' && <GroupsView groups={dummyGroups} />}

          {view === 'games' && <GamesView />}

          {view === 'profile' && (
            <ProfileView
              name={name}
              avatar={avatar}
              totalWins={totalWins}
              totalGames={totalGames}
              streakDays={streakDays}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// =====================================================================
// SUB-VIEWS
// =====================================================================

function DashboardView({
  name,
  avatar,
  totalWins,
  totalGames,
  streakDays,
  dummyPublicRooms,
  recentRooms,
  onGoCreate,
  onGoJoin,
}: {
  name: string;
  avatar: string;
  totalWins: number;
  totalGames: number;
  streakDays: number;
  dummyPublicRooms: { code: string; game: string; players: number; status: string }[];
  recentRooms: { code: string; game: string; status: string }[];
  onGoCreate: () => void;
  onGoJoin: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* HERO + QUICK PLAY */}
      <section className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-gray-100 p-6 md:p-8 flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="flex-1 space-y-3">
          <p className="text-sm text-gray-500 font-medium">Welcome back,</p>
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 flex items-center gap-3">
            {name.trim() || 'Player'}
            <span className="text-3xl">{avatar}</span>
          </h2>
          <p className="text-sm md:text-base text-gray-600 max-w-xl">
            Spin up a private room for your friends, or jump into a public lobby. Funora
            handles the chaos, you handle the laughs.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={onGoCreate}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold text-sm shadow-lg hover:shadow-xl hover:scale-[1.02] transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Room
            </button>
            <button
              onClick={onGoJoin}
              className="px-5 py-3 rounded-2xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 transition flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              Join by Code
            </button>
          </div>
        </div>

        {/* PARTY MODE + STATS */}
        <div className="w-full lg:w-72 space-y-3">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-yellow-100 to-orange-100 border border-yellow-200 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-yellow-800 mb-1 flex items-center gap-1">
                <PartyPopper className="w-4 h-4" />
                Party Mode
              </p>
              <p className="text-xs text-yellow-900">
                Play 5 random games, scores tallied across all. Coming soon.
              </p>
            </div>
            <PartyPopper className="w-8 h-8 text-yellow-600" />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <StatChip label="Total Wins" value={totalWins.toString()} />
            <StatChip label="Games Played" value={totalGames.toString()} />
            <StatChip label="Day Streak" value={streakDays.toString()} />
          </div>
        </div>
      </section>

      {/* PUBLIC ROOMS + RECENT ROOMS */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Public Rooms */}
        <div className="lg:col-span-2 bg-white/80 backdrop-blur-xl rounded-3xl shadow-lg border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-indigo-500" />
              Live Public Rooms
            </h3>
            <span className="text-[11px] text-gray-500">Tap any code & join via code</span>
          </div>
          {dummyPublicRooms.length === 0 ? (
            <p className="text-xs text-gray-500 italic">No public rooms yet.</p>
          ) : (
            <div className="space-y-2">
              {dummyPublicRooms.map((r) => (
                <div
                  key={r.code}
                  className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100 text-xs"
                >
                  <div>
                    <p className="font-semibold text-gray-800 flex items-center gap-2">
                      <span className="px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-mono tracking-widest">
                        {r.code}
                      </span>
                      <span>{r.game}</span>
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {r.players} players • {r.status}
                    </p>
                  </div>
                  <span className="text-[11px] text-gray-400">
                    Use room code to join
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Rooms */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-lg border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-indigo-500" />
            Recent Rooms
          </h3>
          {recentRooms.length === 0 ? (
            <p className="text-xs text-gray-500 italic">
              Play a few games and they’ll show up here.
            </p>
          ) : (
            <div className="space-y-2 text-xs">
              {recentRooms.map((room) => (
                <div
                  key={room.code}
                  className="flex items-center justify-between p-2 rounded-xl bg-gray-50 border border-gray-100"
                >
                  <div>
                    <p className="font-semibold text-gray-800">{room.game}</p>
                    <p className="text-[11px] text-gray-500">
                      Code:{" "}
                      <span className="font-mono tracking-widest">{room.code}</span>
                    </p>
                  </div>
                  <p className="text-[11px] text-gray-400">{room.status}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* GAME STRIP */}
      <section className="mt-2">
        <p className="text-xs text-gray-500 mb-2 font-medium">Popular Games</p>
        <div className="flex flex-wrap gap-2">
          <GameTag emoji="🕵️" label="Guess the Imposter" />
          <GameTag emoji="🎭" label="Bluff & Truth" />
          <GameTag emoji="📊" label="Wavelength" />
          <GameTag emoji="🦎" label="Chameleon" />
          <GameTag emoji="🃏" label="Grid GOAT" />
          <GameTag emoji="⚡" label="Chain Rapid Fire" />
        </div>
      </section>
    </div>
  );
}

function CreateView({
  name,
  avatar,
  loading,
  setName,
  setAvatar,
  onCreate,
  onSwitchToJoin,
}: {
  name: string;
  avatar: string;
  loading: boolean;
  setName: (v: string) => void;
  setAvatar: (v: string) => void;
  onCreate: () => void;
  onSwitchToJoin: () => void;
}) {
  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-gray-100 p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">
            Start a Room
          </p>
          <h2 className="text-2xl font-black text-gray-900">Create Room</h2>
        </div>
        <button
          onClick={onSwitchToJoin}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
        >
          Have a code? Join instead →
        </button>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Your Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none transition-colors text-lg"
            maxLength={20}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Choose Avatar
          </label>
          <div className="grid grid-cols-8 gap-2">
            {AVATARS.map((em) => (
              <button
                key={em}
                onClick={() => setAvatar(em)}
                className={`text-3xl p-2 rounded-xl transition-all ${
                  avatar === em
                    ? 'bg-indigo-100 ring-2 ring-indigo-500 scale-110'
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                {em}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onCreate}
          disabled={loading || !name.trim()}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition disabled:opacity-50 disabled:scale-100"
        >
          {loading ? 'Creating…' : 'Create Room'}
        </button>
      </div>
    </div>
  );
}

function JoinView({
  name,
  avatar,
  roomCode,
  loading,
  setName,
  setAvatar,
  setRoomCode,
  onJoin,
  onSwitchToCreate,
}: {
  name: string;
  avatar: string;
  roomCode: string;
  loading: boolean;
  setName: (v: string) => void;
  setAvatar: (v: string) => void;
  setRoomCode: (v: string) => void;
  onJoin: () => void;
  onSwitchToCreate: () => void;
}) {
  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-gray-100 p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">
            Join Friends
          </p>
          <h2 className="text-2xl font-black text-gray-900">Join Room</h2>
        </div>
        <button
          onClick={onSwitchToCreate}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
        >
          No code? Create room →
        </button>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Your Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none transition-colors text-lg"
            maxLength={20}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Choose Avatar
          </label>
          <div className="grid grid-cols-8 gap-2">
            {AVATARS.map((em) => (
              <button
                key={em}
                onClick={() => setAvatar(em)}
                className={`text-3xl p-2 rounded-xl transition-all ${
                  avatar === em
                    ? 'bg-indigo-100 ring-2 ring-indigo-500 scale-110'
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                {em}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Room Code</label>
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="Enter 6-digit code"
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none transition-colors text-lg uppercase text-center tracking-wider font-bold"
            maxLength={6}
          />
        </div>

        <button
          onClick={onJoin}
          disabled={loading || !name.trim() || roomCode.length !== 6}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition disabled:opacity-50 disabled:scale-100"
        >
          {loading ? 'Joining…' : 'Join Room'}
        </button>
      </div>
    </div>
  );
}

function PublicRoomsView({
  rooms,
  onJoinClick,
}: {
  rooms: { code: string; game: string; players: number; status: string }[];
  onJoinClick: (code: string) => void;
}) {
  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-gray-100 p-6 md:p-8 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <Globe2 className="w-5 h-5 text-indigo-500" />
          Public Rooms
        </h2>
        <span className="text-[11px] text-gray-500">UI preview — dummy data</span>
      </div>
      {rooms.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No public rooms right now.</p>
      ) : (
        <div className="space-y-3">
          {rooms.map((r) => (
            <button
              key={r.code}
              onClick={() => onJoinClick(r.code)}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:border-indigo-300 hover:bg-indigo-50 transition text-left"
            >
              <div>
                <p className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                  <span className="px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-mono tracking-widest">
                    {r.code}
                  </span>
                  <span>{r.game}</span>
                </p>
                <p className="text-[11px] text-gray-500 mt-1">
                  {r.players} players • {r.status}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupsView({
  groups,
}: {
  groups: { id: string; name: string; members: number; online: number }[];
}) {
  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-gray-100 p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-500" />
          Groups
        </h2>
        <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
          + Create Group (soon)
        </button>
      </div>
      <p className="text-sm text-gray-500">
        Groups are like permanent lobbies for your people — you’ll be able to chat, see
        who’s online, and start rooms in one tap.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {groups.map((g) => (
          <div
            key={g.id}
            className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between"
          >
            <div>
              <p className="font-semibold text-gray-900 text-sm">{g.name}</p>
              <p className="text-[11px] text-gray-500 mt-1">
                {g.members} members • {g.online} online
              </p>
            </div>
            <span className="text-[11px] px-2 py-1 rounded-full bg-green-100 text-green-700">
              Coming soon
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GamesView() {
  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-gray-100 p-6 md:p-8 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <Gamepad2 className="w-5 h-5 text-indigo-500" />
          Games on Funora
        </h2>
        <span className="text-[11px] text-gray-500">Tap to see descriptions</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {GAMES.map((g) => (
          <div
            key={g.id}
            className="p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:border-indigo-300 hover:bg-indigo-50 transition flex flex-col gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{g.emoji}</span>
                <p className="font-semibold text-gray-900 text-sm">{g.name}</p>
              </div>
              <span className="text-[10px] text-gray-500">
                {g.minPlayers}+ players
              </span>
            </div>
            <p className="text-[11px] text-gray-600">{g.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileView({
  name,
  avatar,
  totalWins,
  totalGames,
  streakDays,
}: {
  name: string;
  avatar: string;
  totalWins: number;
  totalGames: number;
  streakDays: number;
}) {
  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-gray-100 p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <UserCircle className="w-5 h-5 text-indigo-500" />
          Profile
        </h2>
        <span className="text-[11px] text-gray-500">
          Real profiles coming later – this is UI only.
        </span>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-indigo-100 flex items-center justify-center text-4xl">
            {avatar}
          </div>
          <div>
            <p className="text-xs text-gray-500">Display Name</p>
            <p className="text-xl font-black text-gray-900">{name.trim() || 'Player'}</p>
            <p className="text-xs text-gray-500 mt-1">
              Linked to your browser for now. Profiles with login later.
            </p>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-3 gap-3 text-center text-xs">
          <StatChip label="Total Wins" value={totalWins.toString()} />
          <StatChip label="Games Played" value={totalGames.toString()} />
          <StatChip label="Day Streak" value={streakDays.toString()} />
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// SMALL COMPONENTS
// =====================================================================

function SidebarButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-2xl text-xs font-semibold transition ${
        active
          ? 'bg-indigo-100 text-indigo-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <span className="w-5 h-5 flex items-center justify-center">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function Feature({
  icon,
  label,
  desc,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-200 hover:bg-gray-100 transition">
      <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
        {icon}
      </div>
      <div>
        <p className="font-bold text-gray-700 text-sm">{label}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
    </div>
  );
}

function GameTag({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="px-4 py-2 bg-gray-50 rounded-full border border-gray-200 text-sm flex items-center gap-2 shadow-sm">
      <span className="text-lg">{emoji}</span>
      <span className="font-medium text-gray-700">{label}</span>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col items-center justify-center">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-sm font-bold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}
