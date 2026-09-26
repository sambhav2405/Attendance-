const socket = io();

const lobbyScreen = document.getElementById('lobby');
const gameScreen = document.getElementById('gameScreen');
const resultScreen = document.getElementById('resultScreen');
const nameInput = document.getElementById('nameInput');
const joinBtn = document.getElementById('joinBtn');
const startBtn = document.getElementById('startBtn');
const playerListEl = document.getElementById('playerList');
const lobbyMsg = document.getElementById('lobbyMsg');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const countdownEl = document.getElementById('countdown');
const lapInfoEl = document.getElementById('lapInfo');
const resultList = document.getElementById('resultList');
const raceAgainBtn = document.getElementById('raceAgainBtn');

let myId = null;
let latestState = null;

function showScreen(screen) {
    [lobbyScreen, gameScreen, resultScreen].forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');
}

joinBtn.addEventListener('click', () => {
    const name = nameInput.value.trim() || 'Player';
    socket.emit('join', name);
});
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinBtn.click(); });

startBtn.addEventListener('click', () => socket.emit('startRace'));
raceAgainBtn.addEventListener('click', () => {
    socket.emit('restart');
    showScreen(lobbyScreen);
});

socket.on('connect', () => { myId = socket.id; });

socket.on('lobby', (data) => {
    const names = Object.values(data.players);
    playerListEl.innerHTML = names.length
        ? '<b>Players:</b> ' + names.map(p => `<span style="color:${p.color}">● ${p.name}</span>`).join('  ')
        : '';
    startBtn.classList.toggle('hidden', names.length < 1);
    lobbyMsg.textContent = names.length ? 'Sab ready hone par "Start Race" dabao!' : '';
    showScreen(lobbyScreen);
});

socket.on('joinRejected', (msg) => { lobbyMsg.textContent = msg; });

socket.on('state', (state) => {
    latestState = state;

    if (state.raceState === 'countdown' || state.raceState === 'racing') {
        showScreen(gameScreen);
        if (state.raceState === 'countdown') {
            countdownEl.classList.remove('hidden');
            countdownEl.textContent = state.countdownValue > 0 ? state.countdownValue : 'GO!';
        } else {
            countdownEl.classList.add('hidden');
        }
    } else if (state.raceState === 'finished') {
        showScreen(resultScreen);
        resultList.innerHTML = state.finishOrder.map((f, i) => `<li>${i + 1}. ${f.name} — ${(f.time / 1000).toFixed(2)}s</li>`).join('') || '<li>Koi finish nahi hua!</li>';
    }
});

// ===== Input handling =====
const keys = { up: false, down: false, left: false, right: false, boost: false };
function sendInput() { socket.emit('input', keys); }

window.addEventListener('keydown', (e) => { if (setKey(e.code, true)) { e.preventDefault(); sendInput(); } });
window.addEventListener('keyup', (e) => { if (setKey(e.code, false)) { e.preventDefault(); sendInput(); } });

function setKey(code, val) {
    switch (code) {
        case 'ArrowUp': case 'KeyW': keys.up = val; return true;
        case 'ArrowDown': case 'KeyS': keys.down = val; return true;
        case 'ArrowLeft': case 'KeyA': keys.left = val; return true;
        case 'ArrowRight': case 'KeyD': keys.right = val; return true;
        case 'Space': keys.boost = val; return true;
        default: return false;
    }
}

document.querySelectorAll('[data-key]').forEach(btn => {
    const k = btn.getAttribute('data-key');
    const press = (v) => { keys[k] = v; sendInput(); };
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); press(true); }, { passive: false });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); press(false); }, { passive: false });
    btn.addEventListener('mousedown', () => press(true));
    btn.addEventListener('mouseup', () => press(false));
    btn.addEventListener('mouseleave', () => press(false));
});

// ===== Rendering =====
function drawTrack(track) {
    ctx.fillStyle = '#0f2818';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(track.cx, track.cy);

    ctx.fillStyle = '#374151';
    ctx.beginPath(); ctx.ellipse(0, 0, track.rxOuter, track.ryOuter, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#166534';
    ctx.beginPath(); ctx.ellipse(0, 0, track.rxInner, track.ryInner, 0, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(0, -track.ryOuter);
    ctx.lineTo(0, -track.ryInner);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
}

function drawCar(p, isMe) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = p.boosting ? '#ffffff' : p.color;
    ctx.strokeStyle = isMe ? '#fef08a' : '#111827';
    ctx.lineWidth = isMe ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-10, 8);
    ctx.lineTo(-10, -8);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, p.x, p.y - 18);
}

function loop() {
    if (latestState && latestState.track) {
        drawTrack(latestState.track);
        Object.entries(latestState.players).forEach(([id, p]) => drawCar(p, id === myId));

        if (latestState.raceState === 'racing' && myId && latestState.players[myId]) {
            const me = latestState.players[myId];
            const lapsToWin = latestState.lapsToWin || 3;
            lapInfoEl.textContent = me.finished ? 'Finished! ✅' : `Lap ${Math.min(me.lap + 1, lapsToWin)}/${lapsToWin}`;
        }
    }
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
