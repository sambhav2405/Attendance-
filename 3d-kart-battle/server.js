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

// ===== Track definition (big elliptical ring track on the X/Z ground plane) =====
const TRACK = {
    cx: 0, cz: 0,
    rxOuter: 70, rzOuter: 50,
    rxInner: 34, rzInner: 24,
    checkpoints: 8
};
const rxMid = (TRACK.rxOuter + TRACK.rxInner) / 2;
const rzMid = (TRACK.rzOuter + TRACK.rzInner) / 2;

const TICK_RATE = 30;
const DT = 1 / TICK_RATE;
const LAPS_TO_WIN = 3;

const CAR = {
    maxSpeed: 34,
    itemBoostMult: 1.7,
    itemBoostDuration: 1.6,
    padBoostMult: 1.45,
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
const ITEM_BOX_COUNT = 5;
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

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#eab308'];
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// ===== Track math helpers (shared by every room) =====
function checkpointAngle(index) { return (index / TRACK.checkpoints) * Math.PI * 2 - Math.PI / 2; }
function checkpointWaypoint(index) {
    const a = checkpointAngle(index);
    return {
        x: TRACK.cx + rxMid * Math.cos(a),
        z: TRACK.cz + rzMid * Math.sin(a),
        heading: Math.atan2(rzMid * Math.cos(a), -rxMid * Math.sin(a))
    };
}
function angleOnTrack(x, z) { return Math.atan2((z - TRACK.cz) / rzMid, (x - TRACK.cx) / rxMid); }
function checkpointIndexForAngle(a) {
    let shifted = a + Math.PI / 2;
    if (shifted < 0) shifted += Math.PI * 2;
    return Math.floor((shifted / (Math.PI * 2)) * TRACK.checkpoints) % TRACK.checkpoints;
}
function outerNorm(x, z) {
    const dx = (x - TRACK.cx) / TRACK.rxOuter, dz = (z - TRACK.cz) / TRACK.rzOuter;
    return Math.sqrt(dx * dx + dz * dz);
}
function innerNorm(x, z) {
    const dx = (x - TRACK.cx) / TRACK.rxInner, dz = (z - TRACK.cz) / TRACK.rzInner;
    return Math.sqrt(dx * dx + dz * dz);
}
function isOnTrack(x, z) { return outerNorm(x, z) <= 1.001 && innerNorm(x, z) >= 1; }

function startPositions(n) {
    const startZ = TRACK.cz - rzMid;
    const positions = [];
    for (let i = 0; i < n; i++) {
        const row = Math.floor(i / 2);
        const col = i % 2;
        positions.push({ x: TRACK.cx - 4 - row * 4, z: startZ + (col === 0 ? -1.8 : 1.8), angle: 0 });
    }
    return positions;
}

function makeItemBoxes() {
    const boxes = [];
    for (let i = 0; i < ITEM_BOX_COUNT; i++) {
        const a = (i / ITEM_BOX_COUNT) * Math.PI * 2 + Math.PI / ITEM_BOX_COUNT;
        boxes.push({ id: i, x: TRACK.cx + rxMid * Math.cos(a), z: TRACK.cz + rzMid * Math.sin(a), available: true, respawnAt: 0 });
    }
    return boxes;
}

// Static obstacles (colourful drums) - scattered between the inner and outer track edge to force weaving.
const OBSTACLES = [0.35, 1.15, 2.05, 3.05, 3.95, 4.95].map((angle, i) => {
    const t = (i % 2 === 0) ? 0.35 : 0.65; // 0 = near inner edge, 1 = near outer edge
    const rx = TRACK.rxInner + (TRACK.rxOuter - TRACK.rxInner) * t;
    const rz = TRACK.rzInner + (TRACK.rzOuter - TRACK.rzInner) * t;
    return { id: i, x: TRACK.cx + rx * Math.cos(angle), z: TRACK.cz + rz * Math.sin(angle), radius: CAR.obstacleRadius };
});

const BOOST_PADS = [0.9, 2.6, 4.2, 5.6].map((angle, i) => ({
    id: i,
    x: TRACK.cx + rxMid * Math.cos(angle),
    z: TRACK.cz + rzMid * Math.sin(angle),
    radius: 3.4
}));

function generateRoomCode() {
    let code;
    do {
        code = Array.from({ length: 4 }, () => ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]).join('');
    } while (rooms.has(code));
    return code;
}

function createRoomState() {
    return {
        players: {},
        raceState: 'lobby', // lobby | countdown | racing | finished
        countdownValue: 0,
        raceStartTime: 0,
        finishOrder: [],
        projectiles: [],
        hazards: [],
        itemBoxes: makeItemBoxes(),
        countdownInterval: null,
        nextEntityId: 1
    };
}

const rooms = new Map(); // code -> room state

function broadcastLobby(code, room) {
    io.to(code).emit('lobby', {
        code,
        players: Object.fromEntries(Object.entries(room.players).map(([id, p]) => [id, { name: p.name, color: p.color }]))
    });
}

function resetRace(room) {
    if (room.countdownInterval) { clearInterval(room.countdownInterval); room.countdownInterval = null; }
    const ids = Object.keys(room.players);
    const positions = startPositions(ids.length);
    ids.forEach((id, i) => {
        const p = room.players[id];
        p.x = positions[i].x; p.z = positions[i].z; p.y = 0;
        p.angle = 0; p.speed = 0;
        p.lap = 0; p.nextCheckpoint = 1;
        p.finished = false; p.finishTime = null;
        p.heldItem = null;
        p.boostTimer = 0;
        p.stunUntil = 0;
        p.stunImmuneUntil = 0;
        p.fellAt = 0;
        p.lastGunFireAt = 0;
        p.input = { up: false, down: false, left: false, right: false, fire: false };
    });
    room.projectiles = [];
    room.hazards = [];
    room.itemBoxes = makeItemBoxes();
    room.finishOrder = [];
    room.raceState = 'lobby';
}

function tickRoom(code, room) {
    const now = Date.now();
    const ids = Object.keys(room.players);
    if (ids.length === 0) return; // nothing to simulate / broadcast

    room.itemBoxes.forEach(b => { if (!b.available && now >= b.respawnAt) b.available = true; });

    if (room.raceState === 'racing') {
        ids.forEach(id => {
            const p = room.players[id];
            if (p.finished) return;
            const inp = p.input;
            const stunned = now < p.stunUntil;

            if (p.boostTimer > 0) p.boostTimer -= DT;

            const onTrack = isOnTrack(p.x, p.z);
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
            const oNorm1 = outerNorm(p.x, p.z);
            if (oNorm1 > 1) {
                const nx = (p.x - TRACK.cx) / TRACK.rxOuter, nz = (p.z - TRACK.cz) / TRACK.rzOuter;
                const scale = 1 / oNorm1;
                p.x = TRACK.cx + nx * scale * TRACK.rxOuter;
                p.z = TRACK.cz + nz * scale * TRACK.rzOuter;
                p.speed *= CAR.wallBounceMult;
            }

            // checkpoints / laps
            if (isOnTrack(p.x, p.z)) {
                const cp = checkpointIndexForAngle(angleOnTrack(p.x, p.z));
                if (cp === p.nextCheckpoint) {
                    p.nextCheckpoint = (p.nextCheckpoint + 1) % TRACK.checkpoints;
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

            // fell into the inner lake (no wall there - it's a risk/reward hazard)
            const iNorm = innerNorm(p.x, p.z);
            if (iNorm < 0.5) {
                const lastCp = (p.nextCheckpoint - 1 + TRACK.checkpoints) % TRACK.checkpoints;
                const wp = checkpointWaypoint(lastCp);
                p.x = wp.x; p.z = wp.z; p.angle = wp.heading; p.speed = 0;
                p.stunUntil = now + FALL_STUN_MS;
                p.stunImmuneUntil = now + FALL_STUN_MS + STUN_IMMUNITY_MS;
                p.fellAt = now;
            }

            // obstacle drums
            for (const ob of OBSTACLES) {
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

            // boost pads
            for (const pad of BOOST_PADS) {
                if (Math.hypot(p.x - pad.x, p.z - pad.z) < pad.radius) {
                    p.boostTimer = Math.max(p.boostTimer, CAR.padBoostDuration);
                }
            }

            // item box pickups
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

            // gun (hold to fire, always available, weak + short range)
            if (inp.fire && !stunned && !p.finished && now - p.lastGunFireAt >= GUN_COOLDOWN_MS) {
                p.lastGunFireAt = now;
                room.projectiles.push({
                    id: room.nextEntityId++, ownerId: id, type: 'bullet',
                    x: p.x + Math.cos(p.angle) * 2, z: p.z + Math.sin(p.angle) * 2,
                    dx: Math.cos(p.angle), dz: Math.sin(p.angle), spawnedAt: now
                });
            }
        });

        // kart-kart bump
        for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length; j++) {
                const a = room.players[ids[i]], b = room.players[ids[j]];
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

        // projectiles (shells from items + bullets from the gun)
        room.projectiles = room.projectiles.filter(pr => {
            const isBullet = pr.type === 'bullet';
            const speed = isBullet ? BULLET_SPEED : SHELL_SPEED;
            const maxLife = isBullet ? BULLET_MAX_LIFE_MS : SHELL_MAX_LIFE_MS;
            const hitRadius = isBullet ? BULLET_HIT_RADIUS : SHELL_HIT_RADIUS;
            const stunMs = isBullet ? BULLET_STUN_MS : STUN_MS;

            if (now - pr.spawnedAt > maxLife) return false;
            pr.x += pr.dx * speed * DT;
            pr.z += pr.dz * speed * DT;
            for (const id of ids) {
                if (id === pr.ownerId) continue;
                const target = room.players[id];
                if (target.finished || now < target.stunUntil || now < target.stunImmuneUntil) continue;
                if (Math.hypot(target.x - pr.x, target.z - pr.z) < hitRadius) {
                    target.stunUntil = now + stunMs;
                    target.stunImmuneUntil = now + stunMs + STUN_IMMUNITY_MS;
                    target.speed *= 0.25;
                    return false;
                }
            }
            return outerNorm(pr.x, pr.z) < 1.05; // despawn on hitting the outer wall
        });

        // hazards (chai spill)
        room.hazards = room.hazards.filter(hz => {
            if (now - hz.createdAt > HAZARD_LIFE_MS) return false;
            for (const id of ids) {
                if (id === hz.ownerId && now - hz.createdAt < 1000) continue;
                const target = room.players[id];
                if (target.finished || now < target.stunUntil || now < target.stunImmuneUntil) continue;
                if (Math.hypot(target.x - hz.x, target.z - hz.z) < HAZARD_RADIUS) {
                    target.stunUntil = now + STUN_MS * 0.8;
                    target.stunImmuneUntil = now + STUN_MS * 0.8 + STUN_IMMUNITY_MS;
                    target.speed *= 0.2;
                    return false;
                }
            }
            return true;
        });

        if (ids.length > 0 && ids.every(id => room.players[id].finished)) {
            room.raceState = 'finished';
        }
    }

    io.to(code).emit('state', {
        raceState: room.raceState, countdownValue: room.countdownValue, lapsToWin: LAPS_TO_WIN,
        track: TRACK,
        obstacles: OBSTACLES,
        boostPads: BOOST_PADS,
        itemBoxes: room.itemBoxes.map(b => ({ id: b.id, x: b.x, z: b.z, available: b.available })),
        projectiles: room.projectiles.map(pr => ({ id: pr.id, x: pr.x, z: pr.z, type: pr.type || 'shell' })),
        hazards: room.hazards.map(hz => ({ id: hz.id, x: hz.x, z: hz.z })),
        players: Object.fromEntries(ids.map(id => {
            const p = room.players[id];
            return [id, {
                name: p.name, color: p.color, x: p.x, y: p.y, z: p.z, angle: p.angle, speed: p.speed,
                lap: p.lap, finished: p.finished, heldItem: p.heldItem,
                boosting: p.boostTimer > 0, stunned: now < p.stunUntil, fellAt: p.fellAt
            }];
        })),
        finishOrder: room.finishOrder
    });
}

setInterval(() => { for (const [code, room] of rooms) tickRoom(code, room); }, 1000 / TICK_RATE);

function addPlayerToRoom(socket, code, room, name) {
    socket.join(code);
    socket.data.roomCode = code;
    room.players[socket.id] = {
        name: String(name || 'Player').slice(0, 14) || 'Player',
        color: COLORS[Object.keys(room.players).length % COLORS.length],
        x: TRACK.cx, y: 0, z: TRACK.cz, angle: 0, speed: 0,
        lap: 0, nextCheckpoint: 1, finished: false, finishTime: null,
        heldItem: null, boostTimer: 0, stunUntil: 0, stunImmuneUntil: 0, fellAt: 0, lastGunFireAt: 0,
        input: { up: false, down: false, left: false, right: false, fire: false }
    };
    resetRace(room);
    socket.emit('roomJoined', { code });
    broadcastLobby(code, room);
}

io.on('connection', (socket) => {
    socket.on('createRoom', (name) => {
        const code = generateRoomCode();
        const room = createRoomState();
        rooms.set(code, room);
        addPlayerToRoom(socket, code, room, name);
    });

    socket.on('joinRoom', (data) => {
        const code = String((data && data.code) || '').toUpperCase().trim();
        const room = rooms.get(code);
        if (!room) { socket.emit('joinRejected', 'Room nahi mila! Code check karo.'); return; }
        if (room.raceState === 'countdown' || room.raceState === 'racing') {
            socket.emit('joinRejected', 'Race chal rahi hai, agli race ka wait karo!');
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
        if (!p || !p.heldItem || room.raceState !== 'racing' || p.finished) return;
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
