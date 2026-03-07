import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import Game from './components/Game';
import './App.css';

const CHARACTERS = [
  { id: 'ninja', name: 'Ninja', emoji: '🥷', color: '#6366f1', weapon: '🗡️' },
  { id: 'robot', name: 'Robot', emoji: '🤖', color: '#3b82f6', weapon: '🔧' },
  { id: 'pirate', name: 'Pirate', emoji: '🏴‍☠️', color: '#ef4444', weapon: '⚔️' },
  { id: 'alien', name: 'Alien', emoji: '👽', color: '#22c55e', weapon: '🔫' },
  { id: 'knight', name: 'Knight', emoji: '⚔️', color: '#f59e0b', weapon: '🛡️' },
  { id: 'wizard', name: 'Wizard', emoji: '🧙', color: '#a855f7', weapon: '🔮' },
];

const GAME_MODES = [
  { id: 'ffa', name: 'Free-for-All', emoji: '⚔️', desc: 'Everyone vs everyone' },
  { id: 'team', name: 'Team', emoji: '🛡️', desc: '2v2 Red vs Blue' },
  { id: 'koth', name: 'King Hill', emoji: '👑', desc: 'Control center' },
  { id: 'lms', name: 'Last Stand', emoji: '💀', desc: '1 life only' },
];

interface Room {
  id: string;
  players: number;
  maxPlayers: number;
  status: string;
  mode?: string;
}

function App() {
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [selectedChar, setSelectedChar] = useState(CHARACTERS[0]);
  const [selectedMode, setSelectedMode] = useState(GAME_MODES[0]);
  const [gameStarted, setGameStarted] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [showInstructions, setShowInstructions] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Load saved data
  useEffect(() => {
    const savedName = localStorage.getItem('fightGame_playerName');
    if (savedName) setPlayerName(savedName);
    
    const savedChar = localStorage.getItem('fightGame_character');
    if (savedChar) {
      const char = CHARACTERS.find(c => c.id === savedChar);
      if (char) setSelectedChar(char);
    }
    
    const savedMode = localStorage.getItem('fightGame_mode');
    if (savedMode) {
      const mode = GAME_MODES.find(m => m.id === savedMode);
      if (mode) setSelectedMode(mode);
    }
  }, []);

  const handleNameChange = (name: string) => {
    setPlayerName(name);
    if (name.trim()) localStorage.setItem('fightGame_playerName', name);
  };

  const handleCharSelect = (char: typeof CHARACTERS[0]) => {
    setSelectedChar(char);
    localStorage.setItem('fightGame_character', char.id);
  };

  // Connect to socket for rooms
  useEffect(() => {
    const socket = io(window.location.origin);
    socketRef.current = socket;

    socket.on('connect', () => socket.emit('getRooms'));
    socket.on('roomsList', (data: { rooms: Room[] }) => setRooms(data.rooms));

    return () => { socket.disconnect(); };
  }, []);

  const handleJoin = () => {
    if (playerName.trim() && roomId.trim()) {
      localStorage.setItem('fightGame_playerName', playerName);
      localStorage.setItem('fightGame_character', selectedChar.id);
      localStorage.setItem('fightGame_mode', selectedMode.id);
      setGameStarted(true);
    }
  };

  const handleCreateRoom = () => {
    const newRoomId = Math.floor(100 + Math.random() * 900).toString();
    setRoomId(newRoomId);
  };

  const selectRoom = (id: string) => setRoomId(id);

  if (gameStarted) {
    return <Game playerName={playerName} roomId={roomId} character={selectedChar} gameMode={selectedMode.id} />;
  }

  return (
    <div className="menu">
      {/* Header */}
      <div className="header">
        <h1>👊 Fight Game</h1>
        <p className="subtitle">Multiplayer Battle Arena</p>
      </div>

      {/* Main Content Grid */}
      <div className="main-grid">
        {/* Left Column - Settings */}
        <div className="settings-col">
          {/* Name */}
          <div className="input-group">
            <label>Your Name</label>
            <input
              type="text"
              placeholder="Enter name"
              value={playerName}
              onChange={(e) => handleNameChange(e.target.value)}
              maxLength={12}
            />
          </div>

          {/* Game Mode - Compact Grid */}
          <div className="input-group">
            <label>Mode: <span className="mode-desc">{selectedMode.desc}</span></label>
            <div className="mode-grid">
              {GAME_MODES.map((mode) => (
                <button
                  key={mode.id}
                  className={`mode-btn ${selectedMode.id === mode.id ? 'selected' : ''}`}
                  onClick={() => setSelectedMode(mode)}
                >
                  {mode.emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Character */}
          <div className="input-group">
            <label>Fighter</label>
            <div className="char-grid">
              {CHARACTERS.map((char) => (
                <button
                  key={char.id}
                  className={`char-btn ${selectedChar.id === char.id ? 'selected' : ''}`}
                  onClick={() => handleCharSelect(char)}
                  style={{ 
                    borderColor: selectedChar.id === char.id ? char.color : 'transparent'
                  }}
                >
                  {char.emoji}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Rooms */}
        <div className="rooms-col">
          <div className="rooms-header">
            <span>Rooms</span>
            <button className="btn-new" onClick={handleCreateRoom}>+ Create</button>
          </div>
          
          <div className="rooms-list">
            {rooms.length === 0 ? (
              <div className="room-empty">No rooms yet</div>
            ) : (
              rooms.map((room) => (
                <div 
                  key={room.id}
                  className={`room-card ${roomId === room.id ? 'selected' : ''}`}
                  onClick={() => selectRoom(room.id)}
                >
                  <div className="room-top">
                    <span className="room-code">{room.id}</span>
                    <span className="room-mode-icon">
                      {room.mode === 'team' ? '🛡️' : room.mode === 'koth' ? '👑' : room.mode === 'lms' ? '💀' : '⚔️'}
                    </span>
                  </div>
                  <div className="room-bottom">
                    <span className="room-players">{room.players}/4</span>
                    <span className={`room-status ${room.status.toLowerCase().replace(' ', '-')}`}>{room.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Join Input */}
          <div className="join-section">
            <input
              type="text"
              placeholder="Or enter room code"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.replace(/\D/g, '').slice(0, 3))}
              maxLength={3}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="footer">
        <button 
          onClick={handleJoin} 
          className="btn-fight"
          disabled={!playerName.trim() || !roomId.trim()}
          style={{ background: selectedChar.color }}
        >
          {selectedChar.emoji} FIGHT!
        </button>
        
        <button className="btn-help" onClick={() => setShowInstructions(!showInstructions)}>
          {showInstructions ? 'Hide Help' : 'How to Play'}
        </button>

        {showInstructions && (
          <div className="help-box">
            <p><strong>Desktop:</strong> A/D = Move, W/Space = Jump, J = Attack, R = Ranged</p>
            <p><strong>Mobile:</strong> Use on-screen buttons</p>
            <p>Last fighter standing wins!</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
