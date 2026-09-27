const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/vendor/three.module.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'node_modules', 'three', 'build', 'three.module.js'));
});
app.use('/vendor/three/examples/jsm', express.static(path.join(__dirname, 'node_modules', 'three', 'examples', 'jsm')));

const TICK_RATE = 30;
const DT = 1 / TICK_RATE;
const LAPS_TO_WIN = 3;

const CAR = {
    maxSpeed: 34,
    itemBoostMult: 1.7,
    padBoostDuration: 1.3,
    accel: 26,
    brake: 36,
    friction: 15,
    offTrackFriction: 42,
    turnSpeed: 2.3,
    bounceRadius: 2.4,
    wallBounceMult: 0.32,
    wallMargin: 1.6, // keeps the kart's own body from visually poking into the wall mesh
    obstacleRadius: 2.3,
    obstacleStunMs: 500,
    growScale: 1.35,
    shrinkScale: 0.62
};

const GUN = { speed: 60, hitRadius: 1.7, maxLifeMs: 900, stunMs: 450, cooldownMs: 300, overloadCooldownMs: 150, maxAmmo: 15, regenMs: 550 };

const ITEM_PICKUP_RADIUS = 3.2;
const ITEM_BOX_RESPAWN_MS = 4000;
const STUN_MS = 1500;
const FALL_STUN_MS = 700;
const STUN_IMMUNITY_MS = 700; // brief immunity after a stun ends, so point-blank fire can't lock a kart forever
const SPAWN_PROTECTION_MS = 1500; // battle mode: can't be killed right after respawning
const RESPAWN_DELAY_MS = 5000;
const KILL_FEED_MAX = 6;
const MAX_ROOM_SIZE = 14;
const AUTO_NEXT_ROUND_MS = 10000;

const JUMP_VY = 13, GRAVITY = 30, RAMP_RADIUS = 4.2, RAMP_MIN_SPEED = 8, RAMP_COOLDOWN_MS = 900;
const TOWER_LAUNCH_SPEED = 14;
const PULSE_RADIUS = 16, PULSE_STRENGTH = 22;

const MEGA_BOOST_INTERVAL_MS = 25000;
const MEGA_BOOST_RADIUS = 3.2;
const MEGA_BOOST_MULT = 2.4;
const MEGA_BOOST_DURATION_S = 2.5;

const TEAM_IDS = ['red', 'blue'];
const TEAM_COLORS = { red: '#ef4444', blue: '#3b82f6' };

const COLORS = [
    '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#eab308',
    '#14b8a6', '#84cc16', '#6366f1', '#f43f5e', '#0ea5e9', '#d946ef'
];
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// ===== 15 items: a small "kind"/"effect" engine keeps each one's code tiny =====
// kind: self | projectile | hazard | aoe
// effect (for non-instant self buffs / hit debuffs): boost | shield | grow | shrink | reverse | slip | emp | pulse | cloak
// lethal (projectile/hazard only): true = eliminates in Battle Arena / stuns in Racing, false = just applies its effect
const ITEM_DEFS = {
    boost: { id: 'boost', name: 'Nitro Boost', icon: 'boost', desc: 'Turant speed burst kuch second ke liye.', kind: 'self', effect: 'boost', durationMs: 1600 },
    shield: { id: 'shield', name: 'Shield', icon: 'shield', desc: 'Agla hit bilkul asar nahi karega.', kind: 'self', effect: 'shield', durationMs: 7000 },
    bomb: { id: 'bomb', name: 'Bomb Shell', icon: 'bomb', desc: 'Seedha aage fire hota hai, lagne par knock-out.', kind: 'projectile', lethal: true, speed: 48, hitRadius: 2.4, stunMs: 1500, maxLifeMs: 3000 },
    oil: { id: 'oil', name: 'Oil Slick', icon: 'oil', desc: 'Peeche giraya jaata hai, koi ispe se guzre to spin-out.', kind: 'hazard', lethal: true, radius: 2.4, lifeMs: 9000, stunMs: 1200 },
    freezeRay: { id: 'freezeRay', name: 'Freeze Ray', icon: 'freeze', desc: 'Tez, chhoti range - lagne par turant knock-out.', kind: 'projectile', lethal: true, speed: 72, hitRadius: 2.0, stunMs: 1800, maxLifeMs: 550 },
    homingRocket: { id: 'homingRocket', name: 'Homing Rocket', icon: 'homing', desc: 'Sabse paas wale opponent ko khud track karta hai.', kind: 'projectile', lethal: true, speed: 36, hitRadius: 2.6, stunMs: 1600, maxLifeMs: 3500, homing: true },
    megaRam: { id: 'megaRam', name: 'Mega Ram', icon: 'ram', desc: 'Kuch der ke liye bada + takkar zyada zoardaar.', kind: 'self', effect: 'grow', durationMs: 5000 },
    shrinkRay: { id: 'shrinkRay', name: 'Shrink Ray', icon: 'shrink', desc: 'Opponent ko chhota + slow kar deta hai (knock-out nahi).', kind: 'projectile', lethal: false, speed: 50, hitRadius: 2.2, effect: 'shrink', durationMs: 4000, maxLifeMs: 2500 },
    reverseRay: { id: 'reverseRay', name: 'Reverse Ray', icon: 'reverse', desc: 'Opponent ke steering controls ulte ho jaate hain.', kind: 'projectile', lethal: false, speed: 50, hitRadius: 2.2, effect: 'reverse', durationMs: 3000, maxLifeMs: 2500 },
    iceTrail: { id: 'iceTrail', name: 'Ice Trail', icon: 'ice', desc: 'Peeche fisalan chhod ta hai - steering kamzor ho jaati hai.', kind: 'hazard', lethal: false, radius: 2.6, lifeMs: 8000, effect: 'slip', durationMs: 3000 },
    empBlast: { id: 'empBlast', name: 'EMP Blast', icon: 'emp', desc: 'Aas-paas ke sabke gun/item kuch der band ho jaate hain.', kind: 'aoe', effect: 'emp', durationMs: 3000, radius: 13 },
    gravityPulse: { id: 'gravityPulse', name: 'Gravity Pulse', icon: 'gravity', desc: 'Paas ke opponents ko apni taraf khinchta hai.', kind: 'self', effect: 'pulse', durationMs: 2500 },
    teleportDash: { id: 'teleportDash', name: 'Teleport Dash', icon: 'teleport', desc: 'Turant aage ki taraf chhalaang.', kind: 'self', effect: 'teleport', distance: 14 },
    ammoOverload: { id: 'ammoOverload', name: 'Ammo Overload', icon: 'ammo', desc: 'Gun ammo full + kuch der double-fire speed.', kind: 'self', effect: 'ammo', durationMs: 4000 },
    phantomCloak: { id: 'phantomCloak', name: 'Phantom Cloak', icon: 'cloak', desc: 'Kuch der ke liye dusron ko dhundhlaa dikhoge.', kind: 'self', effect: 'cloak', durationMs: 5000 },
    enemyRadar: { id: 'enemyRadar', name: 'Enemy Radar', icon: 'radar', desc: 'Kuch der ke liye sabki (stealth walon ki bhi) location minimap pe dikhti hai.', kind: 'self', effect: 'radar', durationMs: 7000 }
};
const ITEM_IDS = Object.keys(ITEM_DEFS);

// ===== Maps =====
// "bounds" is a solid outer wall (ellipse) plus an inner hole (ellipse too - a lake on
// race tracks, a death-pit in the arena). Race maps additionally have lap checkpoints.
const RACE_BOUNDS = { cx: 0, cz: 0, rxOuter: 70, rzOuter: 50, rxInner: 34, rzInner: 24 };
const RACE_MID = { rx: (RACE_BOUNDS.rxOuter + RACE_BOUNDS.rxInner) / 2, rz: (RACE_BOUNDS.rzOuter + RACE_BOUNDS.rzInner) / 2 };
const ARENA_BOUNDS = { cx: 0, cz: 0, rxOuter: 48, rzOuter: 48, rxInner: 7, rzInner: 7 };

function ellipseRing(bounds, rx, rz, count, phase) {
    return Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + phase;
        return { x: bounds.cx + rx * Math.cos(a), z: bounds.cz + rz * Math.sin(a) };
    });
}

const RACE_OBSTACLES = [0.35, 1.15, 2.05, 3.05, 3.95, 4.95].map((angle, i) => {
    const t = i % 2 === 0 ? 0.35 : 0.65;
    const rx = RACE_BOUNDS.rxInner + (RACE_BOUNDS.rxOuter - RACE_BOUNDS.rxInner) * t;
    const rz = RACE_BOUNDS.rzInner + (RACE_BOUNDS.rzOuter - RACE_BOUNDS.rzInner) * t;
    return { id: i, x: RACE_BOUNDS.cx + rx * Math.cos(angle), z: RACE_BOUNDS.cz + rz * Math.sin(angle), radius: CAR.obstacleRadius };
});
const RACE_BOOST_PADS = [0.9, 2.6, 4.2, 5.6].map((angle, i) => ({
    id: i, x: RACE_BOUNDS.cx + RACE_MID.rx * Math.cos(angle), z: RACE_BOUNDS.cz + RACE_MID.rz * Math.sin(angle), radius: 3.4
}));
const RACE_ITEM_POSITIONS = ellipseRing(RACE_BOUNDS, RACE_MID.rx, RACE_MID.rz, 6, Math.PI / 6);
const RACE_RAMPS = [1.7, 4.4].map((angle, i) => {
    const p = { x: RACE_BOUNDS.cx + RACE_MID.rx * Math.cos(angle), z: RACE_BOUNDS.cz + RACE_MID.rz * Math.sin(angle) };
    return { id: i, x: p.x, z: p.z, heading: Math.atan2(RACE_MID.rz * Math.cos(angle), -RACE_MID.rx * Math.sin(angle)) };
});

const ARENA_OBSTACLES = [0, 1, 2, 3, 4, 5, 6, 7].map(i => {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    const r = ARENA_BOUNDS.rxOuter * (i % 2 === 0 ? 0.34 : 0.66);
    return { id: i, floor: 0, x: ARENA_BOUNDS.cx + r * Math.cos(a), z: ARENA_BOUNDS.cz + r * Math.sin(a), radius: CAR.obstacleRadius };
});
const ARENA_BOOST_PADS = [0, Math.PI].map((a, i) => ({
    id: i, floor: 0, x: ARENA_BOUNDS.cx + ARENA_BOUNDS.rxOuter * 0.45 * Math.cos(a), z: ARENA_BOUNDS.cz + ARENA_BOUNDS.rzOuter * 0.45 * Math.sin(a), radius: 3.4
}));
const ARENA_ITEM_POSITIONS = ellipseRing(ARENA_BOUNDS, ARENA_BOUNDS.rxOuter * 0.68, ARENA_BOUNDS.rzOuter * 0.68, 6, Math.PI / 6).map(p => ({ ...p, floor: 0 }));
const ARENA_SPAWN_POINTS = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    const x = ARENA_BOUNDS.cx + ARENA_BOUNDS.rxOuter * 0.86 * Math.cos(a);
    const z = ARENA_BOUNDS.cz + ARENA_BOUNDS.rzOuter * 0.86 * Math.sin(a);
    return { x, z, heading: Math.atan2(ARENA_BOUNDS.cz - z, ARENA_BOUNDS.cx - x) };
});
// a BIG fighting platform hovering directly above the lava pit - a proper second stage,
// not a small floating disc - jump up to it via two launch ramps just outside its rim.
// Falling off its edge above the pit drops you straight into the lava.
const ARENA_PLATFORM_RADIUS = 20;
const ARENA_PLATFORMS = [
    { id: 0, y: 0, cx: ARENA_BOUNDS.cx, cz: ARENA_BOUNDS.cz, radius: ARENA_BOUNDS.rxOuter },
    { id: 1, y: 9, cx: ARENA_BOUNDS.cx, cz: ARENA_BOUNDS.cz, radius: ARENA_PLATFORM_RADIUS }
];
const ARENA_RAMP_RADIUS = 26;
const ARENA_TOWER_RAMPS = [Math.PI / 2, Math.PI * 1.5].map((angle, i) => ({
    id: i, x: ARENA_BOUNDS.cx + ARENA_RAMP_RADIUS * Math.cos(angle), z: ARENA_BOUNDS.cz + ARENA_RAMP_RADIUS * Math.sin(angle),
    heading: angle + Math.PI, fromFloor: 0, toFloor: 1, power: 25
}));
// obstacles + boost pad + item boxes spread across the big platform so it's worth fighting on
const ARENA_PLATFORM_OBSTACLES = [0, 1, 2].map(i => {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    return { id: 100 + i, floor: 1, x: ARENA_BOUNDS.cx + 10 * Math.cos(a), z: ARENA_BOUNDS.cz + 10 * Math.sin(a), radius: CAR.obstacleRadius };
});
const ARENA_PLATFORM_BOOST_PADS = [{ id: 2, floor: 1, x: ARENA_BOUNDS.cx, z: ARENA_BOUNDS.cz, radius: 3.4 }];
const ARENA_PLATFORM_ITEMS = [
    { floor: 1, x: 14, z: 0 }, { floor: 1, x: -14, z: 0 }, { floor: 1, x: 0, z: 14 }, { floor: 1, x: 0, z: -14 }
];

// ===== Sky Tower: a 3-storey battle arena. Every floor is a concentric circle
// centred on the same point, connected by launch ramps that persistently move a
// kart to the floor above (fromFloor/toFloor); driving off a floor's edge (or
// missing a ramp) makes you fall back down to whatever floor is beneath you.
const TOWER_BOUNDS = { cx: 0, cz: 0, rxOuter: 44, rzOuter: 44, rxInner: 0.5, rzInner: 0.5 };
// big proper stages on every floor (not small floating discs) - floor1 is nearly
// as wide as the ground ring, floor2 is still a full arena in its own right
const TOWER_PLATFORMS = [
    { id: 0, y: 0, cx: 0, cz: 0, radius: 44 },
    { id: 1, y: 9, cx: 0, cz: 0, radius: 24 },
    { id: 2, y: 17, cx: 0, cz: 0, radius: 14 }
];
const TOWER_RAMPS = [
    { id: 0, x: 28, z: 0, heading: Math.PI, fromFloor: 0, toFloor: 1, power: 26 },
    { id: 1, x: 18, z: 0, heading: Math.PI, fromFloor: 1, toFloor: 2, power: 21 }
];
const TOWER_OBSTACLES = [
    { id: 0, floor: 0, x: 26, z: 26, radius: CAR.obstacleRadius },
    { id: 1, floor: 0, x: -26, z: 26, radius: CAR.obstacleRadius },
    { id: 2, floor: 0, x: 26, z: -26, radius: CAR.obstacleRadius },
    { id: 3, floor: 0, x: -26, z: -26, radius: CAR.obstacleRadius },
    { id: 4, floor: 0, x: 0, z: 38, radius: CAR.obstacleRadius },
    { id: 5, floor: 0, x: 0, z: -38, radius: CAR.obstacleRadius },
    { id: 6, floor: 1, x: 13, z: 13, radius: CAR.obstacleRadius },
    { id: 7, floor: 1, x: -13, z: 13, radius: CAR.obstacleRadius },
    { id: 8, floor: 1, x: 13, z: -13, radius: CAR.obstacleRadius },
    { id: 9, floor: 1, x: -13, z: -13, radius: CAR.obstacleRadius },
    { id: 10, floor: 2, x: 7, z: 0, radius: CAR.obstacleRadius },
    { id: 11, floor: 2, x: -7, z: 0, radius: CAR.obstacleRadius }
];
const TOWER_BOOST_PADS = [
    { id: 0, floor: 0, x: 0, z: 32, radius: 3.4 },
    { id: 1, floor: 0, x: 0, z: -32, radius: 3.4 },
    { id: 2, floor: 1, x: 0, z: -18, radius: 3.4 },
    { id: 3, floor: 2, x: 5, z: 5, radius: 3.4 }
];
const TOWER_ITEM_POSITIONS = [
    { floor: 0, x: 30, z: 15 }, { floor: 0, x: -30, z: 15 }, { floor: 0, x: 0, z: -32 },
    { floor: 1, x: 16, z: 0 }, { floor: 1, x: -9.9, z: 9.9 }, { floor: 1, x: -9.9, z: -9.9 },
    { floor: 2, x: 0, z: 6 }, { floor: 2, x: 0, z: -6 }
];
const TOWER_SPAWN_POINTS = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    const x = TOWER_BOUNDS.cx + 36 * Math.cos(a), z = TOWER_BOUNDS.cz + 36 * Math.sin(a);
    return { x, z, heading: Math.atan2(TOWER_BOUNDS.cz - z, TOWER_BOUNDS.cx - x), floor: 0 };
});

const MAPS = {
    classic: {
        id: 'classic', name: 'Classic Ring', mode: 'race',
        bounds: RACE_BOUNDS, mid: RACE_MID, checkpoints: 8,
        theme: { ground: 0x3f9142, wallColors: [0xef4444, 0xffffff], sky: 0x8ed3f5, mountain: 0x64748b, decor: 'trees', hazard: 0x1d78d8 },
        obstacles: RACE_OBSTACLES, boostPads: RACE_BOOST_PADS, itemBoxPositions: RACE_ITEM_POSITIONS, ramps: RACE_RAMPS
    },
    desert: {
        id: 'desert', name: 'Desert Dunes', mode: 'race',
        bounds: RACE_BOUNDS, mid: RACE_MID, checkpoints: 8,
        theme: { ground: 0xdcb35c, wallColors: [0xf97316, 0xffffff], sky: 0xffe0b3, mountain: 0xb45309, decor: 'cacti', hazard: 0x2563eb },
        obstacles: RACE_OBSTACLES, boostPads: RACE_BOOST_PADS, itemBoxPositions: RACE_ITEM_POSITIONS, ramps: RACE_RAMPS
    },
    colosseum: {
        id: 'colosseum', name: 'Colosseum', mode: 'battle',
        bounds: ARENA_BOUNDS, mid: null, checkpoints: 0,
        theme: { ground: 0x92400e, wallColors: [0x7c3aed, 0xfacc15], sky: 0x1e1b4b, mountain: 0x4c1d95, decor: 'stands', hazard: 0x1a0505 },
        obstacles: ARENA_OBSTACLES.concat(ARENA_PLATFORM_OBSTACLES), boostPads: ARENA_BOOST_PADS.concat(ARENA_PLATFORM_BOOST_PADS),
        itemBoxPositions: ARENA_ITEM_POSITIONS.concat(ARENA_PLATFORM_ITEMS),
        spawnPoints: ARENA_SPAWN_POINTS, ramps: [], platforms: ARENA_PLATFORMS, towerRamps: ARENA_TOWER_RAMPS
    },
    skytower: {
        id: 'skytower', name: 'Sky Tower', mode: 'battle',
        bounds: TOWER_BOUNDS, mid: null, checkpoints: 0,
        theme: { ground: 0x312e81, wallColors: [0x22d3ee, 0xfacc15], sky: 0x0c0a1e, mountain: 0x3730a3, decor: 'stands', hazard: 0x1a0505 },
        obstacles: TOWER_OBSTACLES, boostPads: TOWER_BOOST_PADS, itemBoxPositions: TOWER_ITEM_POSITIONS,
        spawnPoints: TOWER_SPAWN_POINTS, ramps: [], platforms: TOWER_PLATFORMS, towerRamps: TOWER_RAMPS
    }
};

// ===== Generic ellipse math (shared by every map) =====
function outerNorm(bounds, x, z) {
    const dx = (x - bounds.cx) / bounds.rxOuter, dz = (z - bounds.cz) / bounds.rzOuter;
    return Math.sqrt(dx * dx + dz * dz);
}
function outerNormWall(bounds, x, z) {
    const rx = bounds.rxOuter - CAR.wallMargin, rz = bounds.rzOuter - CAR.wallMargin;
    const dx = (x - bounds.cx) / rx, dz = (z - bounds.cz) / rz;
    return { norm: Math.sqrt(dx * dx + dz * dz), rx, rz };
}
function innerNorm(bounds, x, z) {
    const dx = (x - bounds.cx) / bounds.rxInner, dz = (z - bounds.cz) / bounds.rzInner;
    return Math.sqrt(dx * dx + dz * dz);
}
function isOnTrack(bounds, x, z) { return outerNorm(bounds, x, z) <= 1.001 && innerNorm(bounds, x, z) >= 1; }

// multi-floor "platform" maps: find the highest platform at/under maxY whose
// footprint contains (x,z) - used only while actually falling, never while grounded,
// so a walking player on a low floor is never yanked onto an overlapping floor above.
function findLandingPlatform(map, x, z, maxY) {
    let best = null;
    for (const plat of map.platforms) {
        if (plat.y > maxY + 0.01) continue;
        if (Math.hypot(x - plat.cx, z - plat.cz) < plat.radius) {
            if (!best || plat.y > best.y) best = plat;
        }
    }
    return best || map.platforms[0];
}

function checkpointAngle(map, index) { return (index / map.checkpoints) * Math.PI * 2 - Math.PI / 2; }
function checkpointWaypoint(map, index) {
    const a = checkpointAngle(map, index);
    return {
        x: map.bounds.cx + map.mid.rx * Math.cos(a),
        z: map.bounds.cz + map.mid.rz * Math.sin(a),
        heading: Math.atan2(map.mid.rz * Math.cos(a), -map.mid.rx * Math.sin(a))
    };
}
function angleOnTrack(map, x, z) { return Math.atan2((z - map.bounds.cz) / map.mid.rz, (x - map.bounds.cx) / map.mid.rx); }
function checkpointIndexForAngle(map, a) {
    let shifted = a + Math.PI / 2;
    if (shifted < 0) shifted += Math.PI * 2;
    return Math.floor((shifted / (Math.PI * 2)) * map.checkpoints) % map.checkpoints;
}

function startPositions(map, n) {
    const startZ = map.bounds.cz - map.mid.rz;
    return Array.from({ length: n }, (_, i) => {
        const row = Math.floor(i / 2), col = i % 2;
        return { x: map.bounds.cx - 4 - row * 4, z: startZ + (col === 0 ? -1.8 : 1.8), angle: 0 };
    });
}

function makeItemBoxes(mapId) {
    return MAPS[mapId].itemBoxPositions.map((pos, i) => ({ id: i, x: pos.x, z: pos.z, floor: pos.floor, available: true, respawnAt: 0 }));
}

function generateRoomCode() {
    let code;
    do {
        code = Array.from({ length: 4 }, () => ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]).join('');
    } while (rooms.has(code));
    return code;
}

function createRoomState(mapId, winCondition, isPublic, teams) {
    return {
        mapId, mode: MAPS[mapId].mode, winCondition: winCondition === 'score' ? 'score' : 'time',
        isPublic: !!isPublic,
        teams: !!teams,
        teamScores: { red: 0, blue: 0 },
        players: {},
        raceState: 'lobby', // lobby | countdown | racing | finished
        countdownValue: 0,
        raceStartTime: 0,
        finishOrder: [],
        scores: {},
        killFeed: [],
        winnerId: null,
        winnerTeam: null,
        scoreTarget: 10,
        battleDurationMs: 3 * 60 * 1000,
        battleEndsAt: 0,
        nextRoundAt: 0,
        autoNextTimer: null,
        projectiles: [],
        hazards: [],
        itemBoxes: makeItemBoxes(mapId),
        megaBoost: { active: false, x: 0, z: 0, nextSpawnAt: Date.now() + MEGA_BOOST_INTERVAL_MS },
        countdownInterval: null,
        nextEntityId: 1
    };
}

const rooms = new Map(); // code -> room state

function balanceTeam(room) {
    const counts = { red: 0, blue: 0 };
    Object.values(room.players).forEach(p => { if (p.team) counts[p.team]++; });
    return counts.red <= counts.blue ? 'red' : 'blue';
}

function broadcastLobby(code, room) {
    io.to(code).emit('lobby', {
        code, mapId: room.mapId, mode: room.mode, winCondition: room.winCondition, teams: room.teams,
        players: Object.fromEntries(Object.entries(room.players).map(([id, p]) => [id, { name: p.name, color: p.color, team: p.team || null }]))
    });
}

function freshPlayerState(base) {
    return Object.assign(base, {
        heldItem: null, boostTimer: 0,
        stunUntil: 0, stunImmuneUntil: 0, fellAt: 0,
        shieldUntil: 0, growUntil: 0, shrinkUntil: 0, reverseUntil: 0, slipUntil: 0, empUntil: 0,
        pulseUntil: 0, stealthUntil: 0, ammoOverloadUntil: 0, radarUntil: 0, megaBoostUntil: 0,
        vy: 0, jumping: false, lastRampAt: 0, currentFloor: 0, pendingFloor: null,
        ammo: GUN.maxAmmo, nextAmmoRegenAt: 0, lastGunFireAt: 0,
        input: { up: false, down: false, left: false, right: false, fire: false }
    });
}

function resetRace(room) {
    if (room.countdownInterval) { clearInterval(room.countdownInterval); room.countdownInterval = null; }
    if (room.autoNextTimer) { clearTimeout(room.autoNextTimer); room.autoNextTimer = null; }
    const map = MAPS[room.mapId];
    const ids = Object.keys(room.players);

    if (room.mode === 'race') {
        const positions = startPositions(map, ids.length);
        ids.forEach((id, i) => {
            const p = room.players[id];
            freshPlayerState(p);
            p.x = positions[i].x; p.z = positions[i].z; p.y = 0;
            p.angle = positions[i].angle; p.speed = 0;
            p.lap = 0; p.nextCheckpoint = 1; p.finished = false; p.finishTime = null;
        });
        room.finishOrder = [];
    } else {
        ids.forEach((id, i) => {
            const sp = map.spawnPoints[i % map.spawnPoints.length];
            const p = room.players[id];
            freshPlayerState(p);
            p.x = sp.x; p.z = sp.z; p.y = 0; p.angle = sp.heading; p.speed = 0;
            p.alive = true; p.respawnAt = 0; p.spawnProtectedUntil = Date.now() + SPAWN_PROTECTION_MS;
            room.scores[id] = 0;
        });
        room.killFeed = [];
        room.winnerId = null;
        room.winnerTeam = null;
        room.teamScores = { red: 0, blue: 0 };
    }
    room.projectiles = [];
    room.hazards = [];
    room.itemBoxes = makeItemBoxes(room.mapId);
    room.megaBoost = { active: false, x: 0, z: 0, nextSpawnAt: Date.now() + MEGA_BOOST_INTERVAL_MS };
    room.raceState = 'lobby';
}

function placeNewPlayer(room, map, id) {
    const p = room.players[id];
    if (room.mode === 'race') {
        const wp = checkpointWaypoint(map, 0);
        p.x = wp.x; p.z = wp.z; p.angle = wp.heading; p.speed = 0;
        p.lap = 0; p.nextCheckpoint = 1; p.finished = false; p.finishTime = null;
    } else {
        const sp = map.spawnPoints[Math.floor(Math.random() * map.spawnPoints.length)];
        p.x = sp.x; p.z = sp.z; p.angle = sp.heading; p.speed = 0;
        p.alive = true; p.spawnProtectedUntil = Date.now() + SPAWN_PROTECTION_MS;
        p.currentFloor = sp.floor || 0; p.pendingFloor = null; p.y = 0; p.vy = 0;
        room.scores[id] = 0;
    }
}

function startCountdown(room) {
    resetRace(room);
    room.raceState = 'countdown';
    room.countdownValue = 3;
    room.countdownInterval = setInterval(() => {
        room.countdownValue -= 1;
        if (room.countdownValue <= 0) {
            clearInterval(room.countdownInterval);
            room.countdownInterval = null;
            room.raceState = 'racing';
            room.raceStartTime = Date.now();
            room.battleEndsAt = Date.now() + room.battleDurationMs;
        }
    }, 1000);
}

function scheduleAutoNextRound(code, room) {
    if (room.autoNextTimer) return;
    room.nextRoundAt = Date.now() + AUTO_NEXT_ROUND_MS;
    room.autoNextTimer = setTimeout(() => {
        room.autoNextTimer = null;
        if (rooms.get(code) !== room) return;
        if (Object.keys(room.players).length === 0) return;
        startCountdown(room);
    }, AUTO_NEXT_ROUND_MS);
}

function canBeHit(room, target, now) {
    if (room.mode === 'battle') return target.alive && now >= target.spawnProtectedUntil;
    return now >= target.stunUntil && now >= target.stunImmuneUntil;
}

function applyItemEffect(room, attackerId, targetId, def, now) {
    const target = room.players[targetId];
    const attacker = room.players[attackerId];
    if (room.teams && attacker && attacker.team && attacker.team === target.team) return; // no friendly fire
    if (now < target.shieldUntil) { target.shieldUntil = 0; return; } // shield absorbs any single incoming effect

    if (def.lethal) {
        if (room.mode === 'battle') {
            target.alive = false;
            target.respawnAt = now + RESPAWN_DELAY_MS;
            target.speed = 0;
            room.scores[attackerId] = (room.scores[attackerId] || 0) + 1;
            if (room.teams && attacker && attacker.team) room.teamScores[attacker.team] = (room.teamScores[attacker.team] || 0) + 1;
            room.killFeed.push({ id: room.nextEntityId++, attacker: attacker ? attacker.name : '?', victim: target.name, weapon: def.icon, time: now });
            if (room.killFeed.length > KILL_FEED_MAX) room.killFeed.shift();
        } else {
            target.stunUntil = now + (def.stunMs || STUN_MS);
            target.stunImmuneUntil = target.stunUntil + STUN_IMMUNITY_MS;
            target.speed *= 0.25;
        }
        return;
    }

    target.speed *= 0.6;
    const dur = def.durationMs || 2500;
    if (def.effect === 'shrink') target.shrinkUntil = now + dur;
    else if (def.effect === 'reverse') target.reverseUntil = now + dur;
    else if (def.effect === 'slip') target.slipUntil = now + dur;
}

function applySelfEffect(room, id, def, now) {
    const p = room.players[id];
    switch (def.effect) {
        case 'boost': p.boostTimer = def.durationMs / 1000; break;
        case 'shield': p.shieldUntil = now + def.durationMs; break;
        case 'grow': p.growUntil = now + def.durationMs; break;
        case 'teleport': p.x += Math.cos(p.angle) * def.distance; p.z += Math.sin(p.angle) * def.distance; break;
        case 'ammo': p.ammo = GUN.maxAmmo; p.ammoOverloadUntil = now + def.durationMs; break;
        case 'pulse': p.pulseUntil = now + def.durationMs; break;
        case 'cloak': p.stealthUntil = now + def.durationMs; break;
        case 'radar': p.radarUntil = now + def.durationMs; break;
        default: break;
    }
}

function applyAoeEffect(room, id, def, now) {
    const p = room.players[id];
    Object.keys(room.players).forEach(oid => {
        if (oid === id) return;
        const o = room.players[oid];
        if ((o.currentFloor || 0) !== (p.currentFloor || 0)) return;
        if (Math.hypot(o.x - p.x, o.z - p.z) <= def.radius) {
            if (now < o.shieldUntil) { o.shieldUntil = 0; return; }
            o.empUntil = now + def.durationMs;
        }
    });
}

function respawnBattlePlayer(room, id, map) {
    const p = room.players[id];
    const sp = map.spawnPoints[Math.floor(Math.random() * map.spawnPoints.length)];
    const now = Date.now();
    p.x = sp.x; p.z = sp.z; p.angle = sp.heading; p.speed = 0; p.y = 0; p.vy = 0;
    p.alive = true; p.spawnProtectedUntil = now + SPAWN_PROTECTION_MS;
    p.heldItem = null; p.stunUntil = 0; p.stunImmuneUntil = 0;
    p.currentFloor = sp.floor || 0; p.pendingFloor = null;
}

function tickRoom(code, room) {
    const now = Date.now();
    const ids = Object.keys(room.players);
    if (ids.length === 0) return;
    const map = MAPS[room.mapId];

    room.itemBoxes.forEach(b => { if (!b.available && now >= b.respawnAt) b.available = true; });

    if (room.raceState === 'racing') {
        if (!room.megaBoost.active && now >= room.megaBoost.nextSpawnAt) {
            const spot = map.megaBoostSpots ? map.megaBoostSpots[Math.floor(Math.random() * map.megaBoostSpots.length)] : map.boostPads[0];
            room.megaBoost.active = true; room.megaBoost.x = spot.x; room.megaBoost.z = spot.z; room.megaBoost.floor = spot.floor;
        }

        ids.forEach(id => {
            const p = room.players[id];
            if (room.mode === 'race') {
                if (p.finished) return;
            } else {
                if (!p.alive) { if (now >= p.respawnAt) respawnBattlePlayer(room, id, map); return; }
            }

            const inp = p.input;
            const stunned = now < p.stunUntil;
            const reversed = now < p.reverseUntil;
            const slipped = now < p.slipUntil;
            const grown = now < p.growUntil;
            const shrunk = now < p.shrinkUntil;
            if (p.boostTimer > 0) p.boostTimer -= DT;

            if (p.ammo < GUN.maxAmmo && now >= p.nextAmmoRegenAt) { p.ammo++; p.nextAmmoRegenAt = now + GUN.regenMs; }

            const onTrack = isOnTrack(map.bounds, p.x, p.z);
            let sizeMult = grown ? CAR.growScale : (shrunk ? CAR.shrinkScale : 1);
            const speedSizeFactor = shrunk ? 0.7 : 1;
            const megaBoosted = now < p.megaBoostUntil;
            const boostMult = megaBoosted ? MEGA_BOOST_MULT : (p.boostTimer > 0 ? CAR.itemBoostMult : 1);
            const maxSpeed = CAR.maxSpeed * boostMult * (onTrack ? 1 : 0.6) * speedSizeFactor;

            // mid-air on a scripted tower ramp: hold a fixed launch speed so every
            // player's arc covers the same distance, regardless of how fast they hit the ramp
            const inTowerFlight = !!(map.platforms && p.jumping && p.pendingFloor != null);
            if (inTowerFlight) {
                p.speed = TOWER_LAUNCH_SPEED;
            } else if (stunned) {
                p.speed *= 0.9;
            } else if (inp.up) {
                p.speed += CAR.accel * DT;
            } else if (inp.down) {
                p.speed -= CAR.brake * DT;
            } else {
                const f = onTrack ? CAR.friction : CAR.offTrackFriction;
                if (p.speed > 0) p.speed = Math.max(0, p.speed - f * DT);
                else if (p.speed < 0) p.speed = Math.min(0, p.speed + f * DT);
            }
            p.speed = Math.max(-CAR.maxSpeed * 0.5, Math.min(maxSpeed, p.speed));

            if (!stunned) {
                let turnFactor = Math.min(1, Math.abs(p.speed) / 9);
                if (slipped) turnFactor *= 0.4;
                const turnDir = p.speed < 0 ? -1 : 1;
                const left = reversed ? inp.right : inp.left;
                const right = reversed ? inp.left : inp.right;
                if (left) p.angle -= CAR.turnSpeed * DT * turnFactor * turnDir;
                if (right) p.angle += CAR.turnSpeed * DT * turnFactor * turnDir;
            }

            p.x += Math.cos(p.angle) * p.speed * DT;
            p.z += Math.sin(p.angle) * p.speed * DT;

            // jump ramps (flat maps) / floor-to-floor tower ramps (multi-platform maps)
            if (map.platforms) {
                if (!p.jumping && p.speed > RAMP_MIN_SPEED && now - p.lastRampAt > RAMP_COOLDOWN_MS) {
                    for (const ramp of map.towerRamps || []) {
                        if (ramp.fromFloor === p.currentFloor && Math.hypot(p.x - ramp.x, p.z - ramp.z) < RAMP_RADIUS) {
                            p.vy = ramp.power; p.jumping = true; p.lastRampAt = now; p.pendingFloor = ramp.toFloor;
                            break;
                        }
                    }
                }
                if (!p.jumping) {
                    const curPlat = map.platforms[p.currentFloor];
                    if (Math.hypot(p.x - curPlat.cx, p.z - curPlat.cz) > curPlat.radius) {
                        p.jumping = true; p.pendingFloor = null; // walked off the edge - start falling
                    }
                }
                if (p.jumping) {
                    p.vy -= GRAVITY * DT;
                    p.y += p.vy * DT;
                    if (p.vy <= 0) {
                        if (p.pendingFloor != null) {
                            const target = map.platforms[p.pendingFloor];
                            if (p.y <= target.y) {
                                if (Math.hypot(p.x - target.cx, p.z - target.cz) < target.radius) {
                                    p.y = target.y; p.vy = 0; p.jumping = false;
                                    p.currentFloor = p.pendingFloor; p.pendingFloor = null;
                                } else {
                                    p.pendingFloor = null; // missed the target floor - keep falling toward whatever is below
                                }
                            }
                        } else {
                            const landing = findLandingPlatform(map, p.x, p.z, p.y);
                            if (p.y <= landing.y) {
                                p.y = landing.y; p.vy = 0; p.jumping = false;
                                p.currentFloor = landing.id;
                            }
                        }
                    }
                }
            } else {
                if (!p.jumping && p.speed > RAMP_MIN_SPEED && now - p.lastRampAt > RAMP_COOLDOWN_MS) {
                    for (const ramp of map.ramps || []) {
                        if (Math.hypot(p.x - ramp.x, p.z - ramp.z) < RAMP_RADIUS) {
                            p.vy = JUMP_VY; p.jumping = true; p.lastRampAt = now;
                            break;
                        }
                    }
                }
                if (p.jumping) {
                    p.vy -= GRAVITY * DT;
                    p.y += p.vy * DT;
                    if (p.y <= 0) { p.y = 0; p.vy = 0; p.jumping = false; }
                }
            }

            // solid colourful outer wall: clamp position back onto the boundary (with a
            // small inward margin so the kart's own body doesn't poke through the mesh) + bounce
            const wallInfo = outerNormWall(map.bounds, p.x, p.z);
            if (wallInfo.norm > 1) {
                const nx = (p.x - map.bounds.cx) / wallInfo.rx, nz = (p.z - map.bounds.cz) / wallInfo.rz;
                const scale = 1 / wallInfo.norm;
                p.x = map.bounds.cx + nx * scale * wallInfo.rx;
                p.z = map.bounds.cz + nz * scale * wallInfo.rz;
                p.speed *= CAR.wallBounceMult;
            }

            if (room.mode === 'race' && isOnTrack(map.bounds, p.x, p.z)) {
                const cp = checkpointIndexForAngle(map, angleOnTrack(map, p.x, p.z));
                if (cp === p.nextCheckpoint) {
                    p.nextCheckpoint = (p.nextCheckpoint + 1) % map.checkpoints;
                    if (cp === 0) {
                        p.lap += 1;
                        if (p.lap >= LAPS_TO_WIN) {
                            p.finished = true;
                            p.finishTime = now - room.raceStartTime;
                            room.finishOrder.push({ id, name: p.name, time: p.finishTime });
                        }
                    }
                }
            }

            // fell into the inner hole - a lake (race) or a death-pit (battle)
            // (multi-floor maps only have a pit at ground level - upper platforms are stacked
            // centered on the same x,z, so this must never trigger for a player standing above floor 0)
            if ((!map.platforms || (p.currentFloor === 0 && !p.jumping)) && innerNorm(map.bounds, p.x, p.z) < 0.5) {
                if (room.mode === 'race') {
                    const lastCp = (p.nextCheckpoint - 1 + map.checkpoints) % map.checkpoints;
                    const wp = checkpointWaypoint(map, lastCp);
                    p.x = wp.x; p.z = wp.z; p.angle = wp.heading; p.speed = 0;
                    p.stunUntil = now + FALL_STUN_MS;
                    p.stunImmuneUntil = now + FALL_STUN_MS + STUN_IMMUNITY_MS;
                    p.fellAt = now;
                } else {
                    p.alive = false; p.respawnAt = now + RESPAWN_DELAY_MS; p.fellAt = now;
                    room.killFeed.push({ id: room.nextEntityId++, attacker: null, victim: p.name, weapon: 'pit', time: now });
                    if (room.killFeed.length > KILL_FEED_MAX) room.killFeed.shift();
                }
            }

            for (const ob of map.obstacles) {
                if (ob.floor !== undefined && ob.floor !== p.currentFloor) continue;
                const dist = Math.hypot(p.x - ob.x, p.z - ob.z);
                const minDist = ob.radius + 0.9 * sizeMult;
                if (dist < minDist && dist > 0) {
                    const nx = (p.x - ob.x) / dist, nz = (p.z - ob.z) / dist;
                    p.x = ob.x + nx * minDist; p.z = ob.z + nz * minDist;
                    p.speed *= 0.3;
                    if (!stunned && now >= p.stunImmuneUntil) {
                        p.stunUntil = now + CAR.obstacleStunMs;
                        p.stunImmuneUntil = now + CAR.obstacleStunMs + STUN_IMMUNITY_MS;
                    }
                }
            }

            for (const pad of map.boostPads) {
                if (pad.floor !== undefined && pad.floor !== p.currentFloor) continue;
                if (Math.hypot(p.x - pad.x, p.z - pad.z) < pad.radius) {
                    p.boostTimer = Math.max(p.boostTimer, CAR.padBoostDuration);
                }
            }

            if (room.megaBoost.active && (room.megaBoost.floor === undefined || room.megaBoost.floor === p.currentFloor) && Math.hypot(p.x - room.megaBoost.x, p.z - room.megaBoost.z) < MEGA_BOOST_RADIUS) {
                p.megaBoostUntil = now + MEGA_BOOST_DURATION_S * 1000;
                room.megaBoost.active = false;
                room.megaBoost.nextSpawnAt = now + MEGA_BOOST_INTERVAL_MS;
            }

            if (!p.heldItem) {
                for (const box of room.itemBoxes) {
                    if (!box.available) continue;
                    if (box.floor !== undefined && box.floor !== p.currentFloor) continue;
                    if (Math.hypot(p.x - box.x, p.z - box.z) < ITEM_PICKUP_RADIUS) {
                        p.heldItem = ITEM_IDS[Math.floor(Math.random() * ITEM_IDS.length)];
                        box.available = false;
                        box.respawnAt = now + ITEM_BOX_RESPAWN_MS;
                        box.smashedAt = now;
                        break;
                    }
                }
            }

            const gunCooldown = now < p.ammoOverloadUntil ? GUN.overloadCooldownMs : GUN.cooldownMs;
            if (inp.fire && !stunned && now >= p.empUntil && p.ammo > 0 && now - p.lastGunFireAt >= gunCooldown) {
                p.lastGunFireAt = now;
                p.ammo--;
                room.projectiles.push({
                    id: room.nextEntityId++, ownerId: id, itemId: '__gun', floor: p.currentFloor || 0,
                    x: p.x + Math.cos(p.angle) * 2, z: p.z + Math.sin(p.angle) * 2,
                    dx: Math.cos(p.angle), dz: Math.sin(p.angle), spawnedAt: now
                });
            }
        });

        const activeIds = ids.filter(id => room.mode === 'race' ? !room.players[id].finished : room.players[id].alive);

        // gravity pulse: anyone with an active pulse drags nearby active players toward them
        activeIds.forEach(ownerId => {
            const owner = room.players[ownerId];
            if (now >= owner.pulseUntil) return;
            activeIds.forEach(tid => {
                if (tid === ownerId) return;
                const t = room.players[tid];
                if ((t.currentFloor || 0) !== (owner.currentFloor || 0)) return;
                const dx = owner.x - t.x, dz = owner.z - t.z, d = Math.hypot(dx, dz);
                if (d > 0.5 && d < PULSE_RADIUS) {
                    const pull = (1 - d / PULSE_RADIUS) * PULSE_STRENGTH;
                    t.x += (dx / d) * pull * DT;
                    t.z += (dz / d) * pull * DT;
                }
            });
        });

        for (let i = 0; i < activeIds.length; i++) {
            for (let j = i + 1; j < activeIds.length; j++) {
                const a = room.players[activeIds[i]], b = room.players[activeIds[j]];
                if ((a.currentFloor || 0) !== (b.currentFloor || 0)) continue; // different floors - not actually touching
                const aSize = now < a.growUntil ? CAR.growScale : (now < a.shrinkUntil ? CAR.shrinkScale : 1);
                const bSize = now < b.growUntil ? CAR.growScale : (now < b.shrinkUntil ? CAR.shrinkScale : 1);
                const dx = b.x - a.x, dz = b.z - a.z;
                const dist = Math.hypot(dx, dz);
                const minDist = CAR.bounceRadius * (aSize + bSize);
                if (dist > 0 && dist < minDist) {
                    const overlap = (minDist - dist) / 2;
                    const nx = dx / dist, nz = dz / dist;
                    const ramMult = aSize > bSize ? 1.6 : 1;
                    const ramMult2 = bSize > aSize ? 1.6 : 1;
                    a.x -= nx * overlap * ramMult; a.z -= nz * overlap * ramMult;
                    b.x += nx * overlap * ramMult2; b.z += nz * overlap * ramMult2;
                    a.speed *= 0.82; b.speed *= 0.82;
                }
            }
        }

        room.projectiles = room.projectiles.filter(pr => {
            const isGun = pr.itemId === '__gun';
            const def = isGun ? GUN : ITEM_DEFS[pr.itemId];
            const speed = isGun ? GUN.speed : def.speed;
            const maxLife = isGun ? GUN.maxLifeMs : def.maxLifeMs;
            const hitRadius = isGun ? GUN.hitRadius : def.hitRadius;

            if (now - pr.spawnedAt > maxLife) return false;

            if (!isGun && def.homing) {
                let nearest = null, nd = Infinity;
                activeIds.forEach(id => {
                    if (id === pr.ownerId) return;
                    const t = room.players[id];
                    if ((t.currentFloor || 0) !== (pr.floor || 0)) return;
                    const d = Math.hypot(t.x - pr.x, t.z - pr.z);
                    if (d < nd) { nd = d; nearest = t; }
                });
                if (nearest) {
                    const desired = Math.atan2(nearest.z - pr.z, nearest.x - pr.x);
                    const cur = Math.atan2(pr.dz, pr.dx);
                    let diff = desired - cur;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    const turn = Math.max(-0.1, Math.min(0.1, diff));
                    const newAngle = cur + turn;
                    pr.dx = Math.cos(newAngle); pr.dz = Math.sin(newAngle);
                }
            }

            pr.x += pr.dx * speed * DT;
            pr.z += pr.dz * speed * DT;
            for (const id of activeIds) {
                if (id === pr.ownerId) continue;
                const target = room.players[id];
                if ((target.currentFloor || 0) !== (pr.floor || 0)) continue;
                if (!canBeHit(room, target, now)) continue;
                if (Math.hypot(target.x - pr.x, target.z - pr.z) < hitRadius) {
                    applyItemEffect(room, pr.ownerId, id, isGun ? { lethal: true, stunMs: GUN.stunMs, icon: 'gun' } : def, now);
                    return false;
                }
            }
            return outerNorm(map.bounds, pr.x, pr.z) < 1.05;
        });

        room.hazards = room.hazards.filter(hz => {
            const def = ITEM_DEFS[hz.itemId];
            if (now - hz.createdAt > def.lifeMs) return false;
            for (const id of activeIds) {
                if (id === hz.ownerId && now - hz.createdAt < 1000) continue;
                const target = room.players[id];
                if ((target.currentFloor || 0) !== (hz.floor || 0)) continue;
                if (!canBeHit(room, target, now)) continue;
                if (Math.hypot(target.x - hz.x, target.z - hz.z) < def.radius) {
                    applyItemEffect(room, hz.ownerId, id, def, now);
                    return false;
                }
            }
            return true;
        });

        if (room.mode === 'race') {
            if (ids.length > 0 && ids.every(id => room.players[id].finished)) room.raceState = 'finished';
        } else if (room.teams) {
            if (room.winCondition === 'score') {
                const winTeam = TEAM_IDS.find(t => (room.teamScores[t] || 0) >= room.scoreTarget);
                if (winTeam) { room.raceState = 'finished'; room.winnerTeam = winTeam; }
            } else if (now >= room.battleEndsAt) {
                room.raceState = 'finished';
                room.winnerTeam = room.teamScores.red === room.teamScores.blue ? null : (room.teamScores.red > room.teamScores.blue ? 'red' : 'blue');
            }
        } else {
            if (room.winCondition === 'score') {
                const winner = ids.find(id => (room.scores[id] || 0) >= room.scoreTarget);
                if (winner) { room.raceState = 'finished'; room.winnerId = winner; }
            } else if (now >= room.battleEndsAt) {
                room.raceState = 'finished';
                let best = null;
                ids.forEach(id => { if (!best || (room.scores[id] || 0) > (room.scores[best] || 0)) best = id; });
                room.winnerId = best;
            }
        }

        if (room.raceState === 'finished') scheduleAutoNextRound(code, room);
    }

    const payload = {
        mode: room.mode, mapId: room.mapId, now,
        raceState: room.raceState, countdownValue: room.countdownValue,
        nextRoundInMs: room.raceState === 'finished' ? Math.max(0, room.nextRoundAt - now) : 0,
        map: { bounds: map.bounds, theme: map.theme, platforms: map.platforms, towerRamps: map.towerRamps },
        obstacles: map.obstacles, boostPads: map.boostPads, ramps: map.ramps,
        megaBoost: room.megaBoost.active ? { x: room.megaBoost.x, z: room.megaBoost.z, floor: room.megaBoost.floor } : null,
        itemBoxes: room.itemBoxes.map(b => ({ id: b.id, x: b.x, z: b.z, floor: b.floor, available: b.available, smashedAt: b.smashedAt || 0 })),
        projectiles: room.projectiles.map(pr => ({ id: pr.id, x: pr.x, z: pr.z, itemId: pr.itemId, floor: pr.floor })),
        hazards: room.hazards.map(hz => ({ id: hz.id, x: hz.x, z: hz.z, itemId: hz.itemId, floor: hz.floor })),
        players: Object.fromEntries(ids.map(id => {
            const p = room.players[id];
            const base = {
                name: p.name, color: p.color, vehicle: p.vehicle, x: p.x, y: p.y, z: p.z, angle: p.angle, speed: p.speed,
                heldItem: p.heldItem, boosting: p.boostTimer > 0 || now < p.megaBoostUntil, stunned: now < p.stunUntil, fellAt: p.fellAt,
                ammo: p.ammo, maxAmmo: GUN.maxAmmo,
                shielded: now < p.shieldUntil, grown: now < p.growUntil, shrunk: now < p.shrinkUntil,
                reversed: now < p.reverseUntil, slipped: now < p.slipUntil, empJammed: now < p.empUntil,
                pulsing: now < p.pulseUntil, stealth: now < p.stealthUntil, radar: now < p.radarUntil, team: p.team || null,
                floor: p.currentFloor || 0
            };
            if (room.mode === 'race') return [id, { ...base, lap: p.lap, finished: p.finished }];
            return [id, { ...base, alive: p.alive, respawnAt: p.respawnAt, score: room.scores[id] || 0 }];
        }))
    };
    if (room.mode === 'race') {
        payload.lapsToWin = LAPS_TO_WIN;
        payload.finishOrder = room.finishOrder;
    } else {
        payload.scores = room.scores;
        payload.killFeed = room.killFeed;
        payload.winCondition = room.winCondition;
        payload.scoreTarget = room.scoreTarget;
        payload.timeRemainingMs = Math.max(0, room.battleEndsAt - now);
        payload.winnerId = room.winnerId;
        payload.teams = room.teams;
        payload.teamScores = room.teamScores;
        payload.winnerTeam = room.winnerTeam;
    }
    io.to(code).emit('state', payload);
}

setInterval(() => { for (const [code, room] of rooms) tickRoom(code, room); }, 1000 / TICK_RATE);

const VEHICLE_IDS = ['kart', 'toycar', 'milktruck'];

function addPlayerToRoom(socket, code, room, name, vehicle) {
    socket.join(code);
    socket.data.roomCode = code;
    const map = MAPS[room.mapId];
    const isMidMatch = room.raceState === 'countdown' || room.raceState === 'racing';
    const p = freshPlayerState({
        name: String(name || 'Player').slice(0, 14) || 'Player',
        color: COLORS[Object.keys(room.players).length % COLORS.length],
        vehicle: VEHICLE_IDS.includes(vehicle) ? vehicle : 'kart',
        x: map.bounds.cx, y: 0, z: map.bounds.cz, angle: 0, speed: 0,
        lap: 0, nextCheckpoint: 1, finished: false, finishTime: null,
        alive: true, respawnAt: 0, spawnProtectedUntil: 0
    });
    if (room.teams) { p.team = balanceTeam(room); p.color = TEAM_COLORS[p.team]; }
    room.players[socket.id] = p;
    if (isMidMatch) {
        placeNewPlayer(room, map, socket.id);
    } else {
        resetRace(room);
    }
    socket.emit('roomJoined', { code, mapId: room.mapId, mode: room.mode });
    broadcastLobby(code, room);
}

io.on('connection', (socket) => {
    socket.on('createRoom', (data) => {
        const mapId = MAPS[data && data.mapId] ? data.mapId : 'classic';
        const winCondition = (data && data.winCondition === 'score') ? 'score' : 'time';
        const code = generateRoomCode();
        const room = createRoomState(mapId, winCondition, false, MAPS[mapId].mode === 'battle' && !!(data && data.teams));
        rooms.set(code, room);
        addPlayerToRoom(socket, code, room, data && data.name, data && data.vehicle);
    });

    socket.on('quickMatch', (data) => {
        const mode = (data && data.mode === 'battle') ? 'battle' : 'race';
        const wantTeams = mode === 'battle' && !!(data && data.teams);
        const defaultMapId = mode === 'battle' ? 'colosseum' : 'classic';
        let targetCode = null;
        for (const [c, r] of rooms) {
            // public (quick-match) rooms accept drop-in players any time, even mid-match
            if (r.isPublic && r.mode === mode && r.teams === wantTeams && Object.keys(r.players).length < MAX_ROOM_SIZE) {
                targetCode = c; break;
            }
        }
        let room;
        if (targetCode) {
            room = rooms.get(targetCode);
        } else {
            targetCode = generateRoomCode();
            room = createRoomState(defaultMapId, 'time', true, wantTeams);
            rooms.set(targetCode, room);
        }
        addPlayerToRoom(socket, targetCode, room, data && data.name, data && data.vehicle);
    });

    socket.on('joinRoom', (data) => {
        const code = String((data && data.code) || '').toUpperCase().trim();
        const room = rooms.get(code);
        if (!room) { socket.emit('joinRejected', 'Room nahi mila! Code check karo.'); return; }
        if (Object.keys(room.players).length >= MAX_ROOM_SIZE) {
            socket.emit('joinRejected', 'Room full hai!');
            return;
        }
        const isMidMatch = room.raceState === 'countdown' || room.raceState === 'racing';
        if (isMidMatch && !room.isPublic) {
            socket.emit('joinRejected', 'Match chal raha hai, thodi der wait karo!');
            return;
        }
        addPlayerToRoom(socket, code, room, data && data.name, data && data.vehicle);
    });

    socket.on('input', (inp) => {
        const room = rooms.get(socket.data.roomCode);
        const p = room && room.players[socket.id];
        if (p && inp) {
            p.input = { up: !!inp.up, down: !!inp.down, left: !!inp.left, right: !!inp.right, fire: !!inp.fire };
        }
    });

    socket.on('useItem', () => {
        const room = rooms.get(socket.data.roomCode);
        if (!room) return;
        const p = room.players[socket.id];
        if (!p) return;
        const alive = room.mode === 'race' ? !p.finished : p.alive;
        if (!p.heldItem || room.raceState !== 'racing' || !alive) return;
        const now = Date.now();
        if (now < p.empUntil) { p.heldItem = null; return; }
        const def = ITEM_DEFS[p.heldItem];
        if (!def) { p.heldItem = null; return; }
        if (def.kind === 'self') {
            applySelfEffect(room, socket.id, def, now);
        } else if (def.kind === 'projectile') {
            room.projectiles.push({
                id: room.nextEntityId++, ownerId: socket.id, itemId: def.id, floor: p.currentFloor || 0,
                x: p.x + Math.cos(p.angle) * 2.6, z: p.z + Math.sin(p.angle) * 2.6,
                dx: Math.cos(p.angle), dz: Math.sin(p.angle), spawnedAt: now
            });
        } else if (def.kind === 'hazard') {
            room.hazards.push({
                id: room.nextEntityId++, ownerId: socket.id, itemId: def.id, floor: p.currentFloor || 0,
                x: p.x - Math.cos(p.angle) * 3, z: p.z - Math.sin(p.angle) * 3, createdAt: now
            });
        } else if (def.kind === 'aoe') {
            applyAoeEffect(room, socket.id, def, now);
        }
        p.heldItem = null;
    });

    socket.on('startRace', () => {
        const room = rooms.get(socket.data.roomCode);
        if (room && Object.keys(room.players).length >= 1 && room.raceState === 'lobby') {
            startCountdown(room);
        }
    });

    socket.on('restart', () => {
        const room = rooms.get(socket.data.roomCode);
        if (!room) return;
        resetRace(room);
        broadcastLobby(socket.data.roomCode, room);
    });

    function leaveCurrentRoom(socket) {
        const code = socket.data.roomCode;
        const room = rooms.get(code);
        if (!room) return;
        delete room.players[socket.id];
        socket.leave(code);
        socket.data.roomCode = null;
        if (Object.keys(room.players).length === 0) {
            if (room.countdownInterval) clearInterval(room.countdownInterval);
            if (room.autoNextTimer) clearTimeout(room.autoNextTimer);
            rooms.delete(code);
        } else {
            broadcastLobby(code, room);
        }
    }

    socket.on('leaveRoom', () => leaveCurrentRoom(socket));
    socket.on('disconnect', () => leaveCurrentRoom(socket));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Desi Kart Battle 3D server running: http://localhost:${PORT}`);
});
