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

## 🤖 OpenClaw Integration

[OpenClaw](https://openclaw.ai) is an AI agent platform with an OpenAI-compatible API that lets you connect AI bots to your fight game server. Bots connect via WebSockets, receive live game state, and respond with actions just like human players.

### Getting an API Key

1. Sign up at [openclaw.ai](https://openclaw.ai) and create an account.
2. Go to **Settings → API Keys** and click **Generate New Key**.
3. Copy the key — it looks like `sk-oc-...` and is only shown once.

Store the key in your environment:

```env
OPENCLAW_API_KEY=sk-oc-your-key-here
```

> **Never commit your API key to source control.** The `.gitignore` already excludes `.env` files.

### Connecting an OpenClaw Bot

The example below shows a minimal Node.js bot that joins a fight game room and picks moves using the OpenClaw chat-completions endpoint:

```javascript
// openclaw-bot.js
import { io } from 'socket.io-client';
import fetch from 'node-fetch';

const OPENCLAW_API_KEY = process.env.OPENCLAW_API_KEY;
if (!OPENCLAW_API_KEY) {
  console.error('Error: OPENCLAW_API_KEY environment variable is not set.');
  process.exit(1);
}

const GAME_SERVER = 'http://localhost:3001';
const ROOM_CODE = '123'; // room to join

const socket = io(GAME_SERVER);

socket.on('connect', () => {
  socket.emit('joinRoom', {
    room: ROOM_CODE,
    name: 'OpenClaw Bot',
    character: 'robot',
    mode: 'ffa',
  });
});

// Map the action to the keys the server expects
const keyMap = {
  left:   { left: true },
  right:  { right: true },
  jump:   { jump: true },
  attack: { attack: true },
  ranged: { ranged: true },
};

// Receive game state and ask OpenClaw what to do
socket.on('gameState', async (state) => {
  try {
    const response = await fetch('https://api.openclaw.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENCLAW_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'openclaw-default',
        messages: [
          {
            role: 'system',
            content: 'You control a fighter. Reply with one action: left, right, jump, attack, or ranged.',
          },
          {
            role: 'user',
            content: JSON.stringify(state),
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error(`OpenClaw API error: ${response.status} ${response.statusText}`);
      return;
    }

    const data = await response.json();
    const action = data?.choices?.[0]?.message?.content?.trim().toLowerCase();

    if (!action) {
      console.error('OpenClaw returned an empty or unexpected response:', data);
      return;
    }

    if (keyMap[action]) {
      socket.emit('keys', keyMap[action]);
    } else {
      console.warn(`Unrecognized action from OpenClaw: "${action}". Expected one of: ${Object.keys(keyMap).join(', ')}`);
    }
  } catch (err) {
    console.error('Failed to get action from OpenClaw:', err.message);
  }
});
```

Run the bot:

```bash
OPENCLAW_API_KEY=sk-oc-your-key-here node openclaw-bot.js
```

### Environment Variables

Add to your `.env` file:

```env
OPENCLAW_API_KEY=sk-oc-your-key-here   # Required for AI bots
```

### Further Reading

- [OpenClaw API Documentation](https://docs.openclaw.ai)
- [OpenClaw Skills & Plugins Guide](https://docs.openclaw.ai/tools/plugin)
- [OpenClaw API Authentication](https://clawtrust.ai/blog/openclaw-api-guide)

---

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

Made with ❤️ by Bohemia
