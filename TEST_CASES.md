# Fight Game - Test Cases & Improvement Analysis

## Test Scenarios

### 1. Connection & Room Management

#### Test 1.1: Room Creation
**Steps:**
1. Open game on desktop
2. Enter name "Player1"
3. Select Ninja character
4. Click "+ New" to create room
5. Verify 3-digit room code generated

**Expected:** Room code is 3 digits (100-999)
**Check:** Room appears in "Available Rooms" list

#### Test 1.2: Room Joining
**Steps:**
1. Open game on mobile (different device/network)
2. Enter name "Player2"
3. Select Robot character
4. Click on room from list OR enter room code manually
5. Click "Fight!"

**Expected:** Both players see each other in game
**Check:** No connection errors, IPs allowed

#### Test 1.3: Room Persistence
**Steps:**
1. Create room, join with 2 players
2. Refresh browser on one player
3. Rejoin same room

**Expected:** Player can rejoin, name/character remembered
**Check:** localStorage saves preferences

---

### 2. Gameplay Mechanics

#### Test 2.1: Movement
**Steps:**
1. Start game with 2 players
2. Desktop: Press A/D or Arrow keys
3. Mobile: Touch ← → buttons

**Expected:** Character moves smoothly
**Check:** 
- No delay between input and movement
- Character faces correct direction
- Shadow scales with jump height

#### Test 2.2: Jump
**Steps:**
1. Press W/Space or ↑ button
2. Try jumping multiple times rapidly

**Expected:** Character jumps, can't double-jump
**Check:** 
- Jump only works when on ground
- Gravity feels natural

#### Test 2.3: Attack (Melee)
**Steps:**
1. Press J or ⚔️ button
2. Attack near opponent
3. Attack when opponent is far

**Expected:** 
- Weapon appears during attack
- Damage dealt when in range
- 500ms cooldown between attacks

**Check:**
- Visual swipe effect shows
- Health bar decreases
- Hit stun applied

#### Test 2.4: Ranged Attack
**Steps:**
1. Press R or 🔥 button
2. Shoot in both directions
3. Hit opponent with projectile

**Expected:**
- Projectile fires in facing direction
- 2 second cooldown
- 15 damage on hit

**Check:**
- No crashes (previous bug fixed)
- Projectile color matches character
- Trail effect visible

#### Test 2.5: Death & Respawn
**Steps:**
1. Reduce opponent health to 0
2. Check winner announcement
3. Click "Fight Again"

**Expected:**
- Winner shown with crown
- Scores updated
- Game restarts with full health

---

### 3. Timer & Game End

#### Test 3.1: 10-Minute Timer
**Steps:**
1. Start game
2. Observe timer countdown
3. Wait (or simulate time passing)

**Expected:**
- Timer counts down from 10:00
- Format is MM:SS
- Turns red when < 1 minute

#### Test 3.2: Timeout End
**Steps:**
1. Let timer reach 0:00
2. Or modify code to speed up

**Expected:**
- Game ends automatically
- Player with highest score wins
- Room closes after 30 seconds

---

### 4. Mobile Experience

#### Test 4.1: Touch Responsiveness
**Steps:**
1. Play on iPhone/Android
2. Tap movement buttons rapidly
3. Try simultaneous actions (move + attack)

**Issues to Check:**
- [ ] Button delay > 100ms?
- [ ] Buttons too small to hit?
- [ ] Accidental browser zoom/scroll?
- [ ] Multi-touch not working?

#### Test 4.2: Performance
**Steps:**
1. Play 4-player match on mobile
2. Use ranged attacks frequently
3. Play for 5+ minutes

**Issues to Check:**
- [ ] Frame rate drops below 30fps?
- [ ] Game gets progressively slower?
- [ ] Battery drains quickly?
- [ ] Phone gets hot?

#### Test 4.3: UI Layout
**Steps:**
1. View on different screen sizes
2. Check player badges
3. Check touch controls

**Issues to Check:**
- [ ] Health bars too large?
- [ ] Player names cut off?
- [ ] Touch buttons overlap game area?
- [ ] Canvas extends off-screen?

---

### 5. Stress Tests

#### Test 5.1: 4-Player Match
**Steps:**
1. Join with 4 players simultaneously
2. All attack each other
3. Use ranged attacks

**Check:**
- No lag spikes
- All projectiles render
- Game state syncs correctly

#### Test 5.2: Rapid Actions
**Steps:**
1. Mash all buttons rapidly
2. Switch directions constantly
3. Jump + attack simultaneously

**Check:**
- No desync
- No crashes
- Smooth gameplay

#### Test 5.3: Network Issues
**Steps:**
1. Join game
2. Turn off WiFi briefly
3. Reconnect

**Check:**
- Graceful handling
- Can rejoin room
- No ghost players

---

## Current Issues Identified

### Critical (Fix ASAP)
1. **Mobile Performance**
   - Canvas rendering too heavy
   - 60fps game loop draining battery
   - Too many socket emits

2. **Touch Responsiveness**
   - 300ms touch delay on iOS
   - Buttons may need `touch-action: manipulation`

### Medium Priority
3. **Visual Clutter**
   - Player badges take too much space on mobile
   - Health bars could be smaller
   - "YOU" indicator overlaps with name

4. **Game Balance**
   - Ranged attack may be too powerful
   - No blocking/defense mechanism
   - Knockback too strong/weak?

### Low Priority
5. **UX Improvements**
   - No sound effects
   - No vibration on hit
   - No tutorial for first-time players

---

## Recommended Improvements

### Server-Side Optimization

```javascript
// 1. Reduce update frequency
const BROADCAST_INTERVAL = 1000 / 20; // 20fps instead of 60fps

// 2. Only send changed data (delta updates)
// Instead of full game state, send only what changed

// 3. Compress game state
// Remove unnecessary fields before sending

// 4. Rate limit socket events
// Prevent spam attacks

// 5. Add server-side validation
// Don't trust client inputs
```

### Client-Side Optimization

```javascript
// 1. Use requestAnimationFrame properly
// Don't draw faster than screen refresh rate

// 2. Object pooling for projectiles
// Reuse objects instead of creating new ones

// 3. Throttle input handling
// Limit key sends to 20fps

// 4. Use CSS transforms instead of canvas for UI
// Health bars, names should be HTML elements

// 5. Lazy load assets
// Only render what's visible on screen
```

### Mobile-Specific

```css
/* 1. Better touch handling */
.touch-btn {
  touch-action: manipulation; /* Remove 300ms delay */
  -webkit-touch-callout: none;
  user-select: none;
}

/* 2. Responsive canvas */
@media (max-width: 768px) {
  .game-canvas {
    transform: scale(0.7);
    transform-origin: top center;
  }
}
```

### New Features to Consider

1. **Spectator Mode** - Watch games after dying
2. **Power-ups** - Health packs, speed boost, shield
3. **Different Maps** - Platforms, obstacles
4. **Team Mode** - 2v2 battles
5. **Leaderboard** - Track wins/losses
6. **Chat** - Quick messages ("Good game!", "Run!")
7. **Spectator Mode** - Watch after dying
8. **Replay System** - Save and watch matches

---

## Performance Benchmarks

### Target Metrics
- **Frame Rate:** 30fps minimum on mid-range mobile
- **Input Latency:** < 50ms from touch to action
- **Network:** < 100ms ping, < 1% packet loss
- **Battery:** < 5% drain per 10-minute game
- **Memory:** < 100MB RAM usage

### Current Estimates
- Frame Rate: ~20-25fps on older mobiles ❌
- Input Latency: ~100-300ms ❌
- Battery: ~10-15% drain ❌
- Memory: ~150MB ❌

---

## Test Results Template

| Test | Status | Notes |
|------|--------|-------|
| Room Creation | ⬜ Pass / ⬜ Fail | |
| Room Joining | ⬜ Pass / ⬜ Fail | |
| Movement | ⬜ Pass / ⬜ Fail | |
| Attack | ⬜ Pass / ⬜ Fail | |
| Ranged | ⬜ Pass / ⬜ Fail | |
| Timer | ⬜ Pass / ⬜ Fail | |
| Mobile UI | ⬜ Pass / ⬜ Fail | |
| Performance | ⬜ Pass / ⬜ Fail | |

---

## Quick Wins (Implement First)

1. ✅ **Fix touch delay** - Add `touch-action: manipulation`
2. ✅ **Reduce socket frequency** - 20fps instead of 60fps
3. ✅ **Smaller mobile UI** - Compact player badges
4. ✅ **Canvas scaling** - Scale down on mobile screens
5. ✅ **Remove console.logs** - Reduce overhead

## Next Steps

1. Run all test scenarios
2. Document actual results
3. Prioritize fixes based on impact
4. Implement quick wins
5. Plan larger refactoring
6. Retest after changes
