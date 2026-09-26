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

// ===== Track definition (elliptical ring track on the X/Z ground plane) =====
const TRACK = {
    cx: 0, cz: 0,
    rxOuter: 46, rzOuter: 32,
    rxInner: 23, rzInner: 16,
    checkpoints: 8
};
const rxMid = (TRACK.rxOuter + TRACK.rxInner) / 2;
const rzMid = (TRACK.rzOuter + TRACK.rzInner) / 2;

const TICK_RATE = 30;
const DT = 1 / TICK_RATE;
const LAPS_TO_WIN = 3;

const CAR = {
    maxSpeed: 30,
    itemBoostMult: 1.7,
    itemBoostDuration: 1.6,
    accel: 24,
    brake: 34,
    friction: 14,
    offTrackFriction: 46,
    turnSpeed: 2.5,
    bounceRadius: 2.4
};

const ITEM_TYPES = ['boost', 'shell', 'oil'];
const ITEM_BOX_COUNT = 4;
const ITEM_PICKUP_RADIUS = 3.2;
const ITEM_BOX_RESPAWN_MS = 4000;

const SHELL_SPEED = 46;
const SHELL_HIT_RADIUS = 2.4;
const SHELL_MAX_LIFE_MS = 3000;
const HAZARD_RADIUS = 2.4;
const HAZARD_LIFE_MS = 9000;
const STUN_MS = 1500;
const FALL_STUN_MS = 700;

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#eab308'];

let players = {};
let raceState = 'lobby'; // lobby | countdown | racing | finished
let countdownValue = 0;
let raceStartTime = 0;
let finishOrder = [];
let countdownInterval = null;
let projectiles = [];
let hazards = [];
let nextEntityId = 1;

// ===== Track math helpers =====
function checkpointAngle(index) {
    return (index / TRACK.checkpoints) * Math.PI * 2 - Math.PI / 2;
}
function checkpointWaypoint(index) {
    const a = checkpointAngle(index);
    return {
        x: TRACK.cx + rxMid * Math.cos(a),
        z: TRACK.cz + rzMid * Math.sin(a),
        heading: Math.atan2(rzMid * Math.cos(a), -rxMid * Math.sin(a))
    };
}
function angleOnTrack(x, z) {
    const nx = (x - TRACK.cx) / rxMid;
    const nz = (z - TRACK.cz) / rzMid;
    return Math.atan2(nz, nx);
}
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
function isOnTrack(x, z) { return outerNorm(x, z) <= 1 && innerNorm(x, z) >= 1; }

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
        boxes.push({
            id: i,
            x: TRACK.cx + rxMid * Math.cos(a),
            z: TRACK.cz + rzMid * Math.sin(a),
            available: true,
            respawnAt: 0
        });
    }
    return boxes;
}
let itemBoxes = makeItemBoxes();

function broadcastLobby() {
    io.emit('lobby', {
        players: Object.fromEntries(Object.entries(players).map(([id, p]) => [id, { name: p.name, color: p.color }]))
    });
}

function resetRace() {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    const ids = Object.keys(players);
    const positions = startPositions(ids.length);
    ids.forEach((id, i) => {
        const p = players[id];
        p.x = positions[i].x; p.z = positions[i].z; p.y = 0;
        p.angle = 0; p.speed = 0;
        p.lap = 0; p.nextCheckpoint = 1;
        p.finished = false; p.finishTime = null;
        p.heldItem = null;
        p.boostTimer = 0;
        p.stunUntil = 0;
        p.fellAt = 0;
        p.input = { up: false, down: false, left: false, right: false };
    });
    projectiles = [];
    hazards = [];
    itemBoxes = makeItemBoxes();
    finishOrder = [];
    raceState = 'lobby';
}

function tick() {
    const now = Date.now();
    const ids = Object.keys(players);

    itemBoxes.forEach(b => { if (!b.available && now >= b.respawnAt) b.available = true; });

    if (raceState === 'racing') {
        ids.forEach(id => {
            const p = players[id];
            if (p.finished) return;
            const inp = p.input;
            const stunned = now < p.stunUntil;

            if (p.boostTimer > 0) p.boostTimer -= DT;

            const onTrack = isOnTrack(p.x, p.z);
            const maxSpeed = CAR.maxSpeed * (p.boostTimer > 0 ? CAR.itemBoostMult : 1) * (onTrack ? 1 : 0.55);

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

            // checkpoints / laps
            if (isOnTrack(p.x, p.z)) {
                const cp = checkpointIndexForAngle(angleOnTrack(p.x, p.z));
                if (cp === p.nextCheckpoint) {
                    p.nextCheckpoint = (p.nextCheckpoint + 1) % TRACK.checkpoints;
                    if (cp === 0) {
                        p.lap += 1;
                        if (p.lap >= LAPS_TO_WIN) {
                            p.finished = true;
                            p.finishTime = now - raceStartTime;
                            finishOrder.push({ id, name: p.name, time: p.finishTime });
                        }
                    }
                }
            }

            // fell off track (too far outside, or deep into the inner lake)
            const oNorm = outerNorm(p.x, p.z), iNorm = innerNorm(p.x, p.z);
            if (oNorm > 1.45 || iNorm < 0.5) {
                const lastCp = (p.nextCheckpoint - 1 + TRACK.checkpoints) % TRACK.checkpoints;
                const wp = checkpointWaypoint(lastCp);
                p.x = wp.x; p.z = wp.z; p.angle = wp.heading; p.speed = 0;
                p.stunUntil = now + FALL_STUN_MS;
                p.fellAt = now;
            }

            // item box pickups
            if (!p.heldItem) {
                for (const box of itemBoxes) {
                    if (!box.available) continue;
                    if (Math.hypot(p.x - box.x, p.z - box.z) < ITEM_PICKUP_RADIUS) {
                        p.heldItem = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
                        box.available = false;
                        box.respawnAt = now + ITEM_BOX_RESPAWN_MS;
                        break;
                    }
                }
            }
        });

        // kart-kart bump
        for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length; j++) {
                const a = players[ids[i]], b = players[ids[j]];
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

        // projectiles
        projectiles = projectiles.filter(pr => {
            if (now - pr.spawnedAt > SHELL_MAX_LIFE_MS) return false;
            pr.x += pr.dx * SHELL_SPEED * DT;
            pr.z += pr.dz * SHELL_SPEED * DT;
            for (const id of ids) {
                if (id === pr.ownerId) continue;
                const target = players[id];
                if (target.finished || now < target.stunUntil) continue;
                if (Math.hypot(target.x - pr.x, target.z - pr.z) < SHELL_HIT_RADIUS) {
                    target.stunUntil = now + STUN_MS;
                    target.speed *= 0.2;
                    return false; // projectile consumed
                }
            }
            return outerNorm(pr.x, pr.z) < 1.9; // despawn once way off the world
        });

        // hazards
        hazards = hazards.filter(hz => {
            if (now - hz.createdAt > HAZARD_LIFE_MS) return false;
            for (const id of ids) {
                if (id === hz.ownerId && now - hz.createdAt < 1000) continue; // grace period for owner
                const target = players[id];
                if (target.finished || now < target.stunUntil) continue;
                if (Math.hypot(target.x - hz.x, target.z - hz.z) < HAZARD_RADIUS) {
                    target.stunUntil = now + STUN_MS * 0.8;
                    target.speed *= 0.2;
                    return false; // hazard consumed
                }
            }
            return true;
        });

        if (ids.length > 0 && ids.every(id => players[id].finished)) {
            raceState = 'finished';
        }
    }

    io.emit('state', {
        raceState, countdownValue, lapsToWin: LAPS_TO_WIN,
        track: TRACK,
        itemBoxes: itemBoxes.map(b => ({ id: b.id, x: b.x, z: b.z, available: b.available })),
        projectiles: projectiles.map(pr => ({ id: pr.id, x: pr.x, z: pr.z })),
        hazards: hazards.map(hz => ({ id: hz.id, x: hz.x, z: hz.z })),
        players: Object.fromEntries(ids.map(id => {
            const p = players[id];
            return [id, {
                name: p.name, color: p.color, x: p.x, y: p.y, z: p.z, angle: p.angle, speed: p.speed,
                lap: p.lap, finished: p.finished, heldItem: p.heldItem,
                boosting: p.boostTimer > 0, stunned: now < p.stunUntil, fellAt: p.fellAt
            }];
        })),
        finishOrder
    });
}

setInterval(tick, 1000 / TICK_RATE);

io.on('connection', (socket) => {
    socket.on('join', (name) => {
        if (raceState === 'countdown' || raceState === 'racing') {
            socket.emit('joinRejected', 'Race chal rahi hai, agli race ka wait karo!');
            return;
        }
        players[socket.id] = {
            name: String(name || 'Player').slice(0, 14) || 'Player',
            color: COLORS[Object.keys(players).length % COLORS.length],
            x: TRACK.cx, y: 0, z: TRACK.cz, angle: 0, speed: 0,
            lap: 0, nextCheckpoint: 1, finished: false, finishTime: null,
            heldItem: null, boostTimer: 0, stunUntil: 0, fellAt: 0,
            input: { up: false, down: false, left: false, right: false }
        };
        resetRace();
        broadcastLobby();
    });

    socket.on('input', (inp) => {
        const p = players[socket.id];
        if (p && inp) {
            p.input = { up: !!inp.up, down: !!inp.down, left: !!inp.left, right: !!inp.right };
        }
    });

    socket.on('useItem', () => {
        const p = players[socket.id];
        if (!p || !p.heldItem || raceState !== 'racing' || p.finished) return;
        const now = Date.now();
        if (p.heldItem === 'boost') {
            p.boostTimer = CAR.itemBoostDuration;
        } else if (p.heldItem === 'shell') {
            projectiles.push({
                id: nextEntityId++, ownerId: socket.id,
                x: p.x + Math.cos(p.angle) * 2.6, z: p.z + Math.sin(p.angle) * 2.6,
                dx: Math.cos(p.angle), dz: Math.sin(p.angle), spawnedAt: now
            });
        } else if (p.heldItem === 'oil') {
            hazards.push({
                id: nextEntityId++, ownerId: socket.id,
                x: p.x - Math.cos(p.angle) * 3, z: p.z - Math.sin(p.angle) * 3, createdAt: now
            });
        }
        p.heldItem = null;
    });

    socket.on('startRace', () => {
        if (Object.keys(players).length >= 1 && raceState === 'lobby') {
            resetRace();
            raceState = 'countdown';
            countdownValue = 3;
            countdownInterval = setInterval(() => {
                countdownValue -= 1;
                if (countdownValue <= 0) {
                    clearInterval(countdownInterval);
                    countdownInterval = null;
                    raceState = 'racing';
                    raceStartTime = Date.now();
                }
            }, 1000);
        }
    });

    socket.on('restart', () => {
        resetRace();
        broadcastLobby();
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        if (Object.keys(players).length === 0) resetRace();
        broadcastLobby();
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Desi Kart Battle 3D server running: http://localhost:${PORT}`);
});
