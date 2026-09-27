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
const MAX_ROOM_SIZE = 12;
const AUTO_NEXT_ROUND_MS = 10000;

const JUMP_VY = 13, GRAVITY = 30, RAMP_RADIUS = 4.2, RAMP_MIN_SPEED = 8, RAMP_COOLDOWN_MS = 900;
const PULSE_RADIUS = 16, PULSE_STRENGTH = 22;

const COLORS = [
    '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#eab308',
    '#14b8a6', '#84cc16', '#6366f1', '#f43f5e'
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
    phantomCloak: { id: 'phantomCloak', name: 'Phantom Cloak', icon: 'cloak', desc: 'Kuch der ke liye dusron ko dhundhlaa dikhoge.', kind: 'self', effect: 'cloak', durationMs: 5000 }
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

const ARENA_OBSTACLES = [0, 1, 2, 3, 4, 5].map(i => {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const r = ARENA_BOUNDS.rxOuter * (i % 2 === 0 ? 0.38 : 0.62);
    return { id: i, x: ARENA_BOUNDS.cx + r * Math.cos(a), z: ARENA_BOUNDS.cz + r * Math.sin(a), radius: CAR.obstacleRadius };
});
const ARENA_BOOST_PADS = [0, Math.PI].map((a, i) => ({
    id: i, x: ARENA_BOUNDS.cx + ARENA_BOUNDS.rxOuter * 0.45 * Math.cos(a), z: ARENA_BOUNDS.cz + ARENA_BOUNDS.rzOuter * 0.45 * Math.sin(a), radius: 3.4
}));
const ARENA_ITEM_POSITIONS = ellipseRing(ARENA_BOUNDS, ARENA_BOUNDS.rxOuter * 0.65, ARENA_BOUNDS.rzOuter * 0.65, 6, Math.PI / 6);
const ARENA_SPAWN_POINTS = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    const x = ARENA_BOUNDS.cx + ARENA_BOUNDS.rxOuter * 0.78 * Math.cos(a);
    const z = ARENA_BOUNDS.cz + ARENA_BOUNDS.rzOuter * 0.78 * Math.sin(a);
    return { x, z, heading: Math.atan2(ARENA_BOUNDS.cz - z, ARENA_BOUNDS.cx - x) };
});
const ARENA_RAMPS = [Math.PI / 2, Math.PI * 1.5].map((angle, i) => {
    const x = ARENA_BOUNDS.cx + ARENA_BOUNDS.rxOuter * 0.4 * Math.cos(angle);
    const z = ARENA_BOUNDS.cz + ARENA_BOUNDS.rzOuter * 0.4 * Math.sin(angle);
    return { id: i, x, z, heading: angle + Math.PI };
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
        obstacles: ARENA_OBSTACLES, boostPads: ARENA_BOOST_PADS, itemBoxPositions: ARENA_ITEM_POSITIONS,
        spawnPoints: ARENA_SPAWN_POINTS, ramps: ARENA_RAMPS
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
    return MAPS[mapId].itemBoxPositions.map((pos, i) => ({ id: i, x: pos.x, z: pos.z, available: true, respawnAt: 0 }));
}

function generateRoomCode() {
    let code;
    do {
        code = Array.from({ length: 4 }, () => ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]).join('');
    } while (rooms.has(code));
    return code;
}

function createRoomState(mapId, winCondition, isPublic) {
    return {
        mapId, mode: MAPS[mapId].mode, winCondition: winCondition === 'score' ? 'score' : 'time',
        isPublic: !!isPublic,
        players: {},
        raceState: 'lobby', // lobby | countdown | racing | finished
        countdownValue: 0,
        raceStartTime: 0,
        finishOrder: [],
        scores: {},
        killFeed: [],
        winnerId: null,
        scoreTarget: 10,
        battleDurationMs: 3 * 60 * 1000,
        battleEndsAt: 0,
        nextRoundAt: 0,
        autoNextTimer: null,
        projectiles: [],
        hazards: [],
        itemBoxes: makeItemBoxes(mapId),
        countdownInterval: null,
        nextEntityId: 1
    };
}

const rooms = new Map(); // code -> room state

function broadcastLobby(code, room) {
    io.to(code).emit('lobby', {
        code, mapId: room.mapId, mode: room.mode, winCondition: room.winCondition,
        players: Object.fromEntries(Object.entries(room.players).map(([id, p]) => [id, { name: p.name, color: p.color }]))
    });
}

function freshPlayerState(base) {
    return Object.assign(base, {
        heldItem: null, boostTimer: 0,
        stunUntil: 0, stunImmuneUntil: 0, fellAt: 0,
        shieldUntil: 0, growUntil: 0, shrinkUntil: 0, reverseUntil: 0, slipUntil: 0, empUntil: 0,
        pulseUntil: 0, stealthUntil: 0, ammoOverloadUntil: 0,
        vy: 0, jumping: false, lastRampAt: 0,
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
    }
    room.projectiles = [];
    room.hazards = [];
    room.itemBoxes = makeItemBoxes(room.mapId);
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
    if (now < target.shieldUntil) { target.shieldUntil = 0; return; } // shield absorbs any single incoming effect

    if (def.lethal) {
        if (room.mode === 'battle') {
            target.alive = false;
            target.respawnAt = now + RESPAWN_DELAY_MS;
            target.speed = 0;
            room.scores[attackerId] = (room.scores[attackerId] || 0) + 1;
            const attacker = room.players[attackerId];
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
        default: break;
    }
}

function applyAoeEffect(room, id, def, now) {
    const p = room.players[id];
    Object.keys(room.players).forEach(oid => {
        if (oid === id) return;
        const o = room.players[oid];
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
}

function tickRoom(code, room) {
    const now = Date.now();
    const ids = Object.keys(room.players);
    if (ids.length === 0) return;
    const map = MAPS[room.mapId];

    room.itemBoxes.forEach(b => { if (!b.available && now >= b.respawnAt) b.available = true; });

    if (room.raceState === 'racing') {
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
            const maxSpeed = CAR.maxSpeed * (p.boostTimer > 0 ? CAR.itemBoostMult : 1) * (onTrack ? 1 : 0.6) * speedSizeFactor;

            if (stunned) {
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

            // jump ramps
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
            if (innerNorm(map.bounds, p.x, p.z) < 0.5) {
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
                if (Math.hypot(p.x - pad.x, p.z - pad.z) < pad.radius) {
                    p.boostTimer = Math.max(p.boostTimer, CAR.padBoostDuration);
                }
            }

            if (!p.heldItem) {
                for (const box of room.itemBoxes) {
                    if (!box.available) continue;
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
                    id: room.nextEntityId++, ownerId: id, itemId: '__gun',
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
                if (!canBeHit(room, target, now)) continue;
                if (Math.hypot(target.x - pr.x, target.z - pr.z) < hitRadius) {
                    if (isGun) {
                        if (now < target.shieldUntil) { target.shieldUntil = 0; }
                        else applyItemEffect(room, pr.ownerId, id, { lethal: true, stunMs: GUN.stunMs }, now);
                    } else {
                        applyItemEffect(room, pr.ownerId, id, def, now);
                    }
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
        map: { bounds: map.bounds, theme: map.theme },
        obstacles: map.obstacles, boostPads: map.boostPads, ramps: map.ramps,
        itemBoxes: room.itemBoxes.map(b => ({ id: b.id, x: b.x, z: b.z, available: b.available, smashedAt: b.smashedAt || 0 })),
        projectiles: room.projectiles.map(pr => ({ id: pr.id, x: pr.x, z: pr.z, itemId: pr.itemId })),
        hazards: room.hazards.map(hz => ({ id: hz.id, x: hz.x, z: hz.z, itemId: hz.itemId })),
        players: Object.fromEntries(ids.map(id => {
            const p = room.players[id];
            const base = {
                name: p.name, color: p.color, vehicle: p.vehicle, x: p.x, y: p.y, z: p.z, angle: p.angle, speed: p.speed,
                heldItem: p.heldItem, boosting: p.boostTimer > 0, stunned: now < p.stunUntil, fellAt: p.fellAt,
                ammo: p.ammo, maxAmmo: GUN.maxAmmo,
                shielded: now < p.shieldUntil, grown: now < p.growUntil, shrunk: now < p.shrinkUntil,
                reversed: now < p.reverseUntil, slipped: now < p.slipUntil, empJammed: now < p.empUntil,
                pulsing: now < p.pulseUntil, stealth: now < p.stealthUntil
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
        const room = createRoomState(mapId, winCondition, false);
        rooms.set(code, room);
        addPlayerToRoom(socket, code, room, data && data.name, data && data.vehicle);
    });

    socket.on('quickMatch', (data) => {
        const mode = (data && data.mode === 'battle') ? 'battle' : 'race';
        const defaultMapId = mode === 'battle' ? 'colosseum' : 'classic';
        let targetCode = null;
        for (const [c, r] of rooms) {
            // public (quick-match) rooms accept drop-in players any time, even mid-match
            if (r.isPublic && r.mode === mode && Object.keys(r.players).length < MAX_ROOM_SIZE) {
                targetCode = c; break;
            }
        }
        let room;
        if (targetCode) {
            room = rooms.get(targetCode);
        } else {
            targetCode = generateRoomCode();
            room = createRoomState(defaultMapId, 'time', true);
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
                id: room.nextEntityId++, ownerId: socket.id, itemId: def.id,
                x: p.x + Math.cos(p.angle) * 2.6, z: p.z + Math.sin(p.angle) * 2.6,
                dx: Math.cos(p.angle), dz: Math.sin(p.angle), spawnedAt: now
            });
        } else if (def.kind === 'hazard') {
            room.hazards.push({
                id: room.nextEntityId++, ownerId: socket.id, itemId: def.id,
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
