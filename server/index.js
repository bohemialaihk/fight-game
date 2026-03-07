import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Allowed IP addresses
const ALLOWED_IPS = ['118.141.5.53', '118.141.118.163'];

const isAllowedIp = (ip, isSocket = false) => {
  // Remove IPv6 prefix if present
  const cleanIp = ip?.replace('::ffff:', '') || '';
  
  // Always allow localhost for internal proxy (port 3000 vite -> 3001 backend)
  if (cleanIp === '127.0.0.1' || cleanIp === '::1') return true;
  
  // For direct connections (Socket.IO on port 3001), check whitelist
  if (isSocket) {
    return ALLOWED_IPS.some(allowed => cleanIp === allowed);
  }
  
  // For HTTP requests through proxy, allow all (proxy handles it)
  return true;
};

// IP filtering middleware - only for HTTP API
const ipFilter = (req, res, next) => {
  const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const clientIp = rawIp?.split(',')[0]?.trim().replace('::ffff:', '') || '';

  // HTTP requests go through Vite proxy (port 3000), so they appear as 127.0.0.1
  // We allow these since Vite is the gatekeeper
  next();
};

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Apply IP filter to Socket.IO - this is where we enforce the whitelist
io.use((socket, next) => {
  const rawIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
  const clientIp = rawIp?.split(',')[0]?.trim().replace('::ffff:', '') || '';

  console.log('Socket connection from IP:', clientIp);

  // Check if IP is whitelisted (true for localhost proxy, check whitelist for direct)
  if (isAllowedIp(clientIp, true)) {
    next();
  } else {
    console.log('❌ Socket access denied for IP:', clientIp);
    next(new Error('Access denied - IP not whitelisted'));
  }
});

const PORT = process.env.PORT || 3001;

// Game constants
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 600;
const PLAYER_SIZE = 60;
const MOVE_SPEED = 5;
const JUMP_FORCE = 15;
const GRAVITY = 0.6;
const GROUND_Y = CANVAS_HEIGHT - 100;
const ATTACK_COOLDOWN = 500;
const ATTACK_RANGE = 60;
const ATTACK_DAMAGE = 20;
const RANGED_COOLDOWN = 2000;
const RANGED_SPEED = 12;
const RANGED_DAMAGE = 15;
const MAX_HEALTH = 100;
const GAME_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds
const ROOM_CLEANUP_INTERVAL = 60 * 1000; // Check every minute

// B2: Power-ups constants
const POWERUP_SPAWN_INTERVAL = 15000; // Spawn every 15 seconds
const POWERUP_TYPES = [
  { type: 'health', emoji: '❤️', effect: 'heal', value: 30, duration: 0 },
  { type: 'speed', emoji: '⚡', effect: 'speed', value: 2, duration: 5000 },
  { type: 'shield', emoji: '🛡️', effect: 'shield', value: 0, duration: 3000 },
  { type: 'super', emoji: '💥', effect: 'super', value: 2, duration: 5000 }
];

// Game rooms
const rooms = new Map();
const roomTimers = new Map();

class GameRoom {
  constructor(roomId, mode = 'ffa') {
    this.roomId = roomId;
    this.mode = mode; // 'ffa', 'team', 'koth', 'lms'
    this.players = new Map();
    this.projectiles = [];
    this.powerups = []; // B2: Power-ups system
    this.gameState = 'waiting'; // waiting, playing, ended
    this.winner = null;
    this.gameLoop = null;
    this.createdAt = Date.now();
    this.gameStartedAt = null;
    this.lastActivity = Date.now();
    this.kothZone = { x: CANVAS_WIDTH / 2 - 50, y: GROUND_Y - 50, width: 100, height: 100 }; // King of the Hill zone
    this.kothTimer = 0;
    this.kothHolder = null;
  }

  addPlayer(socket, playerName, character) {
    const spawnPositions = [
      { x: 200, y: GROUND_Y },
      { x: CANVAS_WIDTH - 240, y: GROUND_Y },
      { x: 400, y: GROUND_Y },
      { x: CANVAS_WIDTH - 440, y: GROUND_Y }
    ];
    
    const playerIndex = this.players.size;
    const spawn = spawnPositions[playerIndex % spawnPositions.length];
    
    // Default character if none provided
    const char = character || { 
      id: 'ninja', 
      name: 'Ninja', 
      emoji: '🥷', 
      color: '#6366f1', 
      style: 'ninja' 
    };

    // Assign team for team mode
    const team = this.mode === 'team' ? (playerIndex % 2 === 0 ? 'red' : 'blue') : null;
    
    this.players.set(socket.id, {
      id: socket.id,
      name: playerName,
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      width: PLAYER_SIZE,
      height: PLAYER_SIZE,
      health: MAX_HEALTH,
      maxHealth: MAX_HEALTH,
      facing: playerIndex % 2 === 0 ? 'right' : 'left',
      isAttacking: false,
      attackCooldown: 0,
      attackFrames: 0,
      rangedCooldown: 0,
      isHit: false,
      hitStun: 0,
      character: char,
      team: team, // For team mode
      keys: { left: false, right: false, up: false, attack: false, ranged: false },
      score: 0,
      alive: true,
      lives: this.mode === 'lms' ? 1 : null // Last Man Standing: 1 life only
    });

    this.broadcastGameState();
    broadcastRooms();
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
    if (this.players.size === 0) {
      this.stopGame();
      rooms.delete(this.roomId);
    } else {
      this.broadcastGameState();
    }
    broadcastRooms();
  }

  updateKeys(socketId, keys) {
    const player = this.players.get(socketId);
    if (!player || !player.alive) return;
    
    player.keys = { ...player.keys, ...keys };
  }

  startGame() {
    if (this.gameState === 'playing') return;
    
    this.gameStartedAt = Date.now();
    this.lastActivity = Date.now();
    
    // Set game end timer
    if (roomTimers.has(this.roomId)) {
      clearTimeout(roomTimers.get(this.roomId));
    }
    roomTimers.set(this.roomId, setTimeout(() => {
      this.endGameDueToTimeout();
    }, GAME_DURATION));
    
    // Reset all players
    const spawnPositions = [
      { x: 200, y: GROUND_Y },
      { x: CANVAS_WIDTH - 240, y: GROUND_Y },
      { x: 400, y: GROUND_Y },
      { x: CANVAS_WIDTH - 440, y: GROUND_Y }
    ];
    
    let index = 0;
    for (const player of this.players.values()) {
      const spawn = spawnPositions[index % spawnPositions.length];
      player.x = spawn.x;
      player.y = spawn.y;
      player.vx = 0;
      player.vy = 0;
      player.health = MAX_HEALTH;
      player.alive = true;
      player.score = 0;
      player.isAttacking = false;
      player.attackCooldown = 0;
      player.isHit = false;
      player.hitStun = 0;
      index++;
    }
    
    this.gameState = 'playing';
    this.winner = null;
    this.gameLoop = setInterval(() => this.tick(), 1000 / 30); // 30fps server
    this.broadcastGameState();
    broadcastRooms();
  }

  stopGame() {
    this.gameState = 'ended';
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }
    // Clear the timeout timer
    if (roomTimers.has(this.roomId)) {
      clearTimeout(roomTimers.get(this.roomId));
      roomTimers.delete(this.roomId);
    }
    broadcastRooms();
  }

  endGameDueToTimeout() {
    if (this.gameState !== 'playing') return;
    
    // Find player with highest score
    let highestScore = -1;
    let winner = null;
    
    for (const player of this.players.values()) {
      if (player.score > highestScore) {
        highestScore = player.score;
        winner = player;
      }
    }
    
    this.winner = winner;
    this.stopGame();
    
    // Notify players
    io.to(this.roomId).emit('gameState', {
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        x: p.x,
        y: p.y,
        width: p.width,
        height: p.height,
        health: p.health,
        maxHealth: p.maxHealth,
        facing: p.facing,
        isAttacking: p.isAttacking,
        isHit: p.isHit,
        character: p.character,
        score: p.score,
        alive: p.alive
      })),
      projectiles: this.projectiles,
      gameState: 'ended',
      winner: winner,
      canvasWidth: CANVAS_WIDTH,
      canvasHeight: CANVAS_HEIGHT,
      groundY: GROUND_Y,
      timeout: true
    });
    
    // Close room after 30 seconds
    setTimeout(() => {
      this.players.clear();
      rooms.delete(this.roomId);
      broadcastRooms();
    }, 30000);
  }

  tick() {
    const alivePlayers = Array.from(this.players.values()).filter(p => p.alive);
    
    // Check win condition
    if (alivePlayers.length <= 1 && this.players.size > 1) {
      if (alivePlayers.length === 1) {
        this.winner = alivePlayers[0];
        alivePlayers[0].score += 100;
      }
      this.stopGame();
      this.broadcastGameState();
      return;
    }

    // Update each player
    for (const player of this.players.values()) {
      if (!player.alive) continue;

      // Hit stun
      if (player.hitStun > 0) {
        player.hitStun--;
        continue;
      }
      player.isHit = false;

      // Attack cooldowns
      if (player.attackCooldown > 0) {
        player.attackCooldown--;
      }
      if (player.rangedCooldown > 0) {
        player.rangedCooldown--;
      }

      // Movement
      if (player.keys.left) {
        player.vx = -MOVE_SPEED;
        player.facing = 'left';
      } else if (player.keys.right) {
        player.vx = MOVE_SPEED;
        player.facing = 'right';
      } else {
        player.vx *= 0.8; // Friction
      }

      // Jump
      if (player.keys.up && player.y >= GROUND_Y) {
        player.vy = -JUMP_FORCE;
      }

      // Attack
      if (player.keys.attack && player.attackCooldown === 0 && !player.isAttacking) {
        player.isAttacking = true;
        player.attackCooldown = 30; // frames (~500ms at 60fps)
        player.attackFrames = 12; // Attack lasts 12 frames
        
        // Check hit immediately
        this.checkAttackHit(player);
      }
      
      // Handle attack duration
      if (player.isAttacking) {
        player.attackFrames--;
        if (player.attackFrames <= 0) {
          player.isAttacking = false;
        }
      }

      // Ranged attack (hidden skill - press R)
      if (player.keys.ranged && player.rangedCooldown === 0) {
        player.rangedCooldown = RANGED_COOLDOWN / 16; // ~2 seconds
        this.projectiles.push({
          x: player.facing === 'right' ? player.x + player.width : player.x,
          y: player.y + player.height / 2,
          vx: player.facing === 'right' ? RANGED_SPEED : -RANGED_SPEED,
          vy: 0,
          width: 20,
          height: 10,
          owner: player.id,
          color: player.character?.color || '#22c55e'
        });
      }

      // Apply physics
      player.vy += GRAVITY;
      player.x += player.vx;
      player.y += player.vy;

      // Ground collision
      if (player.y > GROUND_Y) {
        player.y = GROUND_Y;
        player.vy = 0;
      }

      // Wall collision
      if (player.x < 0) player.x = 0;
      if (player.x > CANVAS_WIDTH - player.width) player.x = CANVAS_WIDTH - player.width;
    }

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.x += proj.vx;
      proj.y += proj.vy;

      // Remove if off screen
      if (proj.x < -100 || proj.x > CANVAS_WIDTH + 100) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // Check collision with players
      for (const player of this.players.values()) {
        if (player.id === proj.owner || !player.alive) continue;

        if (
          proj.x < player.x + player.width &&
          proj.x + proj.width > player.x &&
          proj.y < player.y + player.height &&
          proj.y + proj.height > player.y
        ) {
          // Hit!
          player.health -= RANGED_DAMAGE;
          player.isHit = true;
          player.hitStun = 10;
          player.vx = proj.vx > 0 ? 8 : -8;

          if (player.health <= 0) {
            player.alive = false;
            player.health = 0;
            const owner = this.players.get(proj.owner);
            if (owner) owner.score += 50;
          }

          // Remove projectile
          this.projectiles.splice(i, 1);
          break;
        }
      }
    }

    this.broadcastGameState();
  }

  checkAttackHit(attacker) {
    if (!attacker.isAttacking) return;

    const attackX = attacker.facing === 'right' 
      ? attacker.x + attacker.width 
      : attacker.x - ATTACK_RANGE;
    const attackY = attacker.y;
    const attackWidth = ATTACK_RANGE;
    const attackHeight = attacker.height;

    for (const target of this.players.values()) {
      if (target.id === attacker.id || !target.alive) continue;

      // Check collision
      if (
        attackX < target.x + target.width &&
        attackX + attackWidth > target.x &&
        attackY < target.y + target.height &&
        attackY + attackHeight > target.y
      ) {
        // Hit!
        target.health -= ATTACK_DAMAGE;
        target.isHit = true;
        target.hitStun = 20; // Frames
        target.vx = attacker.facing === 'right' ? 10 : -10;
        target.vy = -5;

        if (target.health <= 0) {
          target.alive = false;
          target.health = 0;
          attacker.score += 50;
        }
      }
    }
  }

  broadcastGameState() {
    const gameState = {
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        x: p.x,
        y: p.y,
        width: p.width,
        height: p.height,
        health: p.health,
        maxHealth: p.maxHealth,
        facing: p.facing,
        isAttacking: p.isAttacking,
        isHit: p.isHit,
        character: p.character,
        score: p.score,
        alive: p.alive
      })),
      projectiles: this.projectiles,
      gameState: this.gameState,
      winner: this.winner,
      canvasWidth: CANVAS_WIDTH,
      canvasHeight: CANVAS_HEIGHT,
      groundY: GROUND_Y
    };

    io.to(this.roomId).emit('gameState', gameState);
  }
}

// Broadcast rooms list to all connected clients - throttled
let lastBroadcast = 0;
const BROADCAST_THROTTLE = 500; // Max once per 500ms

function broadcastRooms() {
  const now = Date.now();
  if (now - lastBroadcast < BROADCAST_THROTTLE) return;
  lastBroadcast = now;
  
  const roomList = Array.from(rooms.values()).map(room => ({
    id: room.roomId,
    players: room.players.size,
    maxPlayers: 4,
    status: room.gameState === 'waiting' ? 'Waiting' :
            room.gameState === 'playing' ? 'In Game' : 'Ended',
    mode: room.mode || 'ffa'
  }));

  io.emit('roomsList', { rooms: roomList });
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Send current rooms list
  socket.on('getRooms', () => {
    const roomList = Array.from(rooms.values()).map(room => ({
      id: room.roomId,
      players: room.players.size,
      maxPlayers: 4,
      status: room.gameState === 'waiting' ? 'Waiting' :
              room.gameState === 'playing' ? 'In Game' : 'Ended'
    }));
    socket.emit('roomsList', { rooms: roomList });
  });

  socket.on('joinRoom', ({ roomId, playerName, character, gameMode }) => {
    if (!roomId || !playerName) {
      socket.emit('error', 'Missing room ID or player name');
      return;
    }

    // Remove player from previous room if any
    if (socket.roomId && rooms.has(socket.roomId)) {
      const oldRoom = rooms.get(socket.roomId);
      oldRoom.removePlayer(socket.id);
      socket.leave(socket.roomId);
    }

    if (!rooms.has(roomId)) {
      // Create room with selected game mode (default to 'ffa')
      rooms.set(roomId, new GameRoom(roomId, gameMode || 'ffa'));
    }

    const room = rooms.get(roomId);
    
    // Check if player already in room (prevent duplicates)
    if (room.players.has(socket.id)) {
      console.log('Player already in room, updating...');
      room.removePlayer(socket.id);
    }
    
    if (room.players.size >= 4) {
      socket.emit('error', 'Room is full');
      return;
    }

    socket.join(roomId);
    room.addPlayer(socket, playerName, character);

    socket.roomId = roomId;
    socket.emit('joinedRoom', { roomId, playerId: socket.id });
    broadcastRooms();
  });

  socket.on('startGame', () => {
    const room = rooms.get(socket.roomId);
    if (room) {
      room.startGame();
    }
  });

  socket.on('keys', (keys) => {
    const room = rooms.get(socket.roomId);
    if (room) {
      room.updateKeys(socket.id, keys);
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        room.removePlayer(socket.id);
      }
    }
  });
});

// API endpoint to get available rooms
app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.values()).map(room => ({
    id: room.roomId,
    players: room.players.size,
    maxPlayers: 4,
    status: room.gameState === 'waiting' ? 'Waiting' : 
            room.gameState === 'playing' ? 'In Game' : 'Ended'
  }));
  
  res.json({ rooms: roomList });
});

// Serve static files in production
app.use(cors());
app.use(express.static(path.join(__dirname, '../dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Listen on localhost only for backend (port 3001)
// This prevents direct external access - only Vite proxy (port 3000) can connect
httpServer.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running on port ${PORT} (localhost only)`);
});
