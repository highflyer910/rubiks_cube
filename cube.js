// ===================== SCENE SETUP =====================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.Fog(0x1a1a2e, 10, 50);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(5, 4, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = false;
controls.minDistance = 4;
controls.maxDistance = 20;
controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };

// ===================== LIGHTING =====================
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const mainLight = new THREE.DirectionalLight(0xffffff, 0.85);
mainLight.position.set(5, 10, 7);
mainLight.castShadow = true;
mainLight.shadow.mapSize.set(2048, 2048);
scene.add(mainLight);
scene.add(new THREE.DirectionalLight(0x8888ff, 0.25).position.set(-5, 0, -5));
scene.add(new THREE.DirectionalLight(0xff8888, 0.15).position.set(-5, 5, 5));

const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50),
    new THREE.ShadowMaterial({ opacity: 0.15 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -2.5;
ground.receiveShadow = true;
scene.add(ground);

// ===================== CUBE CONFIG =====================
const CUBE_SIZE = 0.92;
const SPACING = 1.0;
const TOTAL_SIZE = SPACING;

const materials = {
    right:  new THREE.MeshStandardMaterial({ color: 0x0045ad, roughness: 0.2, metalness: 0.1 }),
    left:   new THREE.MeshStandardMaterial({ color: 0x009e60, roughness: 0.2, metalness: 0.1 }),
    top:    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.1 }),
    bottom: new THREE.MeshStandardMaterial({ color: 0xffd500, roughness: 0.2, metalness: 0.1 }),
    front:  new THREE.MeshStandardMaterial({ color: 0xb90000, roughness: 0.2, metalness: 0.1 }),
    back:   new THREE.MeshStandardMaterial({ color: 0xff5900, roughness: 0.2, metalness: 0.1 }),
    inner:  new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8, metalness: 0.0 })
};

const COLOR_NAME = new Map([
    [materials.top, 'white'], [materials.bottom, 'yellow'],
    [materials.front, 'red'], [materials.back, 'orange'],
    [materials.right, 'blue'], [materials.left, 'green'],
    [materials.inner, 'inner']
]);

// world directions, in the material index order of a BoxGeometry
const DIR_VECTORS = {
    right: [1, 0, 0], left: [-1, 0, 0], up: [0, 1, 0],
    down: [0, -1, 0], front: [0, 0, 1], back: [0, 0, -1]
};
const DIR_ORDER = ['right', 'left', 'up', 'down', 'front', 'back'];

const cubes = [];
const cubeGroup = new THREE.Group();
scene.add(cubeGroup);

const highlightMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0x4fc3f7, wireframe: true, transparent: true, opacity: 0.6 })
);
highlightMesh.visible = false;
scene.add(highlightMesh);

const guideHighlights = [];
function clearGuideHighlights() {
    guideHighlights.forEach(h => {
        scene.remove(h);
        h.geometry.dispose();
        h.material.dispose();
    });
    guideHighlights.length = 0;
}
function addGuideHighlight(pos, color) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(CUBE_SIZE + 0.04, CUBE_SIZE + 0.04, CUBE_SIZE + 0.04),
        new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.8 })
    );
    mesh.position.set(pos.x * TOTAL_SIZE, pos.y * TOTAL_SIZE, pos.z * TOTAL_SIZE);
    scene.add(mesh);
    guideHighlights.push(mesh);
}

function createCube(x, y, z) {
    const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
    const mats = [
        x === 1  ? materials.right  : materials.inner,
        x === -1 ? materials.left   : materials.inner,
        y === 1  ? materials.top    : materials.inner,
        y === -1 ? materials.bottom : materials.inner,
        z === 1  ? materials.front  : materials.inner,
        z === -1 ? materials.back   : materials.inner
    ];
    const cube = new THREE.Mesh(geometry, mats);
    cube.position.set(x * TOTAL_SIZE, y * TOTAL_SIZE, z * TOTAL_SIZE);
    cube.castShadow = true;
    cube.receiveShadow = true;
    const edges = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
        color: 0x000000, transparent: true, opacity: 0.2
    }));
    cube.add(line);
    cube.userData = { logicalPos: { x, y, z } };
    return cube;
}

// Geometries and the line material are per-cubie, so they have to be released
// before the cube is rebuilt or every reset leaks another 27 of them.
function disposeCube(cube) {
    cube.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material && obj.material !== cube.material) obj.material.dispose();
    });
}

function initCube() {
    cubes.forEach(c => { cubeGroup.remove(c); disposeCube(c); });
    cubes.length = 0;
    for (let x = -1; x <= 1; x++)
        for (let y = -1; y <= 1; y++)
            for (let z = -1; z <= 1; z++) {
                const cube = createCube(x, y, z);
                cubes.push(cube);
                cubeGroup.add(cube);
            }
}
initCube();

// ===================== MOVE VOCABULARY =====================
// One source of truth for what every letter of cube notation means, so the
// keyboard, the guide, the patterns, the solver playback and the move list
// can never drift apart. `cw` is the sign of the rotation about `axis` that
// looks clockwise when you face that side from outside.
const FACE_DEF = {
    U: { axis: 'y', layer: 1, cw: -1 },
    D: { axis: 'y', layer: -1, cw: 1 },
    R: { axis: 'x', layer: 1, cw: -1 },
    L: { axis: 'x', layer: -1, cw: 1 },
    F: { axis: 'z', layer: 1, cw: -1 },
    B: { axis: 'z', layer: -1, cw: 1 },
    M: { axis: 'x', layer: 0, cw: 1 },   // middle slice, follows L
    E: { axis: 'y', layer: 0, cw: 1 },   // equator slice, follows D
    S: { axis: 'z', layer: 0, cw: -1 },  // standing slice, follows F
    x: { axis: 'x', layer: 'all', cw: -1 },
    y: { axis: 'y', layer: 'all', cw: -1 },
    z: { axis: 'z', layer: 'all', cw: -1 }
};
// wide turns: outer face + the slice next to it, [face, slice, sliceIsReversed]
const WIDE_MOVES = {
    r: ['R', 'M', true], l: ['L', 'M', false],
    u: ['U', 'E', true], d: ['D', 'E', false],
    f: ['F', 'S', false], b: ['B', 'S', true]
};
const ROTATION_KEYS = ['x', 'y', 'z'];

function invertMod(mod) {
    if (mod === '2') return '2';
    return mod === "'" ? '' : "'";
}
function turnFor(face, mod) {
    const def = FACE_DEF[face];
    if (!def) return null;
    const quarter = def.cw * (Math.PI / 2);
    return {
        axis: def.axis,
        layer: def.layer,
        angle: mod === '2' ? quarter * 2 : (mod === "'" ? -quarter : quarter)
    };
}
// Accepts standard notation: R U' F2 M E S x y' z2 and wide turns r u f.
function parseAlgorithm(str) {
    const turns = [];
    for (const token of String(str).trim().split(/\s+/)) {
        if (!token) continue;
        const m = token.match(/^([UDLRFBMESxyzrludfb])(['’2]?)$/);
        if (!m) continue;
        const face = m[1];
        const mod = m[2] === '’' ? "'" : m[2];
        if (WIDE_MOVES[face] && !FACE_DEF[face]) {
            const [outer, slice, reversed] = WIDE_MOVES[face];
            turns.push(turnFor(outer, mod));
            turns.push(turnFor(slice, reversed ? invertMod(mod) : mod));
        } else {
            const t = turnFor(face, mod);
            if (t) turns.push(t);
        }
    }
    return turns;
}
// Reverse lookup: which letter does this (axis, layer) pair belong to?
const FACE_BY_AXIS_LAYER = {};
for (const [face, def] of Object.entries(FACE_DEF)) {
    if (ROTATION_KEYS.includes(face)) continue;
    FACE_BY_AXIS_LAYER[`${def.axis}:${def.layer}`] = face;
}
function getMoveNotation(axis, layer, angle) {
    const face = FACE_BY_AXIS_LAYER[`${axis}:${layer}`];
    if (!face) return '?';
    if (Math.abs(Math.abs(angle) - Math.PI) < 0.01) return face + '2';
    // clockwise turns share the sign of FACE_DEF[face].cw; the others are primed
    return (Math.sign(angle) === FACE_DEF[face].cw) ? face : face + "'";
}
function invertTurn(turn) {
    return { axis: turn.axis, layer: turn.layer, angle: -turn.angle };
}

// ===================== GAME STATE =====================
let isAnimating = false;
let moveQueue = [];
let moveHistory = [];
let redoStack = [];
let moveCount = 0;
let currentScramble = '';
let assisted = false;      // solver/guide/pattern used since the last scramble
let solvedShown = false;

// moves the player is credited with (cube rotations and replays are not)
const COUNTED_SOURCES = new Set(['manual', 'keyboard']);

// ===================== TIMER =====================
let timerRunning = false;
let timerStart = 0;
let timerElapsed = 0;   // milliseconds
let lastTimerText = '';

function formatTime(ms) {
    const totalCs = Math.floor(ms / 10);
    const cs = totalCs % 100;
    const totalSec = Math.floor(totalCs / 100);
    const secs = totalSec % 60;
    const mins = Math.floor(totalSec / 60);
    const pad = (n, w) => n.toString().padStart(w, '0');
    return mins > 0
        ? `${mins}:${pad(secs, 2)}.${pad(cs, 2)}`
        : `${secs}.${pad(cs, 2)}`;
}
function currentElapsed() {
    return timerRunning ? Date.now() - timerStart : timerElapsed;
}
function startTimer() {
    if (timerRunning) return;
    timerRunning = true;
    timerStart = Date.now() - timerElapsed;
    document.getElementById('btn-timer').textContent = '⏸';
}
function pauseTimer() {
    if (!timerRunning) return;
    timerElapsed = Date.now() - timerStart;
    timerRunning = false;
    document.getElementById('btn-timer').textContent = '⏱';
}
function toggleTimer() {
    timerRunning ? pauseTimer() : startTimer();
}
function resetTimer() {
    pauseTimer();
    timerElapsed = 0;
    document.getElementById('btn-timer').textContent = '⏱';
    updateStats();
}
function updateStats() {
    document.getElementById('move-count').textContent = moveCount;
    const text = formatTime(currentElapsed());
    if (text !== lastTimerText) {
        document.getElementById('timer').textContent = text;
        lastTimerText = text;
    }
}
function updateMoveList() {
    const list = document.getElementById('move-list');
    list.innerHTML = '';
    const recent = moveHistory.slice(-20);
    recent.forEach((move, i) => {
        const tag = document.createElement('span');
        tag.className = 'move-tag' + (i === recent.length - 1 ? ' latest' : '');
        tag.textContent = move.notation;
        list.appendChild(tag);
    });
    list.scrollLeft = list.scrollWidth;
}

// ===================== READING THE CUBE =====================
const _tmpVec = new THREE.Vector3();
function getWorldColors(cube) {
    const result = {};
    for (let i = 0; i < 6; i++) {
        const dir = DIR_ORDER[i];
        const v = DIR_VECTORS[dir];
        _tmpVec.set(v[0], v[1], v[2]).applyEuler(cube.rotation);
        let worldDir = null;
        if (_tmpVec.x > 0.9) worldDir = 'right';
        else if (_tmpVec.x < -0.9) worldDir = 'left';
        else if (_tmpVec.y > 0.9) worldDir = 'up';
        else if (_tmpVec.y < -0.9) worldDir = 'down';
        else if (_tmpVec.z > 0.9) worldDir = 'front';
        else if (_tmpVec.z < -0.9) worldDir = 'back';
        if (worldDir) result[worldDir] = COLOR_NAME.get(cube.material[i]) || 'unknown';
    }
    return result;
}
function pieceAt(x, y, z) {
    return cubes.find(c => {
        const p = c.userData.logicalPos;
        return p.x === x && p.y === y && p.z === z;
    });
}
function getPieceInfo(cube) {
    const wc = getWorldColors(cube);
    const colors = Object.values(wc).filter(c => c !== 'inner');
    const type = colors.length === 1 ? 'center' : colors.length === 2 ? 'edge' : 'corner';
    return { type, colors: colors.slice().sort(), pos: { ...cube.userData.logicalPos }, worldColors: wc };
}
// which colour currently sits on each face of the cube
function getRefCenters() {
    const centers = {};
    for (const c of cubes) {
        const p = c.userData.logicalPos;
        if (Math.abs(p.x) + Math.abs(p.y) + Math.abs(p.z) !== 1) continue;
        const wc = getWorldColors(c);
        for (const dir of DIR_ORDER) {
            const v = DIR_VECTORS[dir];
            if (p.x === v[0] && p.y === v[1] && p.z === v[2]) centers[dir] = wc[dir];
        }
    }
    return centers;
}
// A face is solved when every outward sticker matches the centre on that face,
// which stays true no matter how the whole cube has been rotated.
function checkSolved() {
    const centers = getRefCenters();
    for (const cube of cubes) {
        const p = cube.userData.logicalPos;
        const wc = getWorldColors(cube);
        for (const dir of DIR_ORDER) {
            const v = DIR_VECTORS[dir];
            const outward = (v[0] !== 0 && p.x === v[0]) || (v[1] !== 0 && p.y === v[1]) || (v[2] !== 0 && p.z === v[2]);
            if (outward && wc[dir] !== centers[dir]) return false;
        }
    }
    return true;
}
// Snapshot in the shape Solver.fromPieces expects.
function readCubeState() {
    return Solver.fromPieces(cubes.map(c => ({
        x: c.userData.logicalPos.x,
        y: c.userData.logicalPos.y,
        z: c.userData.logicalPos.z,
        colors: getWorldColors(c)
    })));
}

// ===================== LAYER ROTATION ENGINE =====================
const TURN_DURATION = 240;
// >0 while a scripted sequence (scramble, pattern, algorithm) is running, so a
// finished move does not re-enable the buttons half way through it
let sequenceDepth = 0;

function setBusy(busy) {
    ['btn-scramble', 'btn-reset', 'btn-solve', 'btn-undo', 'btn-redo', 'btn-hint', 'btn-autoplay']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = busy;
        });
    if (!busy) {
        const undo = document.getElementById('btn-undo');
        const redo = document.getElementById('btn-redo');
        if (undo) undo.disabled = moveHistory.length === 0;
        if (redo) redo.disabled = redoStack.length === 0;
    }
}

function rotateLayer(axis, layer, angle, source = 'manual') {
    return new Promise((resolve) => {
        if (isAnimating) { moveQueue.push({ axis, layer, angle, resolve, source }); return; }
        _doRotate(axis, layer, angle, source, resolve);
    });
}
function applyTurn(turn, source) {
    return rotateLayer(turn.axis, turn.layer, turn.angle, source);
}
function processQueue() {
    if (moveQueue.length > 0 && !isAnimating) {
        const next = moveQueue.shift();
        _doRotate(next.axis, next.layer, next.angle, next.source, next.resolve);
    }
}
function _doRotate(axis, layer, angle, source, resolve) {
    isAnimating = true;
    setBusy(true);

    const pivot = new THREE.Object3D();
    cubeGroup.add(pivot);
    const layerCubes = layer === 'all'
        ? cubes.slice()
        : cubes.filter(c => Math.round(c.userData.logicalPos[axis]) === layer);
    layerCubes.forEach(cube => pivot.attach(cube));

    const startRotation = pivot.rotation[axis];
    const targetRotation = startRotation + angle;
    const startTime = performance.now();
    const duration = Math.abs(angle) > Math.PI / 2 + 0.01 ? TURN_DURATION * 1.4 : TURN_DURATION;
    playTurnSound();

    function animateRotation(now) {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - t, 4);
        pivot.rotation[axis] = startRotation + (targetRotation - startRotation) * ease;
        if (t < 1) { requestAnimationFrame(animateRotation); return; }

        pivot.rotation[axis] = targetRotation;
        const snap = Math.PI / 2;
        const wrap = (a) => ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        layerCubes.forEach(cube => {
            cubeGroup.attach(cube);
            cube.position.x = Math.round(cube.position.x / TOTAL_SIZE) * TOTAL_SIZE;
            cube.position.y = Math.round(cube.position.y / TOTAL_SIZE) * TOTAL_SIZE;
            cube.position.z = Math.round(cube.position.z / TOTAL_SIZE) * TOTAL_SIZE;
            cube.rotation.x = wrap(Math.round(cube.rotation.x / snap) * snap);
            cube.rotation.y = wrap(Math.round(cube.rotation.y / snap) * snap);
            cube.rotation.z = wrap(Math.round(cube.rotation.z / snap) * snap);
            cube.userData.logicalPos.x = Math.round(cube.position.x / TOTAL_SIZE);
            cube.userData.logicalPos.y = Math.round(cube.position.y / TOTAL_SIZE);
            cube.userData.logicalPos.z = Math.round(cube.position.z / TOTAL_SIZE);
        });
        cubeGroup.remove(pivot);
        isAnimating = false;

        if (COUNTED_SOURCES.has(source) && layer !== 'all') {
            moveCount++;
            const notation = getMoveNotation(axis, layer, angle);
            moveHistory.push({ axis, layer, angle, notation });
            redoStack.length = 0;
            if (!timerRunning && moveCount === 1) startTimer();
            updateMoveList();
        }
        updateStats();
        setBusy(sequenceDepth > 0);

        if (source !== 'scramble') {
            if (guideOpen) updateGuide();
            if (checkSolved()) onSolved(source);
            else solvedShown = false;
        }
        if (resolve) resolve();
        processQueue();
    }
    requestAnimationFrame(animateRotation);
}

// ===================== SOLVED =====================
function onSolved(source) {
    if (solvedShown) return;
    // an untouched cube sitting on the table is not an achievement
    if (moveCount === 0 && source !== 'solver' && source !== 'guide') return;
    solvedShown = true;
    pauseTimer();
    playSolveSound();
    launchConfetti();

    const ms = currentElapsed();
    const banner = document.getElementById('solved-banner');
    document.getElementById('solved-stats').textContent =
        `${moveCount} moves in ${formatTime(ms)}${assisted ? ' (with help)' : ''}`;
    banner.classList.add('show');

    if (!assisted && currentScramble && moveCount > 0) {
        const record = recordSolve(ms, moveCount, currentScramble);
        document.getElementById('solved-extra').textContent = record.isPB
            ? '🏆 New personal best!'
            : (record.best ? `Best: ${formatTime(record.best)}` : '');
    } else {
        document.getElementById('solved-extra').textContent =
            assisted ? 'Not timed — solve it yourself for a session time.' : '';
    }
    setStatus('');
}
function dismissBanner() {
    document.getElementById('solved-banner').classList.remove('show');
}
function setStatus(msg) {
    document.getElementById('status').textContent = msg;
}

// ===================== INTERACTION =====================
let isDragging = false, selectedCube = null, faceNormal = null, startPoint = null;
let hoverCube = null, hoverFace = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function getIntersects(clientX, clientY) {
    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    return raycaster.intersectObjects(cubes);
}
// Clicks that land on a button or panel must not also grab the cube behind it.
function isOverUI(target) {
    return !!(target && target.closest && target.closest('button, #guide-panel, #solver-panel, #times-panel, #patterns-panel, #scramble-bar, #solved-banner'));
}
function updateHover(clientX, clientY) {
    if (isDragging || isAnimating) { highlightMesh.visible = false; return; }
    const intersects = getIntersects(clientX, clientY);
    if (intersects.length === 0) {
        hoverCube = null; hoverFace = null; highlightMesh.visible = false;
        return;
    }
    const hit = intersects[0];
    const cube = hit.object;
    const normal = hit.face.normal.clone().transformDirection(cube.matrixWorld).normalize();
    if (hoverCube === cube && hoverFace && hoverFace.equals(normal)) return;
    hoverCube = cube; hoverFace = normal;
    const axis = Math.abs(normal.x) > 0.5 ? 'x' : Math.abs(normal.y) > 0.5 ? 'y' : 'z';
    const layer = Math.round(cube.userData.logicalPos[axis]);
    const layerCubes = cubes.filter(c => Math.round(c.userData.logicalPos[axis]) === layer);
    if (layerCubes.length === 0) return;
    const box = new THREE.Box3();
    layerCubes.forEach(c => box.expandByObject(c));
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    highlightMesh.scale.set(size.x + 0.02, size.y + 0.02, size.z + 0.02);
    highlightMesh.position.copy(center);
    highlightMesh.visible = true;
}
function onPointerDown(event) {
    if (event.button !== 0 || isAnimating) return;
    if (isOverUI(event.target)) return;
    unlockAudio();
    stopSolutionPlayback();
    const intersects = getIntersects(event.clientX, event.clientY);
    if (intersects.length > 0) {
        isDragging = true;
        selectedCube = intersects[0].object;
        startPoint = intersects[0].point.clone();
        faceNormal = intersects[0].face.normal.clone().transformDirection(selectedCube.matrixWorld).normalize();
        controls.enabled = false;
        highlightMesh.visible = false;
    }
}
function onPointerMove(event) {
    if (!isDragging) updateHover(event.clientX, event.clientY);
}
function onPointerUp(event) {
    if (!isDragging) return;
    isDragging = false;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(faceNormal, startPoint);
    const endPoint = new THREE.Vector3();
    const hit = raycaster.ray.intersectPlane(plane, endPoint);
    if (hit) {
        const dragVector = endPoint.clone().sub(startPoint);
        if (dragVector.length() > 0.12) {
            const faceCenter = selectedCube.position.clone();
            let toStart = startPoint.clone().sub(faceCenter).projectOnPlane(faceNormal);
            const minRadius = 0.25;
            if (toStart.length() < minRadius) {
                toStart.normalize();
                if (toStart.length() < 0.001) {
                    toStart.set(0, 1, 0).projectOnPlane(faceNormal).normalize();
                    if (toStart.length() < 0.001) toStart.set(1, 0, 0).projectOnPlane(faceNormal).normalize();
                }
                toStart.multiplyScalar(minRadius);
            }
            const dragOnPlane = dragVector.projectOnPlane(faceNormal);
            const cross = new THREE.Vector3().crossVectors(toStart, dragOnPlane);
            const sign = cross.dot(faceNormal);
            const angle = sign > 0 ? Math.PI / 2 : -Math.PI / 2;
            const axis = Math.abs(faceNormal.x) > 0.5 ? 'x' : Math.abs(faceNormal.y) > 0.5 ? 'y' : 'z';
            const layer = Math.round(selectedCube.userData.logicalPos[axis]);
            rotateLayer(axis, layer, angle);
        }
    }
    selectedCube = null; faceNormal = null; startPoint = null;
    controls.enabled = true;
}

window.addEventListener('mousedown', onPointerDown);
window.addEventListener('mousemove', onPointerMove);
window.addEventListener('mouseup', onPointerUp);

let touchId = null;
window.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    if (isOverUI(e.target)) return;
    e.preventDefault();
    touchId = t.identifier;
    onPointerDown({ button: 0, clientX: t.clientX, clientY: t.clientY, target: e.target });
}, { passive: false });
window.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    if (t.identifier !== touchId) return;
    e.preventDefault();
    onPointerMove({ clientX: t.clientX, clientY: t.clientY });
}, { passive: false });
window.addEventListener('touchend', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === touchId) {
            onPointerUp({ clientX: t.clientX, clientY: t.clientY });
            touchId = null;
            break;
        }
    }
}, { passive: false });
window.addEventListener('touchcancel', () => {
    if (isDragging) {
        isDragging = false; selectedCube = null; faceNormal = null; startPoint = null;
        controls.enabled = true; touchId = null;
    }
});

// ===================== KEYBOARD =====================
// Shift = counter-clockwise for every face, including L, D and B (which turn the
// opposite way about their axis - getting that wrong inverts half the notation).
window.addEventListener('keydown', (e) => {
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    const key = e.key;
    const lower = key.toLowerCase();

    if (lower === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.shiftKey ? redoMove() : undoMove(); return; }
    if (lower === 'z' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); undoMove(); return; }
    if (key === '?' || (lower === 'h' && !e.ctrlKey)) { e.preventDefault(); toggleGuide(); return; }
    if (key === 'Escape') { dismissBanner(); return; }
    // let Space activate a focused button rather than always scrambling
    if (key === ' ') {
        if (document.activeElement && document.activeElement.tagName === 'BUTTON') return;
        e.preventDefault();
        scrambleCube();
        return;
    }

    if (isAnimating && moveQueue.length > 2) return;
    stopSolutionPlayback();
    unlockAudio();

    const mod = e.shiftKey ? "'" : '';
    if (ROTATION_KEYS.includes(lower)) {
        const turn = turnFor(lower, mod);
        e.preventDefault();
        applyTurn(turn, 'rotate');
        return;
    }
    const face = key.toUpperCase();
    if (FACE_DEF[face] && !ROTATION_KEYS.includes(face)) {
        e.preventDefault();
        applyTurn(turnFor(face, mod), 'keyboard');
    }
});

// ===================== SCRAMBLE / RESET / UNDO =====================
// A proper scramble uses outer faces only, never repeats a face and never puts
// two turns of opposite faces in a row that could be reordered.
function makeScramble(length = 22, rng = Math.random) {
    const faces = ['U', 'D', 'L', 'R', 'F', 'B'];
    const opposite = { U: 'D', D: 'U', L: 'R', R: 'L', F: 'B', B: 'F' };
    const mods = ['', "'", '2'];
    const out = [];
    let last = null, beforeLast = null;
    for (let i = 0; i < length; i++) {
        let face;
        do {
            face = faces[Math.floor(rng() * faces.length)];
        } while (face === last || (face === opposite[last] && face === beforeLast));
        beforeLast = last;
        last = face;
        out.push(face + mods[Math.floor(rng() * mods.length)]);
    }
    return out.join(' ');
}
// deterministic generator so a "daily" scramble is the same for everyone
function seededRng(seed) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return function () {
        h += 0x6D2B79F5;
        let t = h;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

async function runAlgorithm(alg, source) {
    const turns = parseAlgorithm(alg);
    sequenceDepth++;
    try {
        for (const turn of turns) await applyTurn(turn, source);
    } finally {
        sequenceDepth--;
        if (sequenceDepth === 0) setBusy(false);
    }
}

async function scrambleCube(alg, label) {
    if (isAnimating) return;
    dismissBanner();
    closeSolverPanel();
    resetTimer();
    moveHistory = []; redoStack = []; moveCount = 0;
    assisted = false; solvedShown = false;
    clearGuideHighlights();
    updateStats(); updateMoveList();

    currentScramble = alg || makeScramble();
    showScramble(currentScramble, label);
    setStatus('Scrambling…');
    setBusy(true);
    await runAlgorithm(currentScramble, 'scramble');
    setBusy(false);
    moveHistory = []; redoStack = []; moveCount = 0;
    updateStats(); updateMoveList();
    setStatus(label ? `${label} — go!` : 'Scrambled — your turn!');
    if (guideOpen) updateGuide();
}
function dailyScramble() {
    const today = new Date();
    const key = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    scrambleCube(makeScramble(22, seededRng(key)), `Daily ${key}`);
}
function resetCube() {
    if (isAnimating) return;
    dismissBanner();
    closeSolverPanel();
    initCube();
    moveHistory = []; redoStack = []; moveCount = 0;
    currentScramble = ''; assisted = false; solvedShown = true;
    resetTimer(); updateStats(); updateMoveList();
    showScramble('', '');
    clearGuideHighlights();
    setStatus('Cube reset');
    setTimeout(() => setStatus(''), 1500);
    if (guideOpen) updateGuide();
}
function undoMove() {
    if (isAnimating || moveHistory.length === 0) return;
    const last = moveHistory.pop();
    redoStack.push(last);
    moveCount = Math.max(0, moveCount - 1);
    rotateLayer(last.axis, last.layer, -last.angle, 'undo');
    updateStats(); updateMoveList();
}
function redoMove() {
    if (isAnimating || redoStack.length === 0) return;
    const move = redoStack.pop();
    moveHistory.push(move);
    moveCount++;
    rotateLayer(move.axis, move.layer, move.angle, 'redo');
    updateStats(); updateMoveList();
}

// ===================== SCRAMBLE BAR =====================
function showScramble(alg, label) {
    const bar = document.getElementById('scramble-bar');
    const text = document.getElementById('scramble-text');
    if (!alg) { bar.classList.remove('show'); return; }
    text.textContent = (label ? label + ': ' : '') + alg;
    bar.classList.add('show');
}
async function copyToClipboard(value, okMsg) {
    try {
        await navigator.clipboard.writeText(value);
        setStatus(okMsg);
    } catch (e) {
        setStatus('Copy failed — select the text manually');
    }
    setTimeout(() => setStatus(''), 1800);
}
function copyScramble() {
    if (!currentScramble) return;
    copyToClipboard(currentScramble, 'Scramble copied');
}
function shareScramble() {
    if (!currentScramble) return;
    const url = location.origin + location.pathname + '#alg=' + encodeURIComponent(currentScramble);
    copyToClipboard(url, 'Link copied — share the same scramble');
}

// ===================== AI SOLVER =====================
let solutionMoves = [];
let solutionIndex = 0;
let solutionPlaying = false;
let solverWorker = null;
let workerUnavailable = false;

function getWorker() {
    if (workerUnavailable || solverWorker) return solverWorker;
    try {
        solverWorker = new Worker('solver.worker.js');
        solverWorker.addEventListener('error', () => { workerUnavailable = true; solverWorker = null; });
    } catch (e) {
        workerUnavailable = true;
        solverWorker = null;
    }
    return solverWorker;
}
// Solve off the main thread when the browser allows it, inline when it does not.
function solveAsync(state) {
    return new Promise(resolve => {
        const worker = getWorker();
        if (!worker) { resolve(Solver.solve(state)); return; }
        let settled = false;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            worker.onmessage = null;
            resolve(value);
        };
        const fallback = () => {
            workerUnavailable = true;
            try { worker.terminate(); } catch (e) { /* already gone */ }
            solverWorker = null;
            finish(Solver.solve(state));
        };
        const timer = setTimeout(fallback, 30000);
        worker.onmessage = (e) => {
            if (e.data && e.data.type === 'solution') finish(e.data.solution);
        };
        worker.onerror = fallback;
        worker.postMessage({
            type: 'solve',
            state: { cp: [...state.cp], co: [...state.co], ep: [...state.ep], eo: [...state.eo] }
        });
    });
}
function solverMoveToTurn(moveIdx) {
    const name = Solver.MOVE_NAMES[moveIdx];
    return turnFor(name[0], name.slice(1));
}

async function autoSolve() {
    if (isAnimating) { setStatus('Wait for the current move…'); return; }
    if (checkSolved()) { setStatus('Already solved!'); return; }

    const state = readCubeState();
    if (!state) {
        setStatus('Could not read the cube state');
        return;
    }
    assisted = true;
    setStatus('Computing solution…');
    document.getElementById('btn-solve').disabled = true;
    showSolverPanel();
    document.getElementById('solver-status').textContent =
        Solver.isReady() ? 'Searching…' : 'Building tables (first run takes ~1s)…';

    await new Promise(r => setTimeout(r, 30));
    const startTime = performance.now();
    const solution = await solveAsync(state);
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    document.getElementById('btn-solve').disabled = false;

    if (!solution) {
        setStatus('No solution found — try Reset');
        document.getElementById('solver-status').textContent = 'Search gave up';
        return;
    }
    solutionMoves = solution;
    solutionIndex = 0;
    solutionPlaying = false;
    setStatus(`Solution: ${solution.length} moves in ${elapsed}s`);
    document.getElementById('solver-status').textContent = `Found in ${elapsed}s`;
    updateSolverPanel();
}

function showSolverPanel() { document.getElementById('solver-panel').classList.add('open'); }
function closeSolverPanel() {
    document.getElementById('solver-panel').classList.remove('open');
    solutionPlaying = false;
    solutionMoves = [];
    solutionIndex = 0;
}
function stopSolutionPlayback() {
    if (!solutionPlaying) return;
    solutionPlaying = false;
    document.getElementById('btn-solver-play').textContent = '▶️ Play';
}
function updateSolverPanel() {
    document.getElementById('solution-length').textContent = solutionMoves.length;
    const container = document.getElementById('solver-moves');
    container.innerHTML = '';
    solutionMoves.forEach((m, i) => {
        const tag = document.createElement('span');
        tag.className = 'solver-move-tag';
        if (i < solutionIndex) tag.classList.add('done');
        else if (i === solutionIndex) tag.classList.add('current');
        tag.textContent = Solver.MOVE_NAMES[m];
        container.appendChild(tag);
    });
    const currentTag = container.children[solutionIndex];
    if (currentTag) currentTag.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const pct = solutionMoves.length > 0 ? (solutionIndex / solutionMoves.length * 100) : 0;
    document.getElementById('solver-progress-fill').style.width = pct + '%';
}
async function toggleSolutionPlay() {
    if (solutionPlaying) { stopSolutionPlayback(); return; }
    await playSolution();
}
async function playSolution() {
    if (solutionMoves.length === 0) return;
    if (solutionIndex >= solutionMoves.length) { solutionIndex = 0; updateSolverPanel(); }
    solutionPlaying = true;
    document.getElementById('btn-solver-play').textContent = '⏸️ Pause';
    while (solutionIndex < solutionMoves.length && solutionPlaying) {
        await applyTurn(solverMoveToTurn(solutionMoves[solutionIndex]), 'solver');
        solutionIndex++;
        updateSolverPanel();
    }
    solutionPlaying = false;
    document.getElementById('btn-solver-play').textContent = '▶️ Play';
    if (solutionIndex >= solutionMoves.length) {
        document.getElementById('solver-status').textContent = 'Complete!';
    }
}
async function nextSolutionMove() {
    stopSolutionPlayback();
    if (solutionIndex >= solutionMoves.length || isAnimating) return;
    await applyTurn(solverMoveToTurn(solutionMoves[solutionIndex]), 'solver');
    solutionIndex++;
    updateSolverPanel();
}
async function prevSolutionMove() {
    stopSolutionPlayback();
    if (solutionIndex <= 0 || isAnimating) return;
    solutionIndex--;
    await applyTurn(invertTurn(solverMoveToTurn(solutionMoves[solutionIndex])), 'solver');
    updateSolverPanel();
}

// ===================== SOLVE GUIDE =====================
// Layer-by-layer beginner method: first layer on the bottom (D), last layer on
// top (U), which is the orientation every algorithm below is written for.
function sideColorFor(pos, centers) {
    if (pos.z === 1) return { side: 'front', color: centers.front };
    if (pos.z === -1) return { side: 'back', color: centers.back };
    if (pos.x === 1) return { side: 'right', color: centers.right };
    return { side: 'left', color: centers.left };
}
const BOTTOM_EDGES = [{ x: 0, y: -1, z: 1 }, { x: 0, y: -1, z: -1 }, { x: 1, y: -1, z: 0 }, { x: -1, y: -1, z: 0 }];
const BOTTOM_CORNERS = [{ x: 1, y: -1, z: 1 }, { x: -1, y: -1, z: 1 }, { x: 1, y: -1, z: -1 }, { x: -1, y: -1, z: -1 }];
const MIDDLE_EDGES = [{ x: 1, y: 0, z: 1 }, { x: -1, y: 0, z: 1 }, { x: 1, y: 0, z: -1 }, { x: -1, y: 0, z: -1 }];
const TOP_EDGES = [{ x: 0, y: 1, z: 1 }, { x: 0, y: 1, z: -1 }, { x: 1, y: 1, z: 0 }, { x: -1, y: 1, z: 0 }];
const TOP_CORNERS = [{ x: 1, y: 1, z: 1 }, { x: -1, y: 1, z: 1 }, { x: 1, y: 1, z: -1 }, { x: -1, y: 1, z: -1 }];

const sameColors = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

function countSolved(positions, predicate) {
    const centers = getRefCenters();
    let solved = 0;
    for (const pos of positions) {
        const piece = pieceAt(pos.x, pos.y, pos.z);
        if (piece && predicate(piece, pos, centers)) solved++;
    }
    return { complete: solved === positions.length, solved, total: positions.length };
}
function isBottomCrossSolved() {
    return countSolved(BOTTOM_EDGES, (piece, pos, c) => {
        const wc = getWorldColors(piece);
        const side = sideColorFor(pos, c);
        return wc.down === c.down && wc[side.side] === side.color;
    });
}
function isBottomCornersSolved() {
    return countSolved(BOTTOM_CORNERS, (piece, pos, c) => {
        const wc = getWorldColors(piece);
        if (wc.down !== c.down) return false;
        return wc[pos.z === 1 ? 'front' : 'back'] === (pos.z === 1 ? c.front : c.back)
            && wc[pos.x === 1 ? 'right' : 'left'] === (pos.x === 1 ? c.right : c.left);
    });
}
function isMiddleLayerSolved() {
    return countSolved(MIDDLE_EDGES, (piece, pos, c) => {
        const wc = getWorldColors(piece);
        return wc[pos.z === 1 ? 'front' : 'back'] === (pos.z === 1 ? c.front : c.back)
            && wc[pos.x === 1 ? 'right' : 'left'] === (pos.x === 1 ? c.right : c.left);
    });
}
function isTopCrossSolved() {
    return countSolved(TOP_EDGES, (piece, pos, c) => getWorldColors(piece).up === c.up);
}
function isTopFaceSolved() {
    return countSolved(TOP_CORNERS, (piece, pos, c) => getWorldColors(piece).up === c.up);
}
function isTopCornersPlaced() {
    return countSolved(TOP_CORNERS, (piece, pos, c) => {
        const expected = [c.up, pos.x === 1 ? c.right : c.left, pos.z === 1 ? c.front : c.back].sort();
        return sameColors(getPieceInfo(piece).colors, expected);
    });
}
function isTopEdgesPlaced() {
    return countSolved(TOP_EDGES, (piece, pos, c) => {
        const side = sideColorFor(pos, c);
        const wc = getWorldColors(piece);
        return wc.up === c.up && wc[side.side] === side.color;
    });
}

const SOLVER_STEPS = [
    { name: 'Bottom Cross', check: isBottomCrossSolved },
    { name: 'Bottom Corners', check: isBottomCornersSolved },
    { name: 'Middle Layer', check: isMiddleLayerSolved },
    { name: 'Top Cross', check: isTopCrossSolved },
    { name: 'Top Face', check: isTopFaceSolved },
    { name: 'Top Corners', check: isTopCornersPlaced },
    { name: 'Top Edges', check: isTopEdgesPlaced }
];

function stepHints(stepIdx, result) {
    const c = getRefCenters();
    const bottom = c.down || 'bottom';
    const top = c.up || 'top';
    const hints = [
        {
            description: `Build a ${bottom} cross on the bottom. Put each ${bottom} edge in the top layer above its matching centre, then turn that face twice. (${result.solved}/4)`,
            algorithms: [
                { label: 'Drop a lined-up edge down', moves: 'F2' },
                { label: 'Edge stuck in the middle layer', moves: "R U R' U'" }
            ]
        },
        {
            description: `Put the four ${bottom} corners in. Bring a corner above its slot, then repeat the trigger until it drops in the right way up. (${result.solved}/4)`,
            algorithms: [
                { label: 'Right-hand trigger (repeat up to 5x)', moves: "R U R' U'" },
                { label: 'Corner stuck in the bottom layer', moves: "R U R' U' R U R'" }
            ]
        },
        {
            description: `Place the four middle edges. Line a top edge up with its centre, then send it left or right. (${result.solved}/4)`,
            algorithms: [
                { label: 'Insert to the right', moves: "U R U' R' U' F' U F" },
                { label: 'Insert to the left', moves: "U' L' U L U F U' F'" }
            ]
        },
        {
            description: `Make a ${top} cross on top. Hold a dot, an L shape (facing back-left) or a line (horizontal) and repeat. (${result.solved}/4)`,
            algorithms: [{ label: 'Cross algorithm (repeat)', moves: "F R U R' U' F'" }]
        },
        {
            description: `Turn every ${top} corner face up. Hold the cube so an unsolved corner is front-right-top. (${result.solved}/4)`,
            algorithms: [
                { label: 'Sune', moves: "R U R' U R U2 R'" },
                { label: 'Anti-Sune', moves: "R U2 R' U' R U' R'" }
            ]
        },
        {
            description: `Move the top corners to their home spots. Find two corners that already match and hold them on the right. (${result.solved}/4)`,
            algorithms: [{ label: 'Cycle three corners', moves: "U R U' L' U R' U' L" }]
        },
        {
            description: `Last step - cycle the top edges into place. (${result.solved}/4)`,
            algorithms: [
                { label: 'Cycle three edges', moves: "R U' R U R U R U' R' U' R2" },
                { label: 'Swap opposite pairs', moves: 'M2 U M2 U2 M2 U M2' }
            ]
        }
    ];
    return hints[stepIdx] || { description: 'Analysing…', algorithms: [] };
}

function detectCurrentStep() {
    for (let i = 0; i < SOLVER_STEPS.length; i++) {
        const result = SOLVER_STEPS[i].check();
        if (!result.complete) return { stepIndex: i, ...result };
    }
    return { stepIndex: SOLVER_STEPS.length, complete: true, solved: 0, total: 0 };
}

let guideOpen = false;
function toggleGuide() {
    guideOpen = !guideOpen;
    document.getElementById('guide-panel').classList.toggle('open', guideOpen);
    document.getElementById('guide-toggle').setAttribute('aria-expanded', String(guideOpen));
    if (guideOpen) updateGuide();
}
function updateGuide() {
    const list = document.getElementById('step-list');
    list.innerHTML = '';
    let totalProgress = 0, totalItems = 0, currentStepIdx = -1;
    const results = SOLVER_STEPS.map(s => s.check());
    results.forEach((result, i) => {
        totalProgress += result.solved;
        totalItems += result.total;
        if (!result.complete && currentStepIdx === -1) currentStepIdx = i;
    });
    results.forEach((result, i) => {
        const row = document.createElement('div');
        row.className = 'step-row';
        if (i === currentStepIdx) row.classList.add('current');
        else if (result.complete) row.classList.add('done');
        row.innerHTML = `<div class="step-num">${result.complete ? '✓' : i + 1}</div>` +
            `<div class="step-name">${SOLVER_STEPS[i].name}</div>` +
            `<div class="step-status">${result.solved}/${result.total}</div>`;
        list.appendChild(row);
    });
    document.getElementById('guide-progress').style.width =
        (totalItems > 0 ? totalProgress / totalItems * 100 : 0) + '%';

    const hintSection = document.getElementById('guide-hint-section');
    const hintText = document.getElementById('guide-hint-text');
    const algoDiv = document.getElementById('guide-algorithms');
    if (currentStepIdx >= 0) {
        hintSection.style.display = 'block';
        const step = SOLVER_STEPS[currentStepIdx];
        const hints = stepHints(currentStepIdx, results[currentStepIdx]);
        hintText.innerHTML = `<strong>${step.name}</strong> — ${hints.description}`;
        algoDiv.innerHTML = hints.algorithms.map(a =>
            `<div class="algo-box" data-alg="${a.moves}"><div class="algo-label">${a.label}</div>${a.moves}</div>`
        ).join('');
        algoDiv.querySelectorAll('.algo-box').forEach(box => {
            box.addEventListener('click', () => playAlgo(box.dataset.alg));
        });
    } else {
        hintSection.style.display = 'block';
        hintText.innerHTML = '<strong>🎉 Solved!</strong> Hit Scramble for another go.';
        algoDiv.innerHTML = '';
    }
}
async function playAlgo(algoStr) {
    if (isAnimating) return;
    assisted = true;
    clearGuideHighlights();
    await runAlgorithm(algoStr, 'guide');
    if (guideOpen) updateGuide();
}
async function autoPlayHint() {
    const state = detectCurrentStep();
    if (state.stepIndex >= SOLVER_STEPS.length) return;
    const hint = stepHints(state.stepIndex, state);
    if (hint.algorithms.length > 0) await playAlgo(hint.algorithms[0].moves);
}
const GREEN = 0x55ff55, RED = 0xff5555, AMBER = 0xffaa00;
function showHint() {
    clearGuideHighlights();
    const state = detectCurrentStep();
    if (state.stepIndex >= SOLVER_STEPS.length) return;
    const c = getRefCenters();
    const mark = (positions, isDone) => {
        for (const pos of positions) {
            const piece = pieceAt(pos.x, pos.y, pos.z);
            if (piece) addGuideHighlight(pos, isDone(piece, pos) ? GREEN : RED);
        }
    };
    // also point at the pieces that still have to travel to this layer
    const markLoose = (type, color, homeY) => {
        for (const cube of cubes) {
            const info = getPieceInfo(cube);
            if (info.type !== type || !info.colors.includes(color)) continue;
            if (cube.userData.logicalPos.y !== homeY) addGuideHighlight(cube.userData.logicalPos, AMBER);
        }
    };
    switch (state.stepIndex) {
        case 0:
            mark(BOTTOM_EDGES, (p, pos) => {
                const wc = getWorldColors(p);
                return wc.down === c.down && wc[sideColorFor(pos, c).side] === sideColorFor(pos, c).color;
            });
            markLoose('edge', c.down, -1);
            break;
        case 1:
            mark(BOTTOM_CORNERS, (p) => getWorldColors(p).down === c.down);
            markLoose('corner', c.down, -1);
            break;
        case 2:
            mark(MIDDLE_EDGES, (p, pos) => {
                const wc = getWorldColors(p);
                return wc[pos.z === 1 ? 'front' : 'back'] === (pos.z === 1 ? c.front : c.back)
                    && wc[pos.x === 1 ? 'right' : 'left'] === (pos.x === 1 ? c.right : c.left);
            });
            break;
        case 3:
            mark(TOP_EDGES, (p) => getWorldColors(p).up === c.up);
            break;
        case 4:
            mark(TOP_CORNERS, (p) => getWorldColors(p).up === c.up);
            break;
        case 5:
            mark(TOP_CORNERS, (p, pos) => {
                const expected = [c.up, pos.x === 1 ? c.right : c.left, pos.z === 1 ? c.front : c.back].sort();
                return sameColors(getPieceInfo(p).colors, expected);
            });
            break;
        case 6:
            mark(TOP_EDGES, (p, pos) => {
                const side = sideColorFor(pos, c);
                return getWorldColors(p)[side.side] === side.color;
            });
            break;
    }
    setTimeout(clearGuideHighlights, 4000);
}

// ===================== PATTERNS =====================
const PATTERNS = [
    { name: 'Checkerboard', alg: 'M2 E2 S2' },
    { name: 'Six Spots', alg: "U D' R L' F B' U D'" },
    { name: 'Four Spots', alg: "F2 B2 U D' R2 L2 U D'" },
    { name: 'Cube in a Cube', alg: "F L F U' R U F2 L2 U' L' B D' B' L2 U" },
    { name: 'Cube in a Cube in a Cube', alg: "U' L' U' F' R2 B' R F U B2 U B' L U' F U R F'" },
    { name: 'Superflip', alg: "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2" },
    { name: 'Anaconda', alg: "L U B' U' R L' B R' F B' D R D' F'" },
    { name: 'Tetris', alg: "L R F B U' D' L' R'" },
    { name: 'Plus Minus', alg: 'U2 R2 L2 U2 R2 L2' }
];
function buildPatternList() {
    const list = document.getElementById('patterns-list');
    list.innerHTML = '';
    for (const pattern of PATTERNS) {
        const btn = document.createElement('button');
        btn.className = 'pattern-btn';
        btn.innerHTML = `<span>${pattern.name}</span><small>${pattern.alg.split(' ').length} moves</small>`;
        btn.addEventListener('click', () => applyPattern(pattern));
        list.appendChild(btn);
    }
}
async function applyPattern(pattern) {
    if (isAnimating) return;
    resetCube();
    assisted = true;
    solvedShown = true;   // the pattern is the goal, not a solve
    setStatus(`Building ${pattern.name}…`);
    await runAlgorithm(pattern.alg, 'pattern');
    currentScramble = pattern.alg;
    showScramble(pattern.alg, pattern.name);
    setStatus(pattern.name);
}

// ===================== SESSION TIMES =====================
const STORE_KEY = 'rubik3d.session.v1';
function loadSession() {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}
function saveSession(times) {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify(times.slice(-200)));
    } catch (e) {
        /* private mode or full storage: times just will not persist */
    }
}
let session = loadSession();

// WCA-style average: drop the best and the worst, mean the rest.
function averageOf(times, n) {
    if (times.length < n) return null;
    const slice = times.slice(-n).map(t => t.ms).sort((a, b) => a - b);
    const middle = slice.slice(1, -1);
    return middle.reduce((a, b) => a + b, 0) / middle.length;
}
function recordSolve(ms, moves, scramble) {
    const previousBest = session.length ? Math.min(...session.map(t => t.ms)) : null;
    session.push({ ms, moves, scramble, at: Date.now() });
    saveSession(session);
    updateSessionUI();
    return { isPB: previousBest === null || ms < previousBest, best: previousBest };
}
function updateSessionUI() {
    const best = session.length ? Math.min(...session.map(t => t.ms)) : null;
    const ao5 = averageOf(session, 5);
    const ao12 = averageOf(session, 12);
    document.getElementById('stat-best').textContent = best === null ? '—' : formatTime(best);
    document.getElementById('stat-ao5').textContent = ao5 === null ? '—' : formatTime(ao5);
    document.getElementById('stat-ao12').textContent = ao12 === null ? '—' : formatTime(ao12);
    document.getElementById('stat-count').textContent = session.length;
    document.getElementById('best-inline').textContent = best === null ? '—' : formatTime(best);

    const list = document.getElementById('times-list');
    list.innerHTML = '';
    session.slice(-15).reverse().forEach((entry, i) => {
        const row = document.createElement('div');
        row.className = 'time-row' + (entry.ms === best ? ' best' : '');
        row.innerHTML = `<span class="idx">${session.length - i}</span>` +
            `<span class="t">${formatTime(entry.ms)}</span>` +
            `<span class="mv">${entry.moves} moves</span>`;
        list.appendChild(row);
    });
    if (session.length === 0) {
        list.innerHTML = '<div class="times-empty">Scramble, then solve it yourself to log a time.</div>';
    }
}
function clearSession() {
    session = [];
    saveSession(session);
    updateSessionUI();
    setStatus('Session cleared');
    setTimeout(() => setStatus(''), 1500);
}
function togglePanel(id) {
    const panel = document.getElementById(id);
    const willOpen = !panel.classList.contains('open');
    document.querySelectorAll('.side-panel').forEach(p => p.classList.remove('open'));
    panel.classList.toggle('open', willOpen);
}
function toggleTimes() { togglePanel('times-panel'); }
function togglePatterns() { togglePanel('patterns-panel'); }

// ===================== SOUND =====================
let audioCtx = null;
let soundOn = localStorage.getItem('rubik3d.sound') !== 'off';
function unlockAudio() {
    if (!soundOn || audioCtx) return;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        audioCtx = null;
    }
}
function beep(freq, duration, type = 'triangle', gain = 0.06, delay = 0) {
    if (!soundOn || !audioCtx) return;
    const start = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(gain, start + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env).connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
}
function playTurnSound() {
    beep(150 + Math.random() * 40, 0.07, 'triangle', 0.05);
}
function playSolveSound() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => beep(f, 0.32, 'sine', 0.08, i * 0.11));
}
function toggleSound() {
    soundOn = !soundOn;
    localStorage.setItem('rubik3d.sound', soundOn ? 'on' : 'off');
    document.getElementById('btn-sound').textContent = soundOn ? '🔊' : '🔇';
    if (soundOn) { unlockAudio(); playTurnSound(); }
}

// ===================== CONFETTI =====================
const confettiCanvas = document.getElementById('confetti');
const confettiCtx = confettiCanvas.getContext('2d');
let confetti = [];
function sizeConfetti() {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
}
sizeConfetti();
function launchConfetti() {
    const colors = ['#4fc3f7', '#66bb6a', '#ffd500', '#ff5900', '#b90000', '#ffffff'];
    for (let i = 0; i < 140; i++) {
        confetti.push({
            x: window.innerWidth / 2 + (Math.random() - 0.5) * 260,
            y: window.innerHeight / 2 + (Math.random() - 0.5) * 80,
            vx: (Math.random() - 0.5) * 9,
            vy: -Math.random() * 11 - 3,
            size: 4 + Math.random() * 6,
            rot: Math.random() * Math.PI,
            spin: (Math.random() - 0.5) * 0.3,
            color: colors[Math.floor(Math.random() * colors.length)],
            life: 1
        });
    }
}
function drawConfetti() {
    if (confetti.length === 0) return;
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confetti = confetti.filter(p => p.life > 0 && p.y < window.innerHeight + 40);
    for (const p of confetti) {
        p.vy += 0.32;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.spin;
        p.life -= 0.004;
        confettiCtx.save();
        confettiCtx.translate(p.x, p.y);
        confettiCtx.rotate(p.rot);
        confettiCtx.globalAlpha = Math.max(0, Math.min(1, p.life));
        confettiCtx.fillStyle = p.color;
        confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        confettiCtx.restore();
    }
    if (confetti.length === 0) confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
}

// ===================== ANIMATION LOOP =====================
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    if (timerRunning) updateStats();
    drawConfetti();
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    sizeConfetti();
});

// ===================== STARTUP =====================
function wireControls() {
    const on = (id, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', handler);
    };
    on('btn-scramble', () => scrambleCube());
    on('btn-reset', resetCube);
    on('btn-undo', undoMove);
    on('btn-redo', redoMove);
    on('btn-solve', autoSolve);
    on('btn-timer', toggleTimer);
    on('btn-sound', toggleSound);
    on('btn-patterns', togglePatterns);
    on('btn-times', toggleTimes);
    on('guide-toggle', toggleGuide);
    on('btn-hint', showHint);
    on('btn-autoplay', autoPlayHint);
    on('btn-solver-close', closeSolverPanel);
    on('btn-solver-play', toggleSolutionPlay);
    on('btn-solver-prev', prevSolutionMove);
    on('btn-solver-next', nextSolutionMove);
    on('btn-copy-scramble', copyScramble);
    on('btn-share-scramble', shareScramble);
    on('btn-daily', dailyScramble);
    on('btn-clear-session', clearSession);
    on('btn-play-again', () => { dismissBanner(); scrambleCube(); });
    on('btn-close-banner', dismissBanner);
    on('btn-close-times', toggleTimes);
    on('btn-close-patterns', togglePatterns);
    document.body.addEventListener('pointerdown', unlockAudio, { once: true });
}

function warmSolverTables() {
    const worker = getWorker();
    if (worker) { worker.postMessage({ type: 'warm' }); return; }
    const warm = () => Solver.init();
    if (window.requestIdleCallback) requestIdleCallback(warm, { timeout: 4000 });
    else setTimeout(warm, 2000);
}

function start() {
    wireControls();
    buildPatternList();
    updateSessionUI();
    updateStats();
    document.getElementById('btn-sound').textContent = soundOn ? '🔊' : '🔇';
    setBusy(false);

    // #alg=... lets a scramble (or any algorithm) be shared as a link
    const match = /[#&]alg=([^&]+)/.exec(location.hash);
    if (match) {
        try {
            const alg = decodeURIComponent(match[1]);
            if (parseAlgorithm(alg).length > 0) scrambleCube(alg, 'Shared');
        } catch (e) {
            /* malformed link: just start from a solved cube */
        }
    }
    setTimeout(warmSolverTables, 1200);
}
start();
