import { useState } from 'react';
import { Sparkles, Users, Plus } from 'lucide-react';
import { AVATARS } from '../lib/gameLogic';

interface HomeProps {
  onCreateRoom: (name: string, avatar: string) => void;
  onJoinRoom: (code: string, name: string, avatar: string) => void;
}

export default function Home({ onCreateRoom, onJoinRoom }: HomeProps) {
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onCreateRoom(name, avatar);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!name.trim() || !roomCode.trim()) return;
    setLoading(true);
    try {
      await onJoinRoom(roomCode.toUpperCase(), name, avatar);
    } catch (error) {
      alert('Room not found!');
      setLoading(false);
    }
  };

  if (mode === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="relative">
                <Sparkles className="w-20 h-20 text-blue-500 animate-pulse" />
                <div className="absolute inset-0 blur-2xl bg-blue-400 opacity-20 animate-pulse"></div>
              </div>
            </div>
            <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
              Funora
            </h1>
            <p className="text-lg text-gray-600 font-medium">
              Your squad, your games, your chaos
            </p>
          </div>

          <div className="space-y-4 pt-8">
            <button
              onClick={() => setMode('create')}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-5 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center gap-3"
            >
              <Plus className="w-6 h-6" />
              Create Room
            </button>

            <button
              onClick={() => setMode('join')}
              className="w-full bg-white text-gray-700 py-5 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 border-2 border-gray-200 hover:border-blue-300 flex items-center justify-center gap-3"
            >
              <Users className="w-6 h-6" />
              Join Room
            </button>
          </div>

          <div className="pt-8 space-y-2 text-sm text-gray-500">
            <p className="flex items-center justify-center gap-2">
              <span className="text-2xl">🕵️</span> Guess the Imposter
            </p>
            <p className="flex items-center justify-center gap-2">
              <span className="text-2xl">🎭</span> Bluff & Truth
            </p>
            <p className="flex items-center justify-center gap-2">
              <span className="text-2xl">⚔️</span> Make Your Team
            </p>
            <p className="flex items-center justify-center gap-2">
              <span className="text-2xl">📊</span> Wavelength
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 space-y-6">
        <button
          onClick={() => setMode('menu')}
          className="text-gray-500 hover:text-gray-700 font-medium"
        >
          ← Back
        </button>

        <h2 className="text-3xl font-black text-gray-800">
          {mode === 'create' ? 'Create Room' : 'Join Room'}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Your Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 outline-none transition-colors text-lg"
              maxLength={20}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Choose Avatar</label>
            <div className="grid grid-cols-8 gap-2">
              {AVATARS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setAvatar(emoji)}
                  className={`text-3xl p-2 rounded-xl transition-all ${
                    avatar === emoji
                      ? 'bg-blue-100 ring-2 ring-blue-500 scale-110'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {mode === 'join' && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Room Code</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Enter 6-digit code"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 outline-none transition-colors text-lg uppercase tracking-widest text-center font-bold"
                maxLength={6}
              />
            </div>
          )}

          <button
            onClick={mode === 'create' ? handleCreate : handleJoin}
            disabled={loading || !name.trim() || (mode === 'join' && roomCode.length !== 6)}
            className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading ? 'Loading...' : mode === 'create' ? 'Create Room' : 'Join Room'}
          </button>
        </div>
      </div>
    </div>
  );
}
