const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// ===== Track definition (elliptical ring track) =====
const TRACK = {
    cx: 500, cy: 350,
    rxOuter: 430, ryOuter: 300,
    rxInner: 230, ryInner: 130,
    checkpoints: 8
};

const TICK_RATE = 30;
const DT = 1 / TICK_RATE;
const LAPS_TO_WIN = 3;

const CAR = {
    maxSpeed: 260,
    accel: 220,
    brake: 320,
    friction: 90,
    offTrackFriction: 420,
    turnSpeed: 2.6,
    boostMult: 1.6,
    boostDuration: 1.2,
    boostCooldown: 5,
    bounceRadius: 22
};

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#eab308'];

let players = {};
let raceState = 'lobby'; // lobby | countdown | racing | finished
let countdownValue = 0;
let raceStartTime = 0;
let finishOrder = [];
let countdownInterval = null;

function startPositions(n) {
    const midR_y = (TRACK.ryOuter + TRACK.ryInner) / 2;
    const startY = TRACK.cy - midR_y;
    const positions = [];
    for (let i = 0; i < n; i++) {
        const row = Math.floor(i / 2);
        const col = i % 2;
        positions.push({
            x: TRACK.cx - 40 - row * 40,
            y: startY + (col === 0 ? -16 : 16),
            angle: 0
        });
    }
    return positions;
}

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
        p.x = positions[i].x;
        p.y = positions[i].y;
        p.angle = 0;
        p.speed = 0;
        p.lap = 0;
        p.nextCheckpoint = 1;
        p.finished = false;
        p.finishTime = null;
        p.boostTimer = 0;
        p.boostCooldownTimer = 0;
        p.input = { up: false, down: false, left: false, right: false, boost: false };
    });
    finishOrder = [];
    raceState = 'lobby';
}

function angleOnTrack(x, y) {
    const nx = (x - TRACK.cx) / ((TRACK.rxOuter + TRACK.rxInner) / 2);
    const ny = (y - TRACK.cy) / ((TRACK.ryOuter + TRACK.ryInner) / 2);
    return Math.atan2(ny, nx);
}

function checkpointIndexForAngle(a) {
    let shifted = a + Math.PI / 2;
    if (shifted < 0) shifted += Math.PI * 2;
    return Math.floor((shifted / (Math.PI * 2)) * TRACK.checkpoints) % TRACK.checkpoints;
}

function isOnTrack(x, y) {
    const dx = (x - TRACK.cx) / TRACK.rxOuter;
    const dy = (y - TRACK.cy) / TRACK.ryOuter;
    const outer = dx * dx + dy * dy <= 1;
    const dx2 = (x - TRACK.cx) / TRACK.rxInner;
    const dy2 = (y - TRACK.cy) / TRACK.ryInner;
    const inner = dx2 * dx2 + dy2 * dy2 <= 1;
    return outer && !inner;
}

function tick() {
    const ids = Object.keys(players);

    if (raceState === 'racing') {
        ids.forEach(id => {
            const p = players[id];
            if (p.finished) return;
            const inp = p.input;

            if (inp.boost && p.boostCooldownTimer <= 0 && p.boostTimer <= 0) {
                p.boostTimer = CAR.boostDuration;
                p.boostCooldownTimer = CAR.boostCooldown;
            }
            if (p.boostTimer > 0) p.boostTimer -= DT;
            if (p.boostCooldownTimer > 0) p.boostCooldownTimer -= DT;

            const onTrack = isOnTrack(p.x, p.y);
            const maxSpeed = CAR.maxSpeed * (p.boostTimer > 0 ? CAR.boostMult : 1) * (onTrack ? 1 : 0.5);

            if (inp.up) p.speed += CAR.accel * DT;
            else if (inp.down) p.speed -= CAR.brake * DT;
            else {
                const f = onTrack ? CAR.friction : CAR.offTrackFriction;
                if (p.speed > 0) p.speed = Math.max(0, p.speed - f * DT);
                else if (p.speed < 0) p.speed = Math.min(0, p.speed + f * DT);
            }
            p.speed = Math.max(-CAR.maxSpeed * 0.5, Math.min(maxSpeed, p.speed));

            const turnFactor = Math.min(1, Math.abs(p.speed) / 80);
            const turnDir = p.speed < 0 ? -1 : 1;
            if (inp.left) p.angle -= CAR.turnSpeed * DT * turnFactor * turnDir;
            if (inp.right) p.angle += CAR.turnSpeed * DT * turnFactor * turnDir;

            p.x += Math.cos(p.angle) * p.speed * DT;
            p.y += Math.sin(p.angle) * p.speed * DT;

            if (isOnTrack(p.x, p.y)) {
                const a = angleOnTrack(p.x, p.y);
                const cp = checkpointIndexForAngle(a);
                if (cp === p.nextCheckpoint) {
                    p.nextCheckpoint = (p.nextCheckpoint + 1) % TRACK.checkpoints;
                    if (cp === 0) {
                        p.lap += 1;
                        if (p.lap >= LAPS_TO_WIN) {
                            p.finished = true;
                            p.finishTime = Date.now() - raceStartTime;
                            finishOrder.push({ id, name: p.name, time: p.finishTime });
                        }
                    }
                }
            }
        });

        for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length; j++) {
                const a = players[ids[i]], b = players[ids[j]];
                const dx = b.x - a.x, dy = b.y - a.y;
                const dist = Math.hypot(dx, dy);
                const minDist = CAR.bounceRadius * 2;
                if (dist > 0 && dist < minDist) {
                    const overlap = (minDist - dist) / 2;
                    const nx = dx / dist, ny = dy / dist;
                    a.x -= nx * overlap; a.y -= ny * overlap;
                    b.x += nx * overlap; b.y += ny * overlap;
                    a.speed *= 0.85; b.speed *= 0.85;
                }
            }
        }

        if (ids.length > 0 && ids.every(id => players[id].finished)) {
            raceState = 'finished';
        }
    }

    io.emit('state', {
        raceState, countdownValue, lapsToWin: LAPS_TO_WIN,
        players: Object.fromEntries(ids.map(id => {
            const p = players[id];
            return [id, { name: p.name, color: p.color, x: p.x, y: p.y, angle: p.angle, speed: p.speed, lap: p.lap, finished: p.finished, boosting: p.boostTimer > 0 }];
        })),
        finishOrder,
        track: TRACK
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
            x: TRACK.cx, y: TRACK.cy, angle: 0, speed: 0,
            lap: 0, nextCheckpoint: 1, finished: false, finishTime: null,
            boostTimer: 0, boostCooldownTimer: 0,
            input: { up: false, down: false, left: false, right: false, boost: false }
        };
        resetRace();
        broadcastLobby();
    });

    socket.on('input', (inp) => {
        const p = players[socket.id];
        if (p && inp) {
            p.input = {
                up: !!inp.up, down: !!inp.down, left: !!inp.left, right: !!inp.right, boost: !!inp.boost
            };
        }
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
        if (Object.keys(players).length === 0) {
            resetRace();
        }
        broadcastLobby();
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Turbo Dost Racing server running: http://localhost:${PORT}`);
});
