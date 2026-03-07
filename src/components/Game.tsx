import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import './Game.css';
// v2 - cache bust

interface Character {
  id: string;
  name: string;
  emoji: string;
  color: string;
  weapon?: string;
}

interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  facing: 'left' | 'right';
  isAttacking: boolean;
  isHit: boolean;
  character: Character;
  score: number;
  alive: boolean;
}

interface Projectile {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface GameState {
  players: Player[];
  projectiles: Projectile[];
  gameState: 'waiting' | 'playing' | 'ended';
  winner: Player | null;
  canvasWidth: number;
  canvasHeight: number;
  groundY: number;
}

interface GameProps {
  playerName: string;
  roomId: string;
  character: Character;
  gameMode?: string;
}

function Game({ playerName, roomId, character, gameMode = 'ffa' }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [gameTimeLeft, setGameTimeLeft] = useState<number>(600); // 10 minutes in seconds
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const countdownRef = useRef<number | null>(null);
  const countdownStartedRef = useRef<boolean>(false);
  const keysRef = useRef({ left: false, right: false, up: false, attack: false, ranged: false });
  const gameStartTimeRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  // Keep countdownRef in sync
  useEffect(() => {
    countdownRef.current = countdown;
  }, [countdown]);

  useEffect(() => {
    if (!roomId || !playerName) {
      console.error('Missing roomId or playerName');
      return;
    }

    // Prevent duplicate connections
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    let reconnectTimer: NodeJS.Timeout;

    const connectSocket = () => {
      const socket = io(window.location.origin, {
        reconnection: false, // Disable auto-reconnect to prevent duplicates
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
        socket.emit('joinRoom', {
          roomId,
          playerName,
          character: character || { id: 'ninja', name: 'Ninja', emoji: '🥷', color: '#6366f1' },
          gameMode
        });
      });

      socket.on('joinedRoom', ({ playerId }) => {
        setPlayerId(playerId);
      });

      socket.on('disconnect', (reason) => {
        setConnectionStatus('disconnected');
        if (reason === 'io server disconnect') {
          // Server forced disconnect, try reconnect
          reconnectTimer = setTimeout(() => {
            if (reconnectAttemptsRef.current < maxReconnectAttempts) {
              reconnectAttemptsRef.current++;
              socket.connect();
            }
          }, 2000);
        }
      });

      socket.on('connect_error', () => {
        setConnectionStatus('disconnected');
      });

      // Throttle game state updates for mobile performance - REDUCED to 20fps
      let lastUpdate = 0;
      const UPDATE_INTERVAL = 1000 / 20; // 20fps for state updates (was 30fps)

      socket.on('gameState', (state: GameState) => {
        const now = Date.now();
        if (now - lastUpdate < UPDATE_INTERVAL) return;
        lastUpdate = now;

        // Use functional update to avoid closure staleness
        setGameState(prev => {
          // Only update if state actually changed
          if (JSON.stringify(prev) === JSON.stringify(state)) return prev;
          return state;
        });

        // Only start countdown once when game starts
        if (state.gameState === 'playing' && !countdownStartedRef.current) {
          countdownStartedRef.current = true;
          gameStartTimeRef.current = Date.now();
          setCountdown(3);
        }

        // Reset flag when game ends
        if (state.gameState === 'ended' || state.gameState === 'waiting') {
          countdownStartedRef.current = false;
          gameStartTimeRef.current = null;
        }
      });

      socket.on('error', (msg: string) => {
        console.error('Socket error:', msg);
      });

      return () => {
        clearTimeout(reconnectTimer);
        socket.disconnect();
      };
    };

    connectSocket();
  }, [roomId, playerName, character]);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setCountdown(null);
    }
  }, [countdown]);

  // Game timer countdown
  useEffect(() => {
    if (gameState?.gameState !== 'playing') {
      setGameTimeLeft(600);
      return;
    }

    const timer = setInterval(() => {
      if (gameStartTimeRef.current) {
        const elapsed = Math.floor((Date.now() - gameStartTimeRef.current) / 1000);
        const remaining = Math.max(0, 600 - elapsed);
        setGameTimeLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState?.gameState]);

  // Send keys to server - reduced frequency for mobile performance
  useEffect(() => {
    const interval = setInterval(() => {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('keys', keysRef.current);
      }
    }, 1000 / 20); // 20fps instead of 30fps

    return () => clearInterval(interval);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch(e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        keysRef.current.left = true;
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        keysRef.current.right = true;
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
      case ' ':
        keysRef.current.up = true;
        break;
      case 'j':
      case 'J':
        keysRef.current.attack = true;
        break;
      case 'r':
      case 'R':
        keysRef.current.ranged = true;
        break;
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    switch(e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        keysRef.current.left = false;
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        keysRef.current.right = false;
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
      case ' ':
        keysRef.current.up = false;
        break;
      case 'j':
      case 'J':
        keysRef.current.attack = false;
        break;
      case 'r':
      case 'R':
        keysRef.current.ranged = false;
        break;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Draw game with requestAnimationFrame for smooth performance
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let lastDrawTime = 0;
    const TARGET_FPS = 30; // Limit to 30fps for mobile performance
    const FRAME_INTERVAL = 1000 / TARGET_FPS;
    
    const draw = (timestamp: number) => {
      // Throttle drawing to target FPS
      if (timestamp - lastDrawTime < FRAME_INTERVAL) {
        animationId = requestAnimationFrame(draw);
        return;
      }
      lastDrawTime = timestamp;
      
      // Clear
      ctx.fillStyle = '#0f0f23';
      ctx.fillRect(0, 0, gameState.canvasWidth, gameState.canvasHeight);

    // Simplified background - no grid for better performance
    // Draw ground only
    ctx.fillStyle = '#2d2d4a';
    ctx.fillRect(0, gameState.groundY + 40, gameState.canvasWidth, gameState.canvasHeight - gameState.groundY - 40);
    
    // Ground line
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, gameState.groundY + 40);
    ctx.lineTo(gameState.canvasWidth, gameState.groundY + 40);
    ctx.stroke();

    // Draw players
    gameState.players.forEach((player) => {
      if (!player.alive) return;

      ctx.save();

      // Hit flash effect
      if (player.isHit) {
        ctx.globalAlpha = 0.6;
      }

      const charColor = player.character?.color || '#6366f1';
      const centerX = player.x + player.width / 2;
      const centerY = player.y + player.height / 2;
      
      // Character shadow (dynamic based on height)
      const groundY = gameState.groundY;
      const shadowScale = 1 - (groundY - player.y) / 400;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.ellipse(
        centerX, 
        player.y + player.height + 6, 
        (player.width / 2) * Math.max(0.6, shadowScale), 
        5 * Math.max(0.6, shadowScale), 
        0, 0, Math.PI * 2
      );
      ctx.fill();

      // Outer glow ring - scale with player size
      const radius = player.width / 2 + 2;
      ctx.shadowColor = charColor;
      ctx.shadowBlur = player.id === playerId ? 35 : 25;
      ctx.strokeStyle = charColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Inner circle background
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius - 3, 0, Math.PI * 2);
      ctx.fill();

      // Draw emoji character - scale font with size
      const fontSize = Math.floor(player.width * 0.75);
      ctx.font = `${fontSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        player.character?.emoji || '🥷', 
        centerX, 
        centerY
      );

      // Draw weapon when attacking
      if (player.isAttacking) {
        const weapon = player.character?.weapon || '🗡️';
        const weaponOffset = player.width / 2 + 8;
        const weaponX = player.facing === 'right' ? centerX + weaponOffset : centerX - weaponOffset;
        
        // Weapon swing animation
        ctx.save();
        ctx.translate(weaponX, centerY);
        ctx.rotate(player.facing === 'right' ? Math.PI / 4 : -Math.PI / 4);
        ctx.font = `${Math.floor(player.width * 0.5)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Weapon glow
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 20;
        ctx.fillText(weapon, 0, 0);
        ctx.shadowBlur = 0;
        ctx.restore();
        
        // Swipe effect - scale with size
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        const swipeOffset = player.width / 2 + 5;
        const swipeX = player.facing === 'right' ? centerX + swipeOffset : centerX - swipeOffset;
        ctx.arc(swipeX, centerY, swipeOffset, 0, Math.PI, player.facing === 'right');
        ctx.stroke();
      }

      ctx.restore();

      // Health bar above player - scale with character size
      const barWidth = player.width + 20;
      const barHeight = 14;
      const barX = player.x + (player.width - barWidth) / 2;
      const barY = player.y - 45;

      // Health bar background
      ctx.fillStyle = '#2a2a4a';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      // Health with gradient
      const healthPercent = player.health / player.maxHealth;
      const healthGradient = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
      if (healthPercent > 0.5) {
        healthGradient.addColorStop(0, '#4ade80');
        healthGradient.addColorStop(1, '#22c55e');
      } else if (healthPercent > 0.25) {
        healthGradient.addColorStop(0, '#fbbf24');
        healthGradient.addColorStop(1, '#f59e0b');
      } else {
        healthGradient.addColorStop(0, '#f87171');
        healthGradient.addColorStop(1, '#ef4444');
      }
      
      ctx.fillStyle = healthGradient;
      ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
      
      // Health bar border
      ctx.strokeStyle = charColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(barX, barY, barWidth, barHeight);

      // Health text
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.ceil(player.health)}`, barX + barWidth / 2, barY + barHeight / 2);

      // Name above health bar
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(player.name, centerX, barY - 6);

      // Player indicator - YOU badge (below name)
      if (player.id === playerId) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('▼ YOU', centerX, barY - 22);
      }
    });

    // Draw projectiles (ranged attacks)
    gameState.projectiles?.forEach((proj) => {
      if (!proj) return;
      
      ctx.save();
      
      const centerX = proj.x + (proj.width || 20) / 2;
      const centerY = proj.y + (proj.height || 10) / 2;
      const projColor = proj.color || '#22c55e';
      const projWidth = proj.width || 20;
      
      // Outer glow
      ctx.shadowColor = projColor;
      ctx.shadowBlur = 20;
      
      // Energy ball gradient
      const projGradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, projWidth
      );
      projGradient.addColorStop(0, '#ffffff');
      projGradient.addColorStop(0.3, projColor);
      projGradient.addColorStop(1, 'rgba(0,0,0,0)');
      
      ctx.fillStyle = projGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, projWidth, 0, Math.PI * 2);
      ctx.fill();
      
      // Trail effect
      ctx.shadowBlur = 10;
      ctx.fillStyle = projColor + '66';
      const trailLength = 30;
      const vx = proj.vx || 0;
      const movingRight = vx > 0;
      const trailX = movingRight ? proj.x - trailLength : proj.x + projWidth;
      ctx.beginPath();
      ctx.ellipse(
        trailX + trailLength / 2, centerY,
        trailLength / 2, (proj.height || 10) / 3,
        0, 0, Math.PI * 2
      );
      ctx.fill();
      
      ctx.restore();
    });
    };
    
    // Use requestAnimationFrame for smooth rendering
    const animate = () => {
      draw();
      animationId = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [gameState, playerId]);

  const handleStartGame = () => {
    if (socketRef.current) {
      socketRef.current.emit('startGame');
    }
  };

  // Request fullscreen on mobile when game starts
  const requestFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(() => {});
    } else if ((elem as any).webkitRequestFullscreen) {
      (elem as any).webkitRequestFullscreen();
    } else if ((elem as any).msRequestFullscreen) {
      (elem as any).msRequestFullscreen();
    }
  };

  const currentPlayer = gameState?.players.find(p => p.id === playerId);
  const isHost = gameState?.players[0]?.id === playerId;

  // Format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="game-container">
      {/* Connection status indicator */}
      {connectionStatus === 'disconnected' && (
        <div className="connection-status error">
          ⚠️ Reconnecting... ({reconnectAttemptsRef.current}/{maxReconnectAttempts})
        </div>
      )}
      {connectionStatus === 'connecting' && (
        <div className="connection-status connecting">
          🔄 Connecting...
        </div>
      )}

      <div className="game-header">
        <div className="header-left">
          <h2>Room: {roomId}</h2>
        </div>
        {gameState?.gameState === 'playing' && (
          <div className="header-right">
            <div className={`game-timer ${gameTimeLeft < 60 ? 'urgent' : ''}`}>
              ⏱️ {formatTime(gameTimeLeft)}
            </div>
          </div>
        )}
        <div className="players-list">
          {gameState?.players.map(player => (
            <div 
              key={player.id} 
              className={`player-badge ${player.alive ? 'alive' : 'dead'} ${player.id === playerId ? 'me' : ''}`}
              style={{ borderColor: player.character?.color || '#6366f1' }}
            >
              <span className="player-emoji">{player.character?.emoji || '🥷'}</span>
              <div className="player-info">
                <span className="player-name">{player.name}</span>
                <div className="health-bar-small">
                  <div 
                    className="health-fill" 
                    style={{ 
                      width: `${(player.health / player.maxHealth) * 100}%`,
                      background: player.character?.color || '#6366f1'
                    }}
                  />
                </div>
              </div>
              <span className="player-score">{player.score} pts</span>
            </div>
          ))}
        </div>
      </div>

      <div className="game-board">
        <canvas
          ref={canvasRef}
          width={gameState?.canvasWidth || 1200}
          height={gameState?.canvasHeight || 600}
          className="game-canvas"
        />
        
        {countdown !== null && (
          <div className="countdown">{countdown}</div>
        )}
        
        {gameState?.gameState === 'waiting' && isHost && (
          <div className="overlay">
            <button onClick={() => { requestFullscreen(); handleStartGame(); }} className="btn-start">
              Start Fight! (Fullscreen)
            </button>
          </div>
        )}
        
        {gameState?.gameState === 'waiting' && !isHost && (
          <div className="overlay">
            <p>Waiting for host...</p>
          </div>
        )}
        
        {gameState?.gameState === 'ended' && gameState.winner && (
          <div className="overlay">
            <div className="game-over">
              <h2>🏆 {gameState.winner.name} Wins!</h2>
              <p className="winner-text">Knockout Victory</p>
              <button onClick={handleStartGame} className="btn-start">
                Fight Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Touch controls for mobile - optimized for responsiveness */}
      {gameState?.gameState === 'playing' && (
        <div className="touch-controls">
          <div className="touch-left">
            <button 
              className="touch-btn"
              onTouchStart={(e) => { e.preventDefault(); keysRef.current.left = true; }}
              onTouchEnd={(e) => { e.preventDefault(); keysRef.current.left = false; }}
              onMouseDown={() => keysRef.current.left = true}
              onMouseUp={() => keysRef.current.left = false}
              onMouseLeave={() => keysRef.current.left = false}
            >
              ←
            </button>
            <button 
              className="touch-btn"
              onTouchStart={(e) => { e.preventDefault(); keysRef.current.right = true; }}
              onTouchEnd={(e) => { e.preventDefault(); keysRef.current.right = false; }}
              onMouseDown={() => keysRef.current.right = true}
              onMouseUp={() => keysRef.current.right = false}
              onMouseLeave={() => keysRef.current.right = false}
            >
              →
            </button>
          </div>
          <div className="touch-right">
            <button 
              className="touch-btn jump"
              onTouchStart={(e) => { e.preventDefault(); keysRef.current.up = true; }}
              onTouchEnd={(e) => { e.preventDefault(); keysRef.current.up = false; }}
              onMouseDown={() => keysRef.current.up = true}
              onMouseUp={() => keysRef.current.up = false}
            >
              ↑
            </button>
            <button 
              className="touch-btn attack"
              onTouchStart={(e) => { e.preventDefault(); keysRef.current.attack = true; }}
              onTouchEnd={(e) => { e.preventDefault(); keysRef.current.attack = false; }}
              onMouseDown={() => keysRef.current.attack = true}
              onMouseUp={() => keysRef.current.attack = false}
            >
              ⚔️
            </button>
            <button 
              className="touch-btn ranged"
              onTouchStart={(e) => { e.preventDefault(); keysRef.current.ranged = true; }}
              onTouchEnd={(e) => { e.preventDefault(); keysRef.current.ranged = false; }}
              onMouseDown={() => keysRef.current.ranged = true}
              onMouseUp={() => keysRef.current.ranged = false}
            >
              🔥
            </button>
          </div>
        </div>
      )}

      <div className="game-controls">
        <div className="control-hint desktop-only">
          <span><strong>A/D</strong> Move</span>
          <span><strong>W/Space</strong> Jump</span>
          <span><strong>J</strong> Attack</span>
          <span><strong>R</strong> Ranged</span>
        </div>
        <div className="control-hint mobile-only">
          <span>Use on-screen buttons on mobile</span>
        </div>
      </div>
    </div>
  );
}

export default Game;
