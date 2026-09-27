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

const TICK_RATE = 30;
const DT = 1 / TICK_RATE;
const LAPS_TO_WIN = 3;

const CAR = {
    maxSpeed: 34,
    itemBoostMult: 1.7,
    itemBoostDuration: 1.6,
    padBoostDuration: 1.3,
    accel: 26,
    brake: 36,
    friction: 15,
    offTrackFriction: 42,
    turnSpeed: 2.3,
    bounceRadius: 2.4,
    wallBounceMult: 0.32,
    obstacleRadius: 2.3,
    obstacleStunMs: 500
};

const ITEM_TYPES = ['boost', 'shell', 'oil'];
const ITEM_PICKUP_RADIUS = 3.2;
const ITEM_BOX_RESPAWN_MS = 4000;

const SHELL_SPEED = 48;
const SHELL_HIT_RADIUS = 2.4;
const SHELL_MAX_LIFE_MS = 3000;
const BULLET_SPEED = 60;
const BULLET_HIT_RADIUS = 1.7;
const BULLET_MAX_LIFE_MS = 900;
const BULLET_STUN_MS = 450;
const GUN_COOLDOWN_MS = 260;

const HAZARD_RADIUS = 2.4;
const HAZARD_LIFE_MS = 9000;
const STUN_MS = 1500;
const FALL_STUN_MS = 700;
const STUN_IMMUNITY_MS = 700; // brief immunity after a stun ends, so point-blank fire can't lock a kart forever
const SPAWN_PROTECTION_MS = 1500; // battle mode: can't be killed right after respawning
const RESPAWN_DELAY_MS = 5000;
const KILL_FEED_MAX = 6;
const MAX_ROOM_SIZE = 8;

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#eab308'];
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

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
const RACE_ITEM_POSITIONS = ellipseRing(RACE_BOUNDS, RACE_MID.rx, RACE_MID.rz, 5, Math.PI / 5);

const ARENA_OBSTACLES = [0, 1, 2, 3, 4, 5].map(i => {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const r = ARENA_BOUNDS.rxOuter * (i % 2 === 0 ? 0.38 : 0.62);
    return { id: i, x: ARENA_BOUNDS.cx + r * Math.cos(a), z: ARENA_BOUNDS.cz + r * Math.sin(a), radius: CAR.obstacleRadius };
});
const ARENA_BOOST_PADS = [0, Math.PI].map((a, i) => ({
    id: i, x: ARENA_BOUNDS.cx + ARENA_BOUNDS.rxOuter * 0.45 * Math.cos(a), z: ARENA_BOUNDS.cz + ARENA_BOUNDS.rzOuter * 0.45 * Math.sin(a), radius: 3.4
}));
const ARENA_ITEM_POSITIONS = ellipseRing(ARENA_BOUNDS, ARENA_BOUNDS.rxOuter * 0.65, ARENA_BOUNDS.rzOuter * 0.65, 5, Math.PI / 5);
const ARENA_SPAWN_POINTS = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    const x = ARENA_BOUNDS.cx + ARENA_BOUNDS.rxOuter * 0.78 * Math.cos(a);
    const z = ARENA_BOUNDS.cz + ARENA_BOUNDS.rzOuter * 0.78 * Math.sin(a);
    return { x, z, heading: Math.atan2(ARENA_BOUNDS.cz - z, ARENA_BOUNDS.cx - x) };
});

const MAPS = {
    classic: {
        id: 'classic', name: 'Classic Ring', mode: 'race',
        bounds: RACE_BOUNDS, mid: RACE_MID, checkpoints: 8,
        theme: { ground: 0x3f9142, wallColors: [0xef4444, 0xffffff], sky: 0x8ed3f5, mountain: 0x64748b, decor: 'trees', hazard: 0x1d78d8 },
        obstacles: RACE_OBSTACLES, boostPads: RACE_BOOST_PADS, itemBoxPositions: RACE_ITEM_POSITIONS
    },
    desert: {
        id: 'desert', name: 'Desert Dunes', mode: 'race',
        bounds: RACE_BOUNDS, mid: RACE_MID, checkpoints: 8,
        theme: { ground: 0xdcb35c, wallColors: [0xf97316, 0xffffff], sky: 0xffe0b3, mountain: 0xb45309, decor: 'cacti', hazard: 0x2563eb },
        obstacles: RACE_OBSTACLES, boostPads: RACE_BOOST_PADS, itemBoxPositions: RACE_ITEM_POSITIONS
    },
    colosseum: {
        id: 'colosseum', name: 'Colosseum', mode: 'battle',
        bounds: ARENA_BOUNDS, mid: null, checkpoints: 0,
        theme: { ground: 0x92400e, wallColors: [0x7c3aed, 0xfacc15], sky: 0x1e1b4b, mountain: 0x4c1d95, decor: 'stands', hazard: 0x1a0505 },
        obstacles: ARENA_OBSTACLES, boostPads: ARENA_BOOST_PADS, itemBoxPositions: ARENA_ITEM_POSITIONS,
        spawnPoints: ARENA_SPAWN_POINTS
    }
};

// ===== Generic ellipse math (shared by every map) =====
function outerNorm(bounds, x, z) {
    const dx = (x - bounds.cx) / bounds.rxOuter, dz = (z - bounds.cz) / bounds.rzOuter;
    return Math.sqrt(dx * dx + dz * dz);
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

function resetCombatFields(p) {
    p.heldItem = null; p.boostTimer = 0; p.stunUntil = 0; p.stunImmuneUntil = 0; p.fellAt = 0; p.lastGunFireAt = 0;
    p.input = { up: false, down: false, left: false, right: false, fire: false };
}

function resetRace(room) {
    if (room.countdownInterval) { clearInterval(room.countdownInterval); room.countdownInterval = null; }
    const map = MAPS[room.mapId];
    const ids = Object.keys(room.players);

    if (room.mode === 'race') {
        const positions = startPositions(map, ids.length);
        ids.forEach((id, i) => {
            const p = room.players[id];
            p.x = positions[i].x; p.z = positions[i].z; p.y = 0;
            p.angle = positions[i].angle; p.speed = 0;
            p.lap = 0; p.nextCheckpoint = 1; p.finished = false; p.finishTime = null;
            resetCombatFields(p);
        });
        room.finishOrder = [];
    } else {
        ids.forEach((id, i) => {
            const sp = map.spawnPoints[i % map.spawnPoints.length];
            const p = room.players[id];
            p.x = sp.x; p.z = sp.z; p.y = 0; p.angle = sp.heading; p.speed = 0;
            p.alive = true; p.respawnAt = 0; p.spawnProtectedUntil = Date.now() + SPAWN_PROTECTION_MS;
            resetCombatFields(p);
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

function canBeHit(room, target, now) {
    if (room.mode === 'battle') return target.alive && now >= target.spawnProtectedUntil;
    return now >= target.stunUntil && now >= target.stunImmuneUntil;
}

function registerHit(room, attackerId, targetId, stunMs, weapon, now) {
    const target = room.players[targetId];
    if (room.mode === 'battle') {
        target.alive = false;
        target.respawnAt = now + RESPAWN_DELAY_MS;
        target.speed = 0;
        room.scores[attackerId] = (room.scores[attackerId] || 0) + 1;
        const attacker = room.players[attackerId];
        room.killFeed.push({ id: room.nextEntityId++, attacker: attacker ? attacker.name : '?', victim: target.name, weapon, time: now });
        if (room.killFeed.length > KILL_FEED_MAX) room.killFeed.shift();
    } else {
        target.stunUntil = now + stunMs;
        target.stunImmuneUntil = now + stunMs + STUN_IMMUNITY_MS;
        target.speed *= 0.25;
    }
}

function respawnBattlePlayer(room, id, map) {
    const p = room.players[id];
    const sp = map.spawnPoints[Math.floor(Math.random() * map.spawnPoints.length)];
    const now = Date.now();
    p.x = sp.x; p.z = sp.z; p.angle = sp.heading; p.speed = 0;
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
            if (p.boostTimer > 0) p.boostTimer -= DT;

            const onTrack = isOnTrack(map.bounds, p.x, p.z);
            const maxSpeed = CAR.maxSpeed * (p.boostTimer > 0 ? CAR.itemBoostMult : 1) * (onTrack ? 1 : 0.6);

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
                const turnFactor = Math.min(1, Math.abs(p.speed) / 9);
                const turnDir = p.speed < 0 ? -1 : 1;
                if (inp.left) p.angle -= CAR.turnSpeed * DT * turnFactor * turnDir;
                if (inp.right) p.angle += CAR.turnSpeed * DT * turnFactor * turnDir;
            }

            p.x += Math.cos(p.angle) * p.speed * DT;
            p.z += Math.sin(p.angle) * p.speed * DT;

            // solid colourful outer wall: clamp position back onto the boundary + bounce
            const oNorm1 = outerNorm(map.bounds, p.x, p.z);
            if (oNorm1 > 1) {
                const nx = (p.x - map.bounds.cx) / map.bounds.rxOuter, nz = (p.z - map.bounds.cz) / map.bounds.rzOuter;
                const scale = 1 / oNorm1;
                p.x = map.bounds.cx + nx * scale * map.bounds.rxOuter;
                p.z = map.bounds.cz + nz * scale * map.bounds.rzOuter;
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
                const minDist = ob.radius + 0.9;
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
                        p.heldItem = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
                        box.available = false;
                        box.respawnAt = now + ITEM_BOX_RESPAWN_MS;
                        break;
                    }
                }
            }

            if (inp.fire && !stunned && now - p.lastGunFireAt >= GUN_COOLDOWN_MS) {
                p.lastGunFireAt = now;
                room.projectiles.push({
                    id: room.nextEntityId++, ownerId: id, type: 'bullet',
                    x: p.x + Math.cos(p.angle) * 2, z: p.z + Math.sin(p.angle) * 2,
                    dx: Math.cos(p.angle), dz: Math.sin(p.angle), spawnedAt: now
                });
            }
        });

        const activeIds = ids.filter(id => room.mode === 'race' ? !room.players[id].finished : room.players[id].alive);

        for (let i = 0; i < activeIds.length; i++) {
            for (let j = i + 1; j < activeIds.length; j++) {
                const a = room.players[activeIds[i]], b = room.players[activeIds[j]];
                const dx = b.x - a.x, dz = b.z - a.z;
                const dist = Math.hypot(dx, dz);
                const minDist = CAR.bounceRadius * 2;
                if (dist > 0 && dist < minDist) {
                    const overlap = (minDist - dist) / 2;
                    const nx = dx / dist, nz = dz / dist;
                    a.x -= nx * overlap; a.z -= nz * overlap;
                    b.x += nx * overlap; b.z += nz * overlap;
                    a.speed *= 0.82; b.speed *= 0.82;
                }
            }
        }

        room.projectiles = room.projectiles.filter(pr => {
            const isBullet = pr.type === 'bullet';
            const speed = isBullet ? BULLET_SPEED : SHELL_SPEED;
            const maxLife = isBullet ? BULLET_MAX_LIFE_MS : SHELL_MAX_LIFE_MS;
            const hitRadius = isBullet ? BULLET_HIT_RADIUS : SHELL_HIT_RADIUS;
            const stunMs = isBullet ? BULLET_STUN_MS : STUN_MS;
            const weapon = isBullet ? 'gun' : 'bomb';

            if (now - pr.spawnedAt > maxLife) return false;
            pr.x += pr.dx * speed * DT;
            pr.z += pr.dz * speed * DT;
            for (const id of activeIds) {
                if (id === pr.ownerId) continue;
                const target = room.players[id];
                if (!canBeHit(room, target, now)) continue;
                if (Math.hypot(target.x - pr.x, target.z - pr.z) < hitRadius) {
                    registerHit(room, pr.ownerId, id, stunMs, weapon, now);
                    return false;
                }
            }
            return outerNorm(map.bounds, pr.x, pr.z) < 1.05;
        });

        room.hazards = room.hazards.filter(hz => {
            if (now - hz.createdAt > HAZARD_LIFE_MS) return false;
            for (const id of activeIds) {
                if (id === hz.ownerId && now - hz.createdAt < 1000) continue;
                const target = room.players[id];
                if (!canBeHit(room, target, now)) continue;
                if (Math.hypot(target.x - hz.x, target.z - hz.z) < HAZARD_RADIUS) {
                    registerHit(room, hz.ownerId, id, STUN_MS * 0.8, 'chai', now);
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
    }

    const payload = {
        mode: room.mode, mapId: room.mapId, now,
        raceState: room.raceState, countdownValue: room.countdownValue,
        map: { bounds: map.bounds, theme: map.theme },
        obstacles: map.obstacles, boostPads: map.boostPads,
        itemBoxes: room.itemBoxes.map(b => ({ id: b.id, x: b.x, z: b.z, available: b.available })),
        projectiles: room.projectiles.map(pr => ({ id: pr.id, x: pr.x, z: pr.z, type: pr.type || 'shell' })),
        hazards: room.hazards.map(hz => ({ id: hz.id, x: hz.x, z: hz.z })),
        players: Object.fromEntries(ids.map(id => {
            const p = room.players[id];
            const base = {
                name: p.name, color: p.color, x: p.x, y: p.y, z: p.z, angle: p.angle, speed: p.speed,
                heldItem: p.heldItem, boosting: p.boostTimer > 0, stunned: now < p.stunUntil, fellAt: p.fellAt
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

function addPlayerToRoom(socket, code, room, name) {
    socket.join(code);
    socket.data.roomCode = code;
    const map = MAPS[room.mapId];
    room.players[socket.id] = {
        name: String(name || 'Player').slice(0, 14) || 'Player',
        color: COLORS[Object.keys(room.players).length % COLORS.length],
        x: map.bounds.cx, y: 0, z: map.bounds.cz, angle: 0, speed: 0,
        lap: 0, nextCheckpoint: 1, finished: false, finishTime: null,
        alive: true, respawnAt: 0, spawnProtectedUntil: 0,
        heldItem: null, boostTimer: 0, stunUntil: 0, stunImmuneUntil: 0, fellAt: 0, lastGunFireAt: 0,
        input: { up: false, down: false, left: false, right: false, fire: false }
    };
    resetRace(room);
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
        addPlayerToRoom(socket, code, room, data && data.name);
    });

    socket.on('quickMatch', (data) => {
        const mode = (data && data.mode === 'battle') ? 'battle' : 'race';
        const defaultMapId = mode === 'battle' ? 'colosseum' : 'classic';
        let targetCode = null;
        for (const [code, room] of rooms) {
            if (room.isPublic && room.mode === mode && room.raceState === 'lobby' && Object.keys(room.players).length < MAX_ROOM_SIZE) {
                targetCode = code; break;
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
        addPlayerToRoom(socket, targetCode, room, data && data.name);
    });

    socket.on('joinRoom', (data) => {
        const code = String((data && data.code) || '').toUpperCase().trim();
        const room = rooms.get(code);
        if (!room) { socket.emit('joinRejected', 'Room nahi mila! Code check karo.'); return; }
        if (room.raceState === 'countdown' || room.raceState === 'racing') {
            socket.emit('joinRejected', 'Match chal raha hai, thodi der wait karo!');
            return;
        }
        if (Object.keys(room.players).length >= MAX_ROOM_SIZE) {
            socket.emit('joinRejected', 'Room full hai!');
            return;
        }
        addPlayerToRoom(socket, code, room, data && data.name);
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
        const alive = room.mode === 'race' ? !p.finished : p.alive;
        if (!p || !p.heldItem || room.raceState !== 'racing' || !alive) return;
        const now = Date.now();
        if (p.heldItem === 'boost') {
            p.boostTimer = CAR.itemBoostDuration;
        } else if (p.heldItem === 'shell') {
            room.projectiles.push({
                id: room.nextEntityId++, ownerId: socket.id, type: 'shell',
                x: p.x + Math.cos(p.angle) * 2.6, z: p.z + Math.sin(p.angle) * 2.6,
                dx: Math.cos(p.angle), dz: Math.sin(p.angle), spawnedAt: now
            });
        } else if (p.heldItem === 'oil') {
            room.hazards.push({
                id: room.nextEntityId++, ownerId: socket.id,
                x: p.x - Math.cos(p.angle) * 3, z: p.z - Math.sin(p.angle) * 3, createdAt: now
            });
        }
        p.heldItem = null;
    });

    socket.on('startRace', () => {
        const room = rooms.get(socket.data.roomCode);
        if (room && Object.keys(room.players).length >= 1 && room.raceState === 'lobby') {
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
    });

    socket.on('restart', () => {
        const room = rooms.get(socket.data.roomCode);
        if (!room) return;
        resetRace(room);
        broadcastLobby(socket.data.roomCode, room);
    });

    socket.on('disconnect', () => {
        const code = socket.data.roomCode;
        const room = rooms.get(code);
        if (!room) return;
        delete room.players[socket.id];
        if (Object.keys(room.players).length === 0) {
            if (room.countdownInterval) clearInterval(room.countdownInterval);
            rooms.delete(code);
        } else {
            broadcastLobby(code, room);
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Desi Kart Battle 3D server running: http://localhost:${PORT}`);
});
