# 👊 Fight Game Online

A real-time multiplayer fighting game built with React, TypeScript, Node.js, and Socket.io.

![Game Screenshot](screenshot.png)

## 🎮 Features

### Game Modes
- **Free-for-All** - Everyone vs everyone
- **Team Battle** - 2v2 Red vs Blue
- **King of the Hill** - Control the center zone
- **Last Man Standing** - 1 life only

### Characters
Choose from 6 unique fighters:
- 🥷 **Ninja** - Fast and agile
- 🤖 **Robot** - Heavy hitter
- 🏴‍☠️ **Pirate** - Balanced fighter
- 👽 **Alien** - Ranged specialist
- ⚔️ **Knight** - Tanky defender
- 🧙 **Wizard** - Magic attacks

### Power-ups
- ❤️ **Health Pack** - Restore 30 HP
- ⚡ **Speed Boost** - 2x movement speed
- 🛡️ **Shield** - Temporary invincibility
- 💥 **Super Attack** - Double damage

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/fight-game.git
cd fight-game

# Install dependencies
npm install

# Start development server
npm run dev
```

The game will be available at:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

### Production Build

```bash
# Build frontend
npm run build

# Start production server
npm start
```

## 🏗️ Architecture

```
📦 fight-game
├── 📁 src/
│   ├── App.tsx          # Main menu / lobby
│   ├── App.css          # Menu styles
│   ├── main.tsx         # Entry point
│   └── components/
│       ├── Game.tsx     # Game canvas & logic
│       └── Game.css     # Game styles
├── 📁 server/
│   └── index.js         # Socket.io server
├── 📄 package.json
├── 📄 vite.config.ts
└── 📄 README.md
```

## 🎯 Game Controls

### Desktop
- **A / D** or **← / →** - Move left/right
- **W** or **↑** or **Space** - Jump
- **J** - Attack (melee)
- **R** - Ranged attack

### Mobile
- Touch on-screen buttons
- Left side: Movement
- Right side: Jump, Attack, Ranged

## 🔧 Configuration

### Environment Variables
```env
PORT=3001                    # Server port
GAME_DURATION=600000         # Game duration (ms)
POWERUP_SPAWN_INTERVAL=15000 # Power-up spawn (ms)
```

### IP Whitelist
Edit `server/index.js`:
```javascript
const ALLOWED_IPS = ['your.ip.here'];
```

## 📝 API Endpoints

- `GET /api/rooms` - List available rooms
- `Socket: joinRoom` - Join a game room
- `Socket: startGame` - Start the game (host only)
- `Socket: keys` - Send player input
- `Socket: gameState` - Receive game updates

## 🎨 Customization

### Adding New Characters
Edit `src/App.tsx`:
```typescript
const CHARACTERS = [
  { id: 'newchar', name: 'New Char', emoji: '🆕', color: '#ff0000', weapon: '🔨' },
];
```

### Adding New Game Modes
```typescript
const GAME_MODES = [
  { id: 'newmode', name: 'New Mode', emoji: '🎮', desc: 'Description' },
];
```

## 🐛 Troubleshooting

### Game is laggy
- Reduce `TARGET_FPS` in Game.tsx
- Disable background grid rendering
- Use production build

### Can't connect
- Check IP whitelist
- Ensure ports 3000/3001 are open
- Check firewall settings

### Mobile touch not working
- Ensure `touch-action: manipulation` is set
- Check for console errors
- Try different browser

## 📄 License

MIT License - feel free to use and modify!

## 🤝 Contributing

Pull requests welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 🙏 Credits

Built with:
- [React](https://reactjs.org/)
- [Socket.io](https://socket.io/)
- [Vite](https://vitejs.dev/)
- [Node.js](https://nodejs.org/)

---

Made with ❤️ by [Your Name]
