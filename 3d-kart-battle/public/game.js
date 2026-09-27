import * as THREE from 'three';
import { GLTFLoader } from '/vendor/three/examples/jsm/loaders/GLTFLoader.js';

const socket = io();

const ITEM_META = {
    boost: { name: 'Nitro Boost', icon: 'rocket', desc: 'Turant speed burst kuch second ke liye.', cls: 'buff' },
    shield: { name: 'Shield', icon: 'shield', desc: 'Agla hit bilkul asar nahi karega.', cls: 'buff' },
    bomb: { name: 'Bomb Shell', icon: 'bomb', desc: 'Seedha aage fire hota hai, lagne par knock-out.', cls: 'lethal' },
    oil: { name: 'Oil Slick', icon: 'drop', desc: 'Peeche giraya jaata hai, koi ispe se guzre to spin-out.', cls: 'lethal' },
    freezeRay: { name: 'Freeze Ray', icon: 'snow', desc: 'Tez, chhoti range - lagne par turant knock-out.', cls: 'lethal' },
    homingRocket: { name: 'Homing Rocket', icon: 'missile', desc: 'Sabse paas wale opponent ko khud track karta hai.', cls: 'lethal' },
    megaRam: { name: 'Mega Ram', icon: 'expand', desc: 'Kuch der bada + takkar zyada zoardaar.', cls: 'buff' },
    shrinkRay: { name: 'Shrink Ray', icon: 'compress', desc: 'Opponent ko chhota + slow kar deta hai.', cls: 'debuff' },
    reverseRay: { name: 'Reverse Ray', icon: 'swap', desc: 'Opponent ke steering controls ulte ho jaate hain.', cls: 'debuff' },
    iceTrail: { name: 'Ice Trail', icon: 'snow', desc: 'Peeche fisalan - steering kamzor ho jaati hai.', cls: 'debuff' },
    empBlast: { name: 'EMP Blast', icon: 'burst', desc: 'Aas-paas sabke gun/item kuch der band ho jaate hain.', cls: 'debuff' },
    gravityPulse: { name: 'Gravity Pulse', icon: 'orbit', desc: 'Paas ke opponents ko apni taraf khinchta hai.', cls: 'buff' },
    teleportDash: { name: 'Teleport Dash', icon: 'portal', desc: 'Turant aage ki taraf chhalaang.', cls: 'buff' },
    ammoOverload: { name: 'Ammo Overload', icon: 'ammo', desc: 'Gun ammo full + kuch der double-fire speed.', cls: 'buff' },
    phantomCloak: { name: 'Phantom Cloak', icon: 'ghost', desc: 'Kuch der dusron ko dhundhlaa dikhoge.', cls: 'buff' }
};

// ===== DOM refs =====
const lobbyScreen = document.getElementById('lobby');
const manualScreen = document.getElementById('manualScreen');
const gameScreen = document.getElementById('gameScreen');
const resultScreen = document.getElementById('resultScreen');
const nameInput = document.getElementById('nameInput');
const setupPanel = document.getElementById('setupPanel');
const modeRaceBtn = document.getElementById('modeRaceBtn');
const modeBattleBtn = document.getElementById('modeBattleBtn');
const mapChoiceRace = document.getElementById('mapChoiceRace');
const mapChoiceBattle = document.getElementById('mapChoiceBattle');
const winConditionChoice = document.getElementById('winConditionChoice');
const quickMatchBtn = document.getElementById('quickMatchBtn');
const createRoomBtn = document.getElementById('createRoomBtn');
const codeInput = document.getElementById('codeInput');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const manualBtn = document.getElementById('manualBtn');
const manualBackBtn = document.getElementById('manualBackBtn');
const manualList = document.getElementById('manualList');
const vehicleChoice = document.getElementById('vehicleChoice');
const roomInfo = document.getElementById('roomInfo');
const roomModeLabel = document.getElementById('roomModeLabel');
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const startBtn = document.getElementById('startBtn');
const leaveLobbyBtn = document.getElementById('leaveLobbyBtn');
const playerListEl = document.getElementById('playerList');
const lobbyMsg = document.getElementById('lobbyMsg');
const countdownEl = document.getElementById('countdown');
const lapInfoEl = document.getElementById('lapInfo');
const battleTimerEl = document.getElementById('battleTimer');
const battleTargetEl = document.getElementById('battleTarget');
const ammoCountEl = document.getElementById('ammoCount');
const itemIconSvg = document.getElementById('itemIconSvg');
const itemHintEl = document.getElementById('itemHint');
const statusRowEl = document.getElementById('statusRow');
const scoreboardEl = document.getElementById('scoreboard');
const killFeedEl = document.getElementById('killFeed');
const respawnOverlay = document.getElementById('respawnOverlay');
const respawnCountdown = document.getElementById('respawnCountdown');
const hitMarkerEl = document.getElementById('hitMarker');
const fallFlashEl = document.getElementById('fallFlash');
const leaveMatchBtn = document.getElementById('leaveMatchBtn');
const resultIcon = document.getElementById('resultIcon');
const resultTitle = document.getElementById('resultTitle');
const resultSub = document.getElementById('resultSub');
const resultList = document.getElementById('resultList');
const nextRoundHint = document.getElementById('nextRoundHint');
const raceAgainBtn = document.getElementById('raceAgainBtn');
const resultLeaveBtn = document.getElementById('resultLeaveBtn');
const minimapCanvas = document.getElementById('minimap');
const mmCtx = minimapCanvas.getContext('2d');

let myId = null;
let latestState = null;
let worldBuilt = false;
let currentMode = 'race';
let selectedMapRace = 'classic';
let selectedMapBattle = 'colosseum';
let selectedWinCondition = 'time';
let selectedVehicle = 'kart';

function showScreen(screen) {
    [lobbyScreen, manualScreen, gameScreen, resultScreen].forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');
}

function iconSvg(name, cls) {
    return `<svg class="icon${cls ? ' ' + cls : ''}"><use href="#i-${name}"></use></svg>`;
}

// ===== Manual / legend =====
manualList.innerHTML = Object.values(ITEM_META).map(m =>
    `<div class="manual-item ${m.cls}">${iconSvg(m.icon)}<div><b>${m.name}</b><span>${m.desc}</span></div></div>`
).join('');
manualBtn.addEventListener('click', () => showScreen(manualScreen));
manualBackBtn.addEventListener('click', () => showScreen(lobbyScreen));

// ===== Sound (WebAudio, no external files) =====
let audioCtx = null;
function ensureAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
function beep(freq, duration, type = 'sine', gain = 0.15, delay = 0) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g); g.connect(audioCtx.destination);
    const t0 = audioCtx.currentTime + delay;
    osc.start(t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.stop(t0 + duration + 0.02);
}
const sfx = {
    pickup: () => beep(880, 0.12, 'square', 0.12),
    boost: () => { beep(220, 0.25, 'sawtooth', 0.15); beep(440, 0.2, 'sawtooth', 0.1, 0.05); },
    hit: () => beep(90, 0.3, 'square', 0.2),
    kill: () => { beep(660, 0.1, 'square', 0.14); beep(990, 0.14, 'square', 0.12, 0.08); },
    shoot: () => beep(660, 0.05, 'square', 0.05),
    empty: () => beep(120, 0.08, 'square', 0.08),
    tick: () => beep(523, 0.15, 'sine', 0.15),
    go: () => beep(880, 0.35, 'sine', 0.2),
    win: () => { beep(523, 0.15, 'sine', 0.16); beep(659, 0.15, 'sine', 0.16, 0.15); beep(784, 0.15, 'sine', 0.16, 0.3); beep(1046, 0.3, 'sine', 0.18, 0.45); },
    lose: () => { beep(330, 0.25, 'sawtooth', 0.14); beep(220, 0.4, 'sawtooth', 0.14, 0.2); }
};

// ===== Setup panel =====
function setMode(mode) {
    currentMode = mode;
    modeRaceBtn.classList.toggle('active', mode === 'race');
    modeBattleBtn.classList.toggle('active', mode === 'battle');
    mapChoiceRace.classList.toggle('hidden', mode !== 'race');
    mapChoiceBattle.classList.toggle('hidden', mode !== 'battle');
    winConditionChoice.classList.toggle('hidden', mode !== 'battle');
}
modeRaceBtn.addEventListener('click', () => setMode('race'));
modeBattleBtn.addEventListener('click', () => setMode('battle'));

mapChoiceRace.querySelectorAll('.choice-btn').forEach(btn => btn.addEventListener('click', () => {
    mapChoiceRace.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMapRace = btn.dataset.map;
}));
mapChoiceBattle.querySelectorAll('.choice-btn').forEach(btn => btn.addEventListener('click', () => {
    mapChoiceBattle.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMapBattle = btn.dataset.map;
}));
winConditionChoice.querySelectorAll('.choice-btn').forEach(btn => btn.addEventListener('click', () => {
    winConditionChoice.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedWinCondition = btn.dataset.win;
}));
vehicleChoice.querySelectorAll('.choice-btn').forEach(btn => btn.addEventListener('click', () => {
    vehicleChoice.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedVehicle = btn.dataset.vehicle;
}));

createRoomBtn.addEventListener('click', () => {
    ensureAudio();
    socket.emit('createRoom', {
        name: nameInput.value.trim() || 'Player',
        mapId: currentMode === 'race' ? selectedMapRace : selectedMapBattle,
        winCondition: selectedWinCondition,
        vehicle: selectedVehicle
    });
});
quickMatchBtn.addEventListener('click', () => {
    ensureAudio();
    lobbyMsg.textContent = 'Match dhoond rahe hain...';
    socket.emit('quickMatch', { name: nameInput.value.trim() || 'Player', mode: currentMode, vehicle: selectedVehicle });
});
joinRoomBtn.addEventListener('click', () => {
    ensureAudio();
    const code = codeInput.value.trim().toUpperCase();
    if (!code) { lobbyMsg.textContent = 'Room code daalo!'; return; }
    socket.emit('joinRoom', { name: nameInput.value.trim() || 'Player', code, vehicle: selectedVehicle });
});
codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoomBtn.click(); });
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') createRoomBtn.click(); });

startBtn.addEventListener('click', () => socket.emit('startRace'));

function backToSetup() {
    socket.emit('leaveRoom');
    setupPanel.classList.remove('hidden');
    roomInfo.classList.add('hidden');
    worldBuilt = false;
    latestState = null;
    showScreen(lobbyScreen);
}
leaveLobbyBtn.addEventListener('click', backToSetup);
leaveMatchBtn.addEventListener('click', backToSetup);
resultLeaveBtn.addEventListener('click', backToSetup);

raceAgainBtn.addEventListener('click', () => {
    socket.emit('restart');
    setupPanel.classList.add('hidden');
    roomInfo.classList.remove('hidden');
    showScreen(lobbyScreen);
});

socket.on('connect', () => { myId = socket.id; });

socket.on('roomJoined', ({ code, mode }) => {
    setupPanel.classList.add('hidden');
    roomInfo.classList.remove('hidden');
    roomCodeDisplay.textContent = code;
    roomModeLabel.innerHTML = mode === 'battle'
        ? iconSvg('sword') + ' Battle Arena Room Code — dosto ko bhejo:'
        : iconSvg('flag') + ' Racing Room Code — dosto ko bhejo:';
    lobbyMsg.textContent = '';
});

socket.on('lobby', (data) => {
    const names = Object.values(data.players);
    playerListEl.innerHTML = names.length
        ? '<b>Players (' + names.length + '):</b> ' + names.map(p => `<span style="color:${p.color}">&#9679; ${p.name}</span>`).join('  ')
        : '';
    startBtn.classList.toggle('hidden', names.length < 1);
    startBtn.textContent = data.mode === 'battle' ? 'Start Battle' : 'Start Race';
    lobbyMsg.textContent = names.length ? 'Sab ready hone par dabao!' : '';
    showScreen(lobbyScreen);
});

socket.on('joinRejected', (msg) => { lobbyMsg.textContent = msg; });

let prevCountdown = null;
let prevRaceState = null;
let prevMyScore = 0;
let prevAlive = true;
let prevAmmo = null;

socket.on('state', (state) => {
    if (!worldBuilt) { buildWorld(state); worldBuilt = true; }
    const prevPlayer = latestState && myId ? latestState.players[myId] : null;
    const newPlayer = state.players[myId];
    const isBattle = state.mode === 'battle';

    lapInfoEl.classList.toggle('hidden', isBattle);
    battleTimerEl.classList.toggle('hidden', !isBattle || state.winCondition !== 'time');
    battleTargetEl.classList.toggle('hidden', !isBattle || state.winCondition !== 'score');
    scoreboardEl.classList.toggle('hidden', !isBattle);

    if (state.raceState === 'countdown' || state.raceState === 'racing') {
        showScreen(gameScreen);
        if (state.raceState === 'countdown') {
            countdownEl.classList.remove('hidden');
            countdownEl.textContent = state.countdownValue > 0 ? state.countdownValue : 'GO';
            if (state.countdownValue !== prevCountdown) {
                if (state.countdownValue > 0) sfx.tick(); else sfx.go();
            }
        } else {
            countdownEl.classList.add('hidden');
        }
    } else if (state.raceState === 'finished') {
        if (prevRaceState !== 'finished') {
            const iWon = isBattle ? state.winnerId === myId : (state.finishOrder[0] && state.finishOrder[0].id === myId);
            if (iWon) { sfx.win(); spawnConfetti(state); } else sfx.lose();
        }
        showScreen(resultScreen);
        renderResults(state, isBattle);
    }
    prevCountdown = state.countdownValue;
    prevRaceState = state.raceState;

    if (newPlayer) {
        if (prevPlayer && !prevPlayer.heldItem && newPlayer.heldItem) sfx.pickup();
        if (prevPlayer && !prevPlayer.boosting && newPlayer.boosting) sfx.boost();
        if (prevPlayer && prevPlayer.fellAt !== newPlayer.fellAt && newPlayer.fellAt) flashFall();
        if (prevAmmo !== null && prevAmmo > 0 && newPlayer.ammo === 0) sfx.empty();
        prevAmmo = newPlayer.ammo;

        if (isBattle) {
            if (prevPlayer && !prevPlayer.stunned && newPlayer.stunned) sfx.hit();
            if (prevAlive && newPlayer.alive === false) { sfx.hit(); flashFall(); }
            prevAlive = newPlayer.alive;
            if (newPlayer.score > prevMyScore) { sfx.kill(); showHitMarker(); }
            prevMyScore = newPlayer.score;

            respawnOverlay.classList.toggle('hidden', newPlayer.alive !== false);
            if (newPlayer.alive === false) {
                const remain = Math.max(0, Math.ceil((newPlayer.respawnAt - state.now) / 1000));
                respawnCountdown.textContent = remain;
            }
        } else {
            if (prevPlayer && !prevPlayer.stunned && newPlayer.stunned) sfx.hit();
        }

        const meta = ITEM_META[newPlayer.heldItem];
        itemIconSvg.innerHTML = `<use href="#i-${meta ? meta.icon : 'target'}"></use>`;
        itemHintEl.textContent = meta ? meta.name : 'No item';
        ammoCountEl.textContent = newPlayer.ammo;

        renderStatusRow(newPlayer);

        if (!isBattle) {
            const lapsToWin = state.lapsToWin || 3;
            lapInfoEl.textContent = newPlayer.finished ? 'Finished' : `Lap ${Math.min(newPlayer.lap + 1, lapsToWin)}/${lapsToWin}`;
        }
    }

    if (isBattle) {
        if (state.winCondition === 'time') {
            const s = Math.max(0, Math.ceil(state.timeRemainingMs / 1000));
            battleTimerEl.innerHTML = iconSvg('clock', 'icon-sm') + ` ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        } else {
            const my = newPlayer ? (newPlayer.score || 0) : 0;
            battleTargetEl.innerHTML = iconSvg('target', 'icon-sm') + ` ${my}/${state.scoreTarget}`;
        }
        renderScoreboard(state);
        renderKillFeed(state);
    }

    latestState = state;
    syncScene(state);
});

function renderStatusRow(p) {
    const badges = [];
    if (p.shielded) badges.push(['shield', false]);
    if (p.grown) badges.push(['expand', false]);
    if (p.shrunk) badges.push(['compress', true]);
    if (p.reversed) badges.push(['swap', true]);
    if (p.slipped) badges.push(['snow', true]);
    if (p.empJammed) badges.push(['burst', true]);
    if (p.pulsing) badges.push(['orbit', false]);
    if (p.stealth) badges.push(['ghost', false]);
    statusRowEl.innerHTML = badges.map(([icon, bad]) => `<div class="status-icon${bad ? ' bad' : ''}">${iconSvg(icon)}</div>`).join('');
}

function renderScoreboard(state) {
    const rows = Object.entries(state.players)
        .map(([id, p]) => ({ id, name: p.name, color: p.color, score: p.score || 0 }))
        .sort((a, b) => b.score - a.score);
    scoreboardEl.innerHTML = rows.map(r => `<span class="sb-entry"><span class="sb-dot" style="background:${r.color}"></span>${r.name}: ${r.score}</span>`).join('');
}

const WEAPON_ICON = { gun: 'gun', bomb: 'bomb', chai: 'drop', oil: 'drop', freezeRay: 'snow', homingRocket: 'missile', pit: 'compress' };
let shownKillIds = new Set();
function renderKillFeed(state) {
    (state.killFeed || []).forEach(k => {
        if (shownKillIds.has(k.id)) return;
        shownKillIds.add(k.id);
        const div = document.createElement('div');
        div.className = 'kf-entry';
        const icon = WEAPON_ICON[k.weapon] || 'burst';
        div.innerHTML = k.attacker
            ? `${k.attacker} ${iconSvg(icon)} ${k.victim}`
            : `${k.victim} ${iconSvg('compress')} gir gaya`;
        killFeedEl.appendChild(div);
        setTimeout(() => div.remove(), 4000);
    });
}

let hitMarkerTimer = null;
function showHitMarker() {
    hitMarkerEl.classList.add('hidden');
    void hitMarkerEl.offsetWidth;
    hitMarkerEl.classList.remove('hidden');
    clearTimeout(hitMarkerTimer);
    hitMarkerTimer = setTimeout(() => hitMarkerEl.classList.add('hidden'), 500);
}

function renderResults(state, isBattle) {
    const iWon = isBattle ? state.winnerId === myId : (state.finishOrder[0] && state.finishOrder[0].id === myId);
    resultTitle.textContent = iWon ? 'Congratulations! You Won' : 'Defeated';
    resultTitle.className = iWon ? 'win' : 'lose';
    resultIcon.innerHTML = `<use href="#i-${iWon ? 'trophy' : 'skull'}"></use>`;
    resultIcon.style.color = iWon ? '#fbbf24' : '#94a3b8';
    if (isBattle) {
        const winnerName = state.players[state.winnerId] ? state.players[state.winnerId].name : '?';
        resultSub.textContent = iWon ? 'Aap the strongest is arena me!' : `${winnerName} ne match jeeta.`;
        const rows = Object.entries(state.players).map(([id, p]) => ({ id, name: p.name, color: p.color, score: p.score || 0 }))
            .sort((a, b) => b.score - a.score);
        resultList.innerHTML = rows.map(r => `<li><span style="color:${r.color}">&#9679; ${r.name}</span><b>${r.score} pts</b></li>`).join('');
    } else {
        resultSub.textContent = iWon ? 'Aapne race jeet li!' : 'Agli baar zaroor jeetoge!';
        resultList.innerHTML = state.finishOrder.map((f, i) => `<li><span>${i + 1}. ${f.name}</span><b>${(f.time / 1000).toFixed(2)}s</b></li>`).join('') || '<li>Koi finish nahi hua!</li>';
    }
    const secs = Math.ceil((state.nextRoundInMs || 0) / 1000);
    nextRoundHint.textContent = secs > 0 ? `Agla round ${secs}s me shuru hoga...` : '';
}

function flashFall() {
    fallFlashEl.classList.add('show');
    setTimeout(() => fallFlashEl.classList.remove('show'), 220);
}

// ===== Input =====
const keys = { up: false, down: false, left: false, right: false, fire: false };
function sendInput() { socket.emit('input', keys); }
function useItem() { socket.emit('useItem'); }

window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE' || e.code === 'Enter') { useItem(); return; }
    if (setKey(e.code, true)) { e.preventDefault(); if (e.code === 'Space' && !e.repeat) sfx.shoot(); sendInput(); }
});
window.addEventListener('keyup', (e) => { if (setKey(e.code, false)) { e.preventDefault(); sendInput(); } });

function setKey(code, val) {
    switch (code) {
        case 'ArrowUp': case 'KeyW': keys.up = val; return true;
        case 'ArrowDown': case 'KeyS': keys.down = val; return true;
        case 'ArrowLeft': case 'KeyA': keys.left = val; return true;
        case 'ArrowRight': case 'KeyD': keys.right = val; return true;
        case 'Space': keys.fire = val; return true;
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
const useItemTouch = document.getElementById('useItemTouch');
useItemTouch.addEventListener('touchstart', (e) => { e.preventDefault(); useItem(); }, { passive: false });
useItemTouch.addEventListener('click', () => useItem());
const fireTouch = document.getElementById('fireTouch');
fireTouch.addEventListener('touchstart', (e) => { e.preventDefault(); keys.fire = true; sendInput(); }, { passive: false });
fireTouch.addEventListener('touchend', (e) => { e.preventDefault(); keys.fire = false; sendInput(); }, { passive: false });
fireTouch.addEventListener('mousedown', () => { keys.fire = true; sendInput(); });
fireTouch.addEventListener('mouseup', () => { keys.fire = false; sendInput(); });

// ===== Three.js scene =====
const canvas = document.getElementById('gl');
const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.6 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 600);
camera.position.set(0, 12, 20);

const hemi = new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 1.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(60, 90, 30);
scene.add(sun);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

let mapBounds = null;
let mapTheme = null;

function ellipsePoint(rx, rz, angle) { return { x: mapBounds.cx + rx * Math.cos(angle), z: mapBounds.cz + rz * Math.sin(angle) }; }

function buildWorld(state) {
    mapBounds = state.map.bounds;
    mapTheme = state.map.theme;
    const b = mapBounds, th = mapTheme;

    scene.background = new THREE.Color(th.sky);
    scene.fog = new THREE.Fog(th.sky, 90, 320);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: th.ground }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    scene.add(ground);

    const innerRatio = b.rxInner / b.rxOuter;
    const ring = new THREE.Mesh(new THREE.RingGeometry(innerRatio, 1, 72, 1), new THREE.MeshStandardMaterial({ color: 0x5b6472, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.scale.set(b.rxOuter, b.rzOuter, 1);
    scene.add(ring);

    const hazard = new THREE.Mesh(new THREE.CircleGeometry(1, 56), new THREE.MeshStandardMaterial({ color: th.hazard }));
    hazard.rotation.x = -Math.PI / 2;
    hazard.position.y = 0.001;
    hazard.scale.set(b.rxInner, b.rzInner, 1);
    scene.add(hazard);

    if (state.mode === 'race') {
        const startZ = b.cz - (b.rzOuter + b.rzInner) / 2;
        const line = new THREE.Mesh(new THREE.PlaneGeometry(1.4, b.rzOuter - b.rzInner), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        line.rotation.x = -Math.PI / 2;
        line.position.set(b.cx, 0.02, startZ);
        scene.add(line);
        buildStartArch(b.cx, startZ, b.rzOuter - b.rzInner);
    }

    const wallSegs = 56;
    for (let i = 0; i < wallSegs; i++) {
        const a1 = (i / wallSegs) * Math.PI * 2;
        const p1 = ellipsePoint(b.rxOuter, b.rzOuter, a1);
        const a2 = ((i + 1) / wallSegs) * Math.PI * 2;
        const p2 = ellipsePoint(b.rxOuter, b.rzOuter, a2);
        const midX = (p1.x + p2.x) / 2, midZ = (p1.z + p2.z) / 2;
        const segLen = Math.hypot(p2.x - p1.x, p2.z - p1.z) * 1.08;
        const wall = new THREE.Mesh(new THREE.BoxGeometry(segLen, 1.6, 0.7), new THREE.MeshStandardMaterial({ color: th.wallColors[i % 2] }));
        wall.position.set(midX, 0.8, midZ);
        wall.rotation.y = -Math.atan2(p2.z - p1.z, p2.x - p1.x);
        scene.add(wall);
    }

    (state.obstacles || []).forEach(ob => {
        const drum = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(ob.radius, ob.radius, 1.8, 16), new THREE.MeshStandardMaterial({ color: 0xf97316 }));
        body.position.y = 0.9;
        drum.add(body);
        for (let s = 0; s < 2; s++) {
            const stripe = new THREE.Mesh(new THREE.CylinderGeometry(ob.radius * 1.01, ob.radius * 1.01, 0.3, 16), new THREE.MeshStandardMaterial({ color: 0xffffff }));
            stripe.position.y = 0.5 + s * 0.7;
            drum.add(stripe);
        }
        drum.position.set(ob.x, 0, ob.z);
        scene.add(drum);
    });

    boostPadMeshes = (state.boostPads || []).map(pad => {
        const m = new THREE.Mesh(new THREE.CircleGeometry(pad.radius, 24), new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0891b2, transparent: true, opacity: 0.85 }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(pad.x, 0.03, pad.z);
        scene.add(m);
        return m;
    });

    (state.ramps || []).forEach(ramp => {
        const g = new THREE.Group();
        const rampMat = new THREE.MeshStandardMaterial({ color: 0xfacc15 });
        const slab = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.5, 6), rampMat);
        slab.rotation.x = -0.45;
        slab.position.set(0, 1.1, 0);
        g.add(slab);
        for (let s = -1; s <= 1; s += 2) {
            const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 6), new THREE.MeshStandardMaterial({ color: 0x1f2937 }));
            stripe.rotation.x = -0.45;
            stripe.position.set(s * 1.6, 1.12, 0);
            g.add(stripe);
        }
        g.position.set(ramp.x, 0, ramp.z);
        g.rotation.y = -ramp.heading + Math.PI / 2;
        scene.add(g);
    });

    buildScenery(b, th);
}

function buildStartArch(x, z, span) {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1f2937 });
    const poleGeo = new THREE.CylinderGeometry(0.4, 0.4, 8, 10);
    [-1, 1].forEach(side => {
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(x + side * (span / 2 + 1), 4, z);
        scene.add(pole);
    });
    const checkerCanvas = document.createElement('canvas');
    checkerCanvas.width = 128; checkerCanvas.height = 16;
    const cctx = checkerCanvas.getContext('2d');
    for (let i = 0; i < 8; i++) { cctx.fillStyle = i % 2 === 0 ? '#111' : '#fff'; cctx.fillRect(i * 16, 0, 16, 16); }
    const checkerTex = new THREE.CanvasTexture(checkerCanvas);
    checkerTex.wrapS = THREE.RepeatWrapping;
    checkerTex.repeat.set(3, 1);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(span + 3, 1.2, 1), new THREE.MeshBasicMaterial({ map: checkerTex }));
    beam.position.set(x, 8, z);
    scene.add(beam);
}

function makeFlag(color) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6), new THREE.MeshStandardMaterial({ color: 0x374151 }));
    pole.position.y = 1.1;
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide }));
    cloth.position.set(0.5, 1.9, 0);
    const g = new THREE.Group();
    g.add(pole); g.add(cloth);
    return g;
}

function makeCactus() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x2f855a });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 2.2, 8), mat);
    trunk.position.y = 1.1;
    g.add(trunk);
    [[-0.4, 1.2, 0.4], [0.45, 1.6, -0.2]].forEach(([x, y, r]) => {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.9, 6), mat);
        arm.position.set(x, y, 0);
        arm.rotation.z = r;
        g.add(arm);
    });
    return g;
}

function makeGrandstand(color) {
    const g = new THREE.Group();
    for (let tier = 0; tier < 3; tier++) {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, 1.4), new THREE.MeshStandardMaterial({ color: tier % 2 === 0 ? color : 0x4b5563 }));
        seat.position.set(0, 0.6 + tier * 1.1, -tier * 0.8);
        g.add(seat);
    }
    return g;
}

const FLAG_COLORS = [0xef4444, 0xf59e0b, 0x22c55e, 0x3b82f6, 0xa855f7, 0xeab308];

function buildScenery(b, th) {
    const flagCount = 24;
    for (let i = 0; i < flagCount; i++) {
        const a = (i / flagCount) * Math.PI * 2;
        const p = ellipsePoint(b.rxOuter + 2.5, b.rzOuter + 2.5, a);
        const flag = makeFlag(FLAG_COLORS[i % FLAG_COLORS.length]);
        flag.position.set(p.x, 0, p.z);
        flag.rotation.y = -a;
        scene.add(flag);
    }

    if (th.decor === 'stands') {
        for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            const p = ellipsePoint(b.rxOuter * 1.25, b.rzOuter * 1.25, a);
            const stand = makeGrandstand(FLAG_COLORS[i % FLAG_COLORS.length]);
            stand.position.set(p.x, 0, p.z);
            stand.rotation.y = -a + Math.PI;
            scene.add(stand);
        }
    } else {
        for (let i = 0; i < 26; i++) {
            const a = Math.random() * Math.PI * 2;
            const distMult = 1.35 + Math.random() * 0.5;
            const p = ellipsePoint(b.rxOuter * distMult, b.rzOuter * distMult, a);
            let deco;
            if (th.decor === 'cacti') {
                deco = makeCactus();
            } else {
                deco = new THREE.Group();
                const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0x7c4a1e }));
                trunk.position.y = 0.8;
                const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.6, 8), new THREE.MeshStandardMaterial({ color: [0x22c55e, 0x16a34a, 0x15803d][i % 3] }));
                leaves.position.y = 2.4;
                deco.add(trunk); deco.add(leaves);
            }
            deco.position.set(p.x, 0, p.z);
            deco.scale.setScalar(0.8 + Math.random() * 0.6);
            scene.add(deco);
        }
    }

    for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + 0.2;
        const p = ellipsePoint(b.rxOuter * 2.2, b.rzOuter * 2.2, a);
        const mountain = new THREE.Mesh(new THREE.ConeGeometry(10 + Math.random() * 8, 18 + Math.random() * 10, 6), new THREE.MeshStandardMaterial({ color: th.mountain }));
        mountain.position.set(p.x, 8, p.z);
        scene.add(mountain);
    }
}

function makeNameSprite(text) {
    const canvasEl = document.createElement('canvas');
    canvasEl.width = 256; canvasEl.height = 64;
    const ctx = canvasEl.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 34);
    const tex = new THREE.CanvasTexture(canvasEl);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    sprite.scale.set(2.6, 0.65, 1);
    sprite.position.set(0, 1.9, 0);
    return sprite;
}

// pulls the top-front vertices of a box back toward the centre, turning it into a
// forward-sloping wedge (a proper car hood/nose instead of a flat box)
function makeWedgeGeometry(width, height, depth, slopeFraction) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i), z = pos.getZ(i);
        if (y > 0 && z > 0) pos.setZ(i, z * slopeFraction);
    }
    geo.computeVertexNormals();
    return geo;
}

// ===== Open-source vehicle models (loaded once, cloned per kart) =====
// toycar.glb - Toy Car by Guido Odendahl, public domain (CC0)
// milktruck.glb - Cesium Milk Truck, donated by Cesium for glTF testing, CC-BY 4.0
const VEHICLE_DEFS = {
    // targetLength: the desired real-world Z-size (forward axis) in game units, used to
    // auto-derive a scale factor once the model's actual mesh size is known.
    toycar: { url: '/models/toycar.glb', hideMeshes: ['Fabric'], targetLength: 3.2, yaw: 0, flameZ: -1.6, flameY: 0.25 },
    milktruck: { url: '/models/milktruck.glb', hideMeshes: [], targetLength: 3.6, yaw: 0, flameZ: -1.9, flameY: 0.5 }
};
const vehicleTemplates = {};
const gltfLoader = new GLTFLoader();
Object.entries(VEHICLE_DEFS).forEach(([id, def]) => {
    gltfLoader.load(def.url, (gltf) => {
        // strip any decorative meshes (e.g. a photo-studio rug) that shouldn't render in-game
        const toRemove = [];
        gltf.scene.traverse(o => { if (o.isMesh && def.hideMeshes.includes(o.name)) toRemove.push(o); });
        toRemove.forEach(o => o.parent.remove(o));

        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = new THREE.Vector3();
        box.getSize(size);
        def.scale = def.targetLength / size.z;
        def.liftY = -box.min.y * def.scale;
        def.centerX = -((box.min.x + box.max.x) / 2) * def.scale;
        def.centerZ = -((box.min.z + box.max.z) / 2) * def.scale;
        vehicleTemplates[id] = gltf.scene;
    }, undefined, (err) => console.error('Vehicle model failed to load:', id, err));
});

function createKart(color, name, vehicleId) {
    const group = new THREE.Group();
    const template = vehicleId && vehicleId !== 'kart' ? vehicleTemplates[vehicleId] : null;

    if (template) {
        const def = VEHICLE_DEFS[vehicleId];
        const materials = [];
        const model = template.clone(true);
        model.traverse(o => {
            if (o.isMesh && o.material) {
                o.material = o.material.clone();
                o.material.transparent = true;
                materials.push(o.material);
            }
        });
        const wrapper = new THREE.Group();
        model.scale.setScalar(def.scale);
        model.position.set(def.centerX, def.liftY, def.centerZ);
        model.rotation.y = def.yaw;
        wrapper.add(model);
        group.add(wrapper);

        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.9, 8), new THREE.MeshBasicMaterial({ color: 0xff8c00, transparent: true, opacity: 1 }));
        flame.rotation.x = Math.PI / 2;
        flame.position.set(0, def.flameY, def.flameZ);
        flame.scale.set(0.001, 0.001, 0.001);
        group.add(flame);

        const shieldBubble = new THREE.Mesh(new THREE.SphereGeometry(2.1, 16, 12), new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.25, wireframe: true }));
        shieldBubble.position.y = 0.9;
        shieldBubble.visible = false;
        group.add(shieldBubble);

        const nameSprite = makeNameSprite(name);
        nameSprite.position.y = 2.3;
        group.add(nameSprite);

        scene.add(group);
        return { group, body: wrapper, wheels: [], flame, shieldBubble, nameSprite, materials, lastAngle: 0, lastFellAt: 0, lastY: 0 };
    }

    const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.25, roughness: 0.5, transparent: true, opacity: 1 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, transparent: true, opacity: 1 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, transparent: true, opacity: 0.6 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.4, 2.0), bodyMat);
    chassis.position.set(0, 0.32, -0.5);
    group.add(chassis);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.35, 0.9), bodyMat);
    cabin.position.set(0, 0.62, 0.15);
    group.add(cabin);

    const hood = new THREE.Mesh(makeWedgeGeometry(1.5, 0.55, 1.5, 0.08), bodyMat);
    hood.position.set(0, 0.35, 1.15);
    group.add(hood);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.42, 0.08), glassMat);
    windshield.position.set(0, 0.82, 0.62);
    windshield.rotation.x = -0.55;
    group.add(windshield);

    const bumperF = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.28, 0.25), darkMat);
    bumperF.position.set(0, 0.24, 1.82);
    group.add(bumperF);
    const bumperR = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.28, 0.22), darkMat);
    bumperR.position.set(0, 0.28, -1.55);
    group.add(bumperR);

    const spoilerStand = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 0.12), darkMat);
    spoilerStand.position.set(0, 0.75, -1.35);
    group.add(spoilerStand);
    const spoilerWing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.5), bodyMat);
    spoilerWing.position.set(0, 1.0, -1.35);
    group.add(spoilerWing);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.5), darkMat);
    torso.position.set(0, 0.95, 0.3);
    group.add(torso);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), new THREE.MeshStandardMaterial({ color: 0xffe4b5, transparent: true, opacity: 1 }));
    helmet.position.set(0, 1.32, 0.35);
    group.add(helmet);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.2), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3, transparent: true, opacity: 1 }));
    visor.position.set(0, 1.34, 0.55);
    group.add(visor);

    const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.1, 8), darkMat);
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.set(0, 0.65, 1.9);
    group.add(gunBarrel);

    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.34, 14);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, transparent: true, opacity: 1 });
    const rimGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.36, 10);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.6, roughness: 0.3, transparent: true, opacity: 1 });
    const wheels = [];
    [[-0.95, 0.38, 1.0], [0.95, 0.38, 1.0], [-0.95, 0.38, -1.0], [0.95, 0.38, -1.0]].forEach(([x, y, z]) => {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.x = Math.PI / 2;
        w.position.set(x, y, z);
        const rim = new THREE.Mesh(rimGeo, rimMat);
        rim.rotation.x = Math.PI / 2;
        w.add(rim);
        group.add(w);
        wheels.push(w);
    });

    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.9, 8), new THREE.MeshBasicMaterial({ color: 0xff8c00, transparent: true, opacity: 1 }));
    flame.rotation.x = Math.PI / 2;
    flame.position.set(0, 0.4, -1.9);
    flame.scale.set(0.001, 0.001, 0.001);
    group.add(flame);

    const shieldBubble = new THREE.Mesh(new THREE.SphereGeometry(1.9, 16, 12), new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.25, wireframe: true }));
    shieldBubble.position.y = 0.7;
    shieldBubble.visible = false;
    group.add(shieldBubble);

    const nameSprite = makeNameSprite(name);
    group.add(nameSprite);

    const materials = [bodyMat, darkMat, wheelMat, rimMat];
    scene.add(group);
    return { group, body: chassis, wheels, flame, shieldBubble, nameSprite, materials, lastAngle: 0, lastFellAt: 0, lastY: 0 };
}

const karts = new Map();
const itemBoxMeshes = new Map();
const projectileMeshes = new Map();
const hazardMeshes = new Map();
let boostPadMeshes = [];
let smashBits = [];

function spawnSmash(x, z) {
    for (let i = 0; i < 10; i++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
        m.position.set(x, 0.8, z);
        m.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 4 + 1.5, (Math.random() - 0.5) * 5);
        m.userData.life = 0.6;
        scene.add(m);
        smashBits.push(m);
    }
}

function syncScene(state) {
    const seen = new Set();
    Object.entries(state.players).forEach(([id, p]) => {
        seen.add(id);
        let k = karts.get(id);
        if (!k) { k = createKart(p.color, p.name, p.vehicle); karts.set(id, k); }
        k.target = p;
        const isDead = state.mode === 'battle' && p.alive === false;
        k.group.visible = !isDead;
    });
    for (const [id, k] of karts) { if (!seen.has(id)) { scene.remove(k.group); karts.delete(id); } }

    const seenBoxes = new Set();
    (state.itemBoxes || []).forEach(b => {
        seenBoxes.add(b.id);
        let m = itemBoxMeshes.get(b.id);
        if (!m) {
            m = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0x554400 }));
            m.position.set(b.x, 0.8, b.z);
            m.userData.lastSmash = 0;
            scene.add(m);
            itemBoxMeshes.set(b.id, m);
        }
        if (b.smashedAt && b.smashedAt !== m.userData.lastSmash) {
            m.userData.lastSmash = b.smashedAt;
            spawnSmash(b.x, b.z);
        }
        m.visible = b.available;
    });
    for (const [id, m] of itemBoxMeshes) { if (!seenBoxes.has(id)) { scene.remove(m); itemBoxMeshes.delete(id); } }

    const seenProj = new Set();
    (state.projectiles || []).forEach(pr => {
        seenProj.add(pr.id);
        let m = projectileMeshes.get(pr.id);
        if (!m) {
            const isGun = pr.itemId === '__gun';
            const color = isGun ? 0xfde047 : (pr.itemId === 'homingRocket' ? 0xf97316 : (pr.itemId === 'shrinkRay' ? 0x22c55e : (pr.itemId === 'reverseRay' ? 0xa855f7 : (pr.itemId === 'freezeRay' ? 0x60a5fa : 0xdc2626))));
            m = new THREE.Mesh(new THREE.SphereGeometry(isGun ? 0.22 : 0.4, 10, 8), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4 }));
            scene.add(m);
            projectileMeshes.set(pr.id, m);
        }
        m.position.set(pr.x, 0.6, pr.z);
    });
    for (const [id, m] of projectileMeshes) { if (!seenProj.has(id)) { scene.remove(m); projectileMeshes.delete(id); } }

    const seenHz = new Set();
    (state.hazards || []).forEach(hz => {
        seenHz.add(hz.id);
        let m = hazardMeshes.get(hz.id);
        if (!m) {
            const color = hz.itemId === 'iceTrail' ? 0x93c5fd : 0x92400e;
            m = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.06, 20), new THREE.MeshStandardMaterial({ color }));
            scene.add(m);
            hazardMeshes.set(hz.id, m);
        }
        m.position.set(hz.x, 0.03, hz.z);
    });
    for (const [id, m] of hazardMeshes) { if (!seenHz.has(id)) { scene.remove(m); hazardMeshes.delete(id); } }
}

// ===== Confetti (win celebration) =====
let confetti = [];
function spawnConfetti(state) {
    const colors = [0xef4444, 0x3b82f6, 0x22c55e, 0xf59e0b, 0xa855f7, 0xeab308];
    const spawnZ = state.mode === 'race' ? mapBounds.cz - (mapBounds.rzOuter + mapBounds.rzInner) / 2 : mapBounds.cz;
    for (let i = 0; i < 80; i++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), new THREE.MeshBasicMaterial({ color: colors[i % colors.length] }));
        m.position.set(0, 6 + Math.random() * 4, spawnZ);
        m.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 4 + 2, (Math.random() - 0.5) * 6);
        m.userData.life = 2.5;
        scene.add(m);
        confetti.push(m);
    }
}
function updateParticles(list, dt, gravity) {
    return list.filter(m => {
        m.userData.life -= dt;
        m.userData.vel.y -= gravity * dt;
        m.position.addScaledVector(m.userData.vel, dt);
        m.rotation.x += dt * 6; m.rotation.y += dt * 6;
        if (m.userData.life <= 0) { scene.remove(m); return false; }
        return true;
    });
}

// ===== Minimap =====
function drawMinimap() {
    const dpr = window.devicePixelRatio || 1;
    const w = minimapCanvas.width = 150 * dpr;
    const h = minimapCanvas.height = 110 * dpr;
    mmCtx.clearRect(0, 0, w, h);
    if (!mapBounds || !latestState) return;
    const pad = 10 * dpr;
    const s = Math.min((w - pad * 2) / (mapBounds.rxOuter * 2), (h - pad * 2) / (mapBounds.rzOuter * 2));
    const cx = w / 2, cz = h / 2;

    mmCtx.strokeStyle = 'rgba(255,255,255,0.6)';
    mmCtx.lineWidth = 2;
    mmCtx.beginPath(); mmCtx.ellipse(cx, cz, mapBounds.rxOuter * s, mapBounds.rzOuter * s, 0, 0, Math.PI * 2); mmCtx.stroke();
    mmCtx.beginPath(); mmCtx.ellipse(cx, cz, mapBounds.rxInner * s, mapBounds.rzInner * s, 0, 0, Math.PI * 2); mmCtx.stroke();

    Object.entries(latestState.players).forEach(([id, p]) => {
        if (latestState.mode === 'battle' && p.alive === false) return;
        if (p.stealth && id !== myId) return;
        mmCtx.fillStyle = p.color;
        mmCtx.beginPath();
        mmCtx.arc(cx + p.x * s, cz + p.z * s, id === myId ? 5 : 3.5, 0, Math.PI * 2);
        mmCtx.fill();
        if (id === myId) { mmCtx.strokeStyle = '#fff'; mmCtx.lineWidth = 1.5; mmCtx.stroke(); }
    });
}

// ===== Render loop =====
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);
    const time = clock.getElapsedTime();

    for (const [id, k] of karts) {
        const t = k.target;
        if (!t || !k.group.visible) continue;
        const smooth = 1 - Math.exp(-14 * dt);

        if (t.stunned) {
            k.group.rotation.y += dt * 12;
        } else {
            k.group.position.x += (t.x - k.group.position.x) * smooth;
            k.group.position.z += (t.z - k.group.position.z) * smooth;
            let da = t.angle - k.lastAngle;
            while (da > Math.PI) da -= Math.PI * 2;
            while (da < -Math.PI) da += Math.PI * 2;
            k.lastAngle += da * smooth;
            k.group.rotation.y = -k.lastAngle + Math.PI / 2;

            const angVel = da / Math.max(dt, 0.001);
            const targetTilt = THREE.MathUtils.clamp(-angVel * 0.03, -0.35, 0.35);
            k.body.rotation.z += (targetTilt - k.body.rotation.z) * smooth;
        }
        k.lastY += ((t.y || 0) - k.lastY) * (1 - Math.exp(-20 * dt));
        k.group.position.y = k.lastY;
        k.group.rotation.x = -Math.max(0, k.lastY) * 0.04;

        k.wheels.forEach(w => w.rotation.y += t.speed * dt * 0.6);

        const flameTarget = t.boosting ? 1 : 0.001;
        k.flame.scale.x += (flameTarget - k.flame.scale.x) * smooth;
        k.flame.scale.y += (flameTarget - k.flame.scale.y) * smooth;
        k.flame.scale.z += (flameTarget - k.flame.scale.z) * smooth;

        k.shieldBubble.visible = !!t.shielded;
        if (t.shielded) k.shieldBubble.rotation.y += dt * 2;

        const sizeTarget = t.grown ? 1.35 : (t.shrunk ? 0.62 : 1);
        if (t.fellAt && t.fellAt !== k.lastFellAt) { k.lastFellAt = t.fellAt; k.group.scale.set(0.3, 0.3, 0.3); }
        else {
            k.group.scale.x += (sizeTarget - k.group.scale.x) * Math.min(1, dt * 6);
            k.group.scale.y += (sizeTarget - k.group.scale.y) * Math.min(1, dt * 6);
            k.group.scale.z += (sizeTarget - k.group.scale.z) * Math.min(1, dt * 6);
        }

        const stealthed = t.stealth && id !== myId;
        const targetOpacity = stealthed ? 0.22 : 1;
        k.materials.forEach(m => { m.opacity += (targetOpacity - m.opacity) * smooth; });
        k.nameSprite.visible = !stealthed;
    }

    itemBoxMeshes.forEach(m => { m.rotation.y += dt * 1.6; });
    projectileMeshes.forEach(m => { m.rotation.x += dt * 8; });
    boostPadMeshes.forEach((m, i) => { m.material.opacity = 0.75 + Math.sin(time * 4 + i) * 0.2; });

    const me = karts.get(myId);
    if (me && me.group.visible) {
        const dist = 10, height = 5.4;
        const behindX = me.group.position.x - Math.cos(me.lastAngle) * dist;
        const behindZ = me.group.position.z - Math.sin(me.lastAngle) * dist;
        const camSmooth = 1 - Math.exp(-6 * dt);
        camera.position.x += (behindX - camera.position.x) * camSmooth;
        camera.position.z += (behindZ - camera.position.z) * camSmooth;
        camera.position.y += (height + me.lastY * 0.6 - camera.position.y) * camSmooth;
        camera.lookAt(
            me.group.position.x + Math.cos(me.lastAngle) * 6,
            0.2 + me.lastY * 0.5,
            me.group.position.z + Math.sin(me.lastAngle) * 6
        );
    }

    confetti = updateParticles(confetti, dt, 9.8);
    smashBits = updateParticles(smashBits, dt, 9.8);
    drawMinimap();
    renderer.render(scene, camera);
}
animate();
