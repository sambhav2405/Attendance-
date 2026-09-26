import * as THREE from 'three';

const socket = io();

// ===== DOM refs =====
const lobbyScreen = document.getElementById('lobby');
const gameScreen = document.getElementById('gameScreen');
const resultScreen = document.getElementById('resultScreen');
const nameInput = document.getElementById('nameInput');
const joinBtn = document.getElementById('joinBtn');
const startBtn = document.getElementById('startBtn');
const playerListEl = document.getElementById('playerList');
const lobbyMsg = document.getElementById('lobbyMsg');
const countdownEl = document.getElementById('countdown');
const lapInfoEl = document.getElementById('lapInfo');
const itemIconEl = document.getElementById('itemIcon');
const itemHintEl = document.getElementById('itemHint');
const fallFlashEl = document.getElementById('fallFlash');
const resultList = document.getElementById('resultList');
const raceAgainBtn = document.getElementById('raceAgainBtn');
const minimapCanvas = document.getElementById('minimap');
const mmCtx = minimapCanvas.getContext('2d');

const ITEM_META = {
    boost: { icon: '🚀', label: 'Boost - E dabao!' },
    shell: { icon: '💣', label: 'Ladoo Bomb - E dabao!' },
    oil: { icon: '🫖', label: 'Chai Spill - E dabao!' }
};

let myId = null;
let latestState = null;
let joined = false;
let trackBuilt = false;

function showScreen(screen) {
    [lobbyScreen, gameScreen, resultScreen].forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');
}

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
    tick: () => beep(523, 0.15, 'sine', 0.15),
    go: () => beep(880, 0.35, 'sine', 0.2),
    finish: () => { beep(523, 0.15, 'sine', 0.15); beep(659, 0.15, 'sine', 0.15, 0.15); beep(784, 0.3, 'sine', 0.15, 0.3); }
};

// ===== Lobby / socket flow =====
joinBtn.addEventListener('click', () => {
    ensureAudio();
    const name = nameInput.value.trim() || 'Player';
    socket.emit('join', name);
});
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinBtn.click(); });

startBtn.addEventListener('click', () => socket.emit('startRace'));
raceAgainBtn.addEventListener('click', () => { socket.emit('restart'); showScreen(lobbyScreen); });

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

let prevCountdown = null;
let prevRaceState = null;

socket.on('state', (state) => {
    if (!trackBuilt) { buildTrack(state.track); trackBuilt = true; }
    const prevPlayer = latestState && myId ? latestState.players[myId] : null;
    const newPlayer = state.players[myId];

    if (state.raceState === 'countdown' || state.raceState === 'racing') {
        showScreen(gameScreen);
        if (state.raceState === 'countdown') {
            countdownEl.classList.remove('hidden');
            countdownEl.textContent = state.countdownValue > 0 ? state.countdownValue : 'GO!';
            if (state.countdownValue !== prevCountdown) {
                if (state.countdownValue > 0) sfx.tick(); else sfx.go();
            }
        } else {
            countdownEl.classList.add('hidden');
        }
    } else if (state.raceState === 'finished') {
        if (prevRaceState !== 'finished') { sfx.finish(); spawnConfetti(); }
        showScreen(resultScreen);
        resultList.innerHTML = state.finishOrder.map((f, i) => `<li>${i + 1}. ${f.name} — ${(f.time / 1000).toFixed(2)}s</li>`).join('') || '<li>Koi finish nahi hua!</li>';
    }
    prevCountdown = state.countdownValue;
    prevRaceState = state.raceState;

    if (newPlayer) {
        if (prevPlayer && !prevPlayer.heldItem && newPlayer.heldItem) sfx.pickup();
        if (prevPlayer && !prevPlayer.boosting && newPlayer.boosting) sfx.boost();
        if (prevPlayer && !prevPlayer.stunned && newPlayer.stunned) sfx.hit();
        if (prevPlayer && prevPlayer.fellAt !== newPlayer.fellAt && newPlayer.fellAt) flashFall();

        const meta = ITEM_META[newPlayer.heldItem];
        itemIconEl.textContent = meta ? meta.icon : '–';
        itemHintEl.textContent = meta ? meta.label : 'no item';

        const lapsToWin = state.lapsToWin || 3;
        lapInfoEl.textContent = newPlayer.finished ? 'Finished! ✅' : `Lap ${Math.min(newPlayer.lap + 1, lapsToWin)}/${lapsToWin}`;
    }

    latestState = state;
    syncScene(state);
});

function flashFall() {
    fallFlashEl.classList.add('show');
    setTimeout(() => fallFlashEl.classList.remove('show'), 220);
}

// ===== Input =====
const keys = { up: false, down: false, left: false, right: false };
function sendInput() { socket.emit('input', keys); }
function useItem() { socket.emit('useItem'); }

window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE' || e.code === 'Enter') { useItem(); return; }
    if (setKey(e.code, true)) { e.preventDefault(); sendInput(); }
});
window.addEventListener('keyup', (e) => { if (setKey(e.code, false)) { e.preventDefault(); sendInput(); } });

function setKey(code, val) {
    switch (code) {
        case 'ArrowUp': case 'KeyW': keys.up = val; return true;
        case 'ArrowDown': case 'KeyS': keys.down = val; return true;
        case 'ArrowLeft': case 'KeyA': keys.left = val; return true;
        case 'ArrowRight': case 'KeyD': keys.right = val; return true;
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

// ===== Three.js scene =====
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 60, 220);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 12, 20);

const hemi = new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(40, 60, 20);
scene.add(sun);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

let track = null;
function buildTrack(t) {
    track = t;
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(400, 400),
        new THREE.MeshStandardMaterial({ color: 0x2f7d32 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    scene.add(ground);

    const innerRatio = t.rxInner / t.rxOuter;
    const ring = new THREE.Mesh(
        new THREE.RingGeometry(innerRatio, 1, 64, 1),
        new THREE.MeshStandardMaterial({ color: 0x64748b, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.scale.set(t.rxOuter, t.rzOuter, 1);
    scene.add(ring);

    const lake = new THREE.Mesh(
        new THREE.CircleGeometry(1, 48),
        new THREE.MeshStandardMaterial({ color: 0x1d4ed8 })
    );
    lake.rotation.x = -Math.PI / 2;
    lake.position.y = 0.001;
    lake.scale.set(t.rxInner, t.rzInner, 1);
    scene.add(lake);

    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const line = new THREE.Mesh(new THREE.PlaneGeometry(1.2, (t.rzOuter - t.rzInner)), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(t.cx, 0.02, t.cz - (t.rzOuter + t.rzInner) / 2);
    scene.add(line);
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
    sprite.position.set(0, 1.8, 0);
    return sprite;
}

function createKart(color, name) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.55, 2.6),
        new THREE.MeshStandardMaterial({ color })
    );
    body.position.y = 0.55;
    group.add(body);

    const topper = new THREE.Mesh(
        new THREE.SphereGeometry(0.36, 14, 10),
        new THREE.MeshStandardMaterial({ color: 0xffe4b5 })
    );
    topper.position.set(0, 1.05, 0.35);
    group.add(topper);

    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.32, 12);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827 });
    const wheels = [];
    [[-0.95, 0.36, 0.95], [0.95, 0.36, 0.95], [-0.95, 0.36, -0.95], [0.95, 0.36, -0.95]].forEach(([x, y, z]) => {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.x = Math.PI / 2;
        w.position.set(x, y, z);
        group.add(w);
        wheels.push(w);
    });

    const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.28, 0.9, 8),
        new THREE.MeshBasicMaterial({ color: 0xff8c00 })
    );
    flame.rotation.x = Math.PI / 2;
    flame.position.set(0, 0.5, -1.6);
    flame.scale.set(0.001, 0.001, 0.001);
    group.add(flame);

    const nameSprite = makeNameSprite(name);
    group.add(nameSprite);

    scene.add(group);
    return { group, body, wheels, flame, lastAngle: 0, lastFellAt: 0 };
}

const karts = new Map(); // id -> kart visual
const itemBoxMeshes = new Map();
const projectileMeshes = new Map();
const hazardMeshes = new Map();

function syncScene(state) {
    const seen = new Set();
    Object.entries(state.players).forEach(([id, p]) => {
        seen.add(id);
        let k = karts.get(id);
        if (!k) { k = createKart(p.color, p.name); karts.set(id, k); }
        k.target = p;
    });
    for (const [id, k] of karts) {
        if (!seen.has(id)) { scene.remove(k.group); karts.delete(id); }
    }

    // item boxes
    const seenBoxes = new Set();
    (state.itemBoxes || []).forEach(b => {
        seenBoxes.add(b.id);
        let m = itemBoxMeshes.get(b.id);
        if (!m) {
            m = new THREE.Mesh(
                new THREE.BoxGeometry(1.1, 1.1, 1.1),
                new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0x554400 })
            );
            m.position.set(b.x, 0.8, b.z);
            scene.add(m);
            itemBoxMeshes.set(b.id, m);
        }
        m.visible = b.available;
    });
    for (const [id, m] of itemBoxMeshes) { if (!seenBoxes.has(id)) { scene.remove(m); itemBoxMeshes.delete(id); } }

    // projectiles
    const seenProj = new Set();
    (state.projectiles || []).forEach(pr => {
        seenProj.add(pr.id);
        let m = projectileMeshes.get(pr.id);
        if (!m) {
            m = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0x550000 }));
            scene.add(m);
            projectileMeshes.set(pr.id, m);
        }
        m.position.set(pr.x, 0.6, pr.z);
    });
    for (const [id, m] of projectileMeshes) { if (!seenProj.has(id)) { scene.remove(m); projectileMeshes.delete(id); } }

    // hazards
    const seenHz = new Set();
    (state.hazards || []).forEach(hz => {
        seenHz.add(hz.id);
        let m = hazardMeshes.get(hz.id);
        if (!m) {
            m = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.06, 20), new THREE.MeshStandardMaterial({ color: 0x92400e }));
            scene.add(m);
            hazardMeshes.set(hz.id, m);
        }
        m.position.set(hz.x, 0.03, hz.z);
    });
    for (const [id, m] of hazardMeshes) { if (!seenHz.has(id)) { scene.remove(m); hazardMeshes.delete(id); } }
}

// ===== Confetti (finish celebration) =====
let confetti = [];
function spawnConfetti() {
    const colors = [0xef4444, 0x3b82f6, 0x22c55e, 0xf59e0b, 0xa855f7, 0xeab308];
    for (let i = 0; i < 80; i++) {
        const m = new THREE.Mesh(
            new THREE.BoxGeometry(0.25, 0.25, 0.25),
            new THREE.MeshBasicMaterial({ color: colors[i % colors.length] })
        );
        m.position.set((Math.random() - 0.5) * 6, 6 + Math.random() * 4, (Math.random() - 0.5) * 6 - track.rzOuter - track.rzInner) ;
        m.position.set(0, 6 + Math.random() * 4, -(track.rzOuter + track.rzInner) / 2);
        m.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 4 + 2, (Math.random() - 0.5) * 6);
        m.userData.life = 2.5;
        scene.add(m);
        confetti.push(m);
    }
}
function updateConfetti(dt) {
    confetti = confetti.filter(m => {
        m.userData.life -= dt;
        m.userData.vel.y -= 9.8 * dt;
        m.position.addScaledVector(m.userData.vel, dt);
        m.rotation.x += dt * 5; m.rotation.y += dt * 5;
        if (m.userData.life <= 0) { scene.remove(m); return false; }
        return true;
    });
}

// ===== Minimap =====
function drawMinimap() {
    const w = minimapCanvas.width = 150 * (window.devicePixelRatio || 1);
    const h = minimapCanvas.height = 110 * (window.devicePixelRatio || 1);
    mmCtx.clearRect(0, 0, w, h);
    if (!track || !latestState) return;
    const pad = 10 * (window.devicePixelRatio || 1);
    const sx = (w - pad * 2) / (track.rxOuter * 2);
    const sz = (h - pad * 2) / (track.rzOuter * 2);
    const s = Math.min(sx, sz);
    const cx = w / 2, cz = h / 2;

    mmCtx.strokeStyle = 'rgba(255,255,255,0.6)';
    mmCtx.lineWidth = 2;
    mmCtx.beginPath();
    mmCtx.ellipse(cx, cz, track.rxOuter * s, track.rzOuter * s, 0, 0, Math.PI * 2);
    mmCtx.stroke();
    mmCtx.beginPath();
    mmCtx.ellipse(cx, cz, track.rxInner * s, track.rzInner * s, 0, 0, Math.PI * 2);
    mmCtx.stroke();

    Object.entries(latestState.players).forEach(([id, p]) => {
        mmCtx.fillStyle = p.color;
        mmCtx.beginPath();
        const x = cx + p.x * s, y = cz + p.z * s;
        mmCtx.arc(x, y, id === myId ? 5 : 3.5, 0, Math.PI * 2);
        mmCtx.fill();
        if (id === myId) { mmCtx.strokeStyle = '#fff'; mmCtx.lineWidth = 1.5; mmCtx.stroke(); }
    });
}

// ===== Render loop =====
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);

    for (const [id, k] of karts) {
        const t = k.target;
        if (!t) continue;
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
        if (!t.stunned) {
            k.group.position.x = k.group.position.x; // no-op keep readable
        }
        k.group.position.y = 0;

        const wheelSpin = t.speed * dt * 0.6;
        k.wheels.forEach(w => w.rotation.y += wheelSpin);

        const flameTarget = t.boosting ? 1 : 0.001;
        k.flame.scale.x += (flameTarget - k.flame.scale.x) * smooth;
        k.flame.scale.y += (flameTarget - k.flame.scale.y) * smooth;
        k.flame.scale.z += (flameTarget - k.flame.scale.z) * smooth;

        if (t.fellAt && t.fellAt !== k.lastFellAt) {
            k.lastFellAt = t.fellAt;
            k.group.scale.set(0.3, 0.3, 0.3);
        }
        k.group.scale.x += (1 - k.group.scale.x) * Math.min(1, dt * 6);
        k.group.scale.y += (1 - k.group.scale.y) * Math.min(1, dt * 6);
        k.group.scale.z += (1 - k.group.scale.z) * Math.min(1, dt * 6);
    }

    itemBoxMeshes.forEach(m => { m.rotation.y += dt * 1.6; });
    projectileMeshes.forEach(m => { m.rotation.x += dt * 8; });

    const me = karts.get(myId);
    if (me) {
        const dist = 9.5, height = 5.2;
        const behindX = me.group.position.x - Math.cos(me.lastAngle) * dist;
        const behindZ = me.group.position.z - Math.sin(me.lastAngle) * dist;
        const camSmooth = 1 - Math.exp(-6 * dt);
        camera.position.x += (behindX - camera.position.x) * camSmooth;
        camera.position.z += (behindZ - camera.position.z) * camSmooth;
        camera.position.y += (height - camera.position.y) * camSmooth;
        const lookAt = new THREE.Vector3(
            me.group.position.x + Math.cos(me.lastAngle) * 6,
            0.2,
            me.group.position.z + Math.sin(me.lastAngle) * 6
        );
        camera.lookAt(lookAt);
    }

    updateConfetti(dt);
    drawMinimap();
    renderer.render(scene, camera);
}
animate();
