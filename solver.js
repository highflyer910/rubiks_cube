// ===================== KOCIEMBA TWO-PHASE SOLVER =====================
// Cubie model, following Kociemba's conventions:
//   corners  URF UFL ULB UBR DFR DLF DBL DRB    (index 0..7)
//   edges    UR UF UL UB DR DF DL DB FR FL BL BR (index 0..11)
// A state is { cp, co, ep, eo }. Applying move m: new[i] = old[m.cp[i]] (+ twist).
const Solver = (function () {
    'use strict';

    // --- Move definitions (standard Kociemba tables) ---
    const U = { cp: [3, 0, 1, 2, 4, 5, 6, 7], co: [0, 0, 0, 0, 0, 0, 0, 0], ep: [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
    const R = { cp: [4, 1, 2, 0, 7, 5, 6, 3], co: [2, 0, 0, 1, 1, 0, 0, 2], ep: [8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
    const F = { cp: [1, 5, 2, 3, 0, 4, 6, 7], co: [1, 2, 0, 0, 2, 1, 0, 0], ep: [0, 9, 2, 3, 4, 8, 6, 7, 1, 5, 10, 11], eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0] };
    const D = { cp: [0, 1, 2, 3, 5, 6, 7, 4], co: [0, 0, 0, 0, 0, 0, 0, 0], ep: [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
    const L = { cp: [0, 2, 6, 3, 4, 1, 5, 7], co: [0, 1, 2, 0, 0, 2, 1, 0], ep: [0, 1, 10, 3, 4, 5, 9, 7, 8, 2, 6, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
    const B = { cp: [0, 1, 3, 7, 4, 5, 2, 6], co: [0, 0, 1, 2, 0, 0, 2, 1], ep: [0, 1, 2, 11, 4, 5, 6, 10, 8, 9, 3, 7], eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1] };

    function compose(a, b) {
        const cp = new Uint8Array(8), co = new Uint8Array(8);
        const ep = new Uint8Array(12), eo = new Uint8Array(12);
        for (let i = 0; i < 8; i++) {
            cp[i] = a.cp[b.cp[i]];
            co[i] = (a.co[b.cp[i]] + b.co[i]) % 3;
        }
        for (let i = 0; i < 12; i++) {
            ep[i] = a.ep[b.ep[i]];
            eo[i] = (a.eo[b.ep[i]] + b.eo[i]) % 2;
        }
        return { cp, co, ep, eo };
    }

    const U2 = compose(U, U), Up = compose(U2, U);
    const R2 = compose(R, R), Rp = compose(R2, R);
    const F2 = compose(F, F), Fp = compose(F2, F);
    const D2 = compose(D, D), Dp = compose(D2, D);
    const L2 = compose(L, L), Lp = compose(L2, L);
    const B2 = compose(B, B), Bp = compose(B2, B);

    // Face order: U=0 R=1 F=2 D=3 L=4 B=5  (opposite face = (f + 3) % 6)
    const FACE_MOVES = [U, U2, Up, R, R2, Rp, F, F2, Fp, D, D2, Dp, L, L2, Lp, B, B2, Bp];
    const MOVE_NAMES = ['U', 'U2', "U'", 'R', 'R2', "R'", 'F', 'F2', "F'", 'D', 'D2', "D'", 'L', 'L2', "L'", 'B', 'B2', "B'"];
    const FACE_NAMES = ['U', 'R', 'F', 'D', 'L', 'B'];
    const INVERSE_MOVE = [2, 1, 0, 5, 4, 3, 8, 7, 6, 11, 10, 9, 14, 13, 12, 17, 16, 15];
    // Phase 2 keeps the cube in <U, D, R2, L2, F2, B2>
    const PHASE2_MOVES = [0, 1, 2, 9, 10, 11, 4, 13, 7, 16];

    const SOLVED_SLICE = 494; // slice coordinate of the solved cube (edges FR FL BL BR at 8..11)

    const nowMs = (typeof performance !== 'undefined' && performance.now)
        ? () => performance.now()
        : () => Date.now();

    const t_cp = new Uint8Array(8), t_co = new Uint8Array(8);
    const t_ep = new Uint8Array(12), t_eo = new Uint8Array(12);

    function applyInPlace(state, move) {
        t_cp.set(state.cp); t_co.set(state.co);
        t_ep.set(state.ep); t_eo.set(state.eo);
        for (let i = 0; i < 8; i++) {
            state.cp[i] = t_cp[move.cp[i]];
            state.co[i] = (t_co[move.cp[i]] + move.co[i]) % 3;
        }
        for (let i = 0; i < 12; i++) {
            state.ep[i] = t_ep[move.ep[i]];
            state.eo[i] = (t_eo[move.ep[i]] + move.eo[i]) % 2;
        }
    }

    // --- Coordinate functions ---
    function encodeCo(co) {
        let n = 0;
        for (let i = 0; i < 7; i++) n = 3 * n + co[i];
        return n;
    }
    function decodeCo(n) {
        const co = new Uint8Array(8);
        let sum = 0;
        for (let i = 6; i >= 0; i--) {
            co[i] = n % 3;
            sum += co[i];
            n = Math.floor(n / 3);
        }
        co[7] = (3 - sum % 3) % 3;
        return co;
    }
    function encodeEo(eo) {
        let n = 0;
        for (let i = 0; i < 11; i++) n = 2 * n + eo[i];
        return n;
    }
    function decodeEo(n) {
        const eo = new Uint8Array(12);
        let sum = 0;
        for (let i = 10; i >= 0; i--) {
            eo[i] = n % 2;
            sum += eo[i];
            n = Math.floor(n / 2);
        }
        eo[11] = (2 - sum % 2) % 2;
        return eo;
    }
    function nChooseK(n, k) {
        if (k < 0 || k > n) return 0;
        if (k === 0 || k === n) return 1;
        let r = 1;
        for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
        return Math.round(r);
    }
    function encodeSlice(ep) {
        let n = 0, j = 1;
        for (let i = 0; i < 12; i++) {
            if (ep[i] >= 8) { n += nChooseK(i, j); j++; }
        }
        return n;
    }
    function decodeSlicePositions(n) {
        const positions = [];
        let j = 4;
        for (let i = 11; i >= 0 && j >= 1; i--) {
            const c = nChooseK(i, j);
            if (n >= c) { positions.push(i); n -= c; j--; }
        }
        return positions.sort((a, b) => a - b);
    }
    function getSliceRepresentative(s) {
        const ep = new Uint8Array(12);
        const posSet = new Set(decodeSlicePositions(s));
        let sliceIdx = 0, nonSliceIdx = 0;
        for (let i = 0; i < 12; i++) {
            if (posSet.has(i)) ep[i] = 8 + sliceIdx++;
            else ep[i] = nonSliceIdx++;
        }
        return ep;
    }
    function encodePerm8(perm) {
        const fact = [1, 1, 2, 6, 24, 120, 720, 5040];
        let n = 0;
        for (let i = 0; i < 7; i++) {
            let c = 0;
            for (let j = i + 1; j < 8; j++) if (perm[j] < perm[i]) c++;
            n += c * fact[7 - i];
        }
        return n;
    }
    function decodePerm8(n) {
        const perm = new Array(8);
        const available = [0, 1, 2, 3, 4, 5, 6, 7];
        const fact = [5040, 720, 120, 24, 6, 2, 1, 1];
        for (let i = 0; i < 8; i++) {
            const idx = Math.floor(n / fact[i]);
            n %= fact[i];
            perm[i] = available[idx];
            available.splice(idx, 1);
        }
        return perm;
    }
    function encodePerm4(perm) {
        let n = 0;
        for (let i = 0; i < 3; i++) {
            let c = 0;
            for (let j = i + 1; j < 4; j++) if (perm[j] < perm[i]) c++;
            n = n * (4 - i) + c;
        }
        return n;
    }
    function decodePerm4(n) {
        const perm = new Array(4);
        const available = [0, 1, 2, 3];
        const fact = [6, 2, 1, 1];
        for (let i = 0; i < 4; i++) {
            const idx = Math.floor(n / fact[i]);
            n %= fact[i];
            perm[i] = available[idx];
            available.splice(idx, 1);
        }
        return perm;
    }

    // --- Transition tables ---
    // NOTE: cpMove / ep2Move hold values up to 40319, which does NOT fit in Int16.
    let coMove, eoMove, sliceMove;
    let cpMove, ep2Move, slice2Move;

    function initTransitionTables() {
        coMove = new Uint16Array(2187 * 18);
        for (let c = 0; c < 2187; c++) {
            const co = decodeCo(c);
            for (let m = 0; m < 18; m++) {
                const move = FACE_MOVES[m];
                const newCo = new Uint8Array(8);
                for (let i = 0; i < 8; i++) newCo[i] = (co[move.cp[i]] + move.co[i]) % 3;
                coMove[c * 18 + m] = encodeCo(newCo);
            }
        }
        eoMove = new Uint16Array(2048 * 18);
        for (let e = 0; e < 2048; e++) {
            const eo = decodeEo(e);
            for (let m = 0; m < 18; m++) {
                const move = FACE_MOVES[m];
                const newEo = new Uint8Array(12);
                for (let i = 0; i < 12; i++) newEo[i] = (eo[move.ep[i]] + move.eo[i]) % 2;
                eoMove[e * 18 + m] = encodeEo(newEo);
            }
        }
        sliceMove = new Uint16Array(495 * 18);
        for (let s = 0; s < 495; s++) {
            const ep = getSliceRepresentative(s);
            for (let m = 0; m < 18; m++) {
                const move = FACE_MOVES[m];
                const newEp = new Uint8Array(12);
                for (let i = 0; i < 12; i++) newEp[i] = ep[move.ep[i]];
                sliceMove[s * 18 + m] = encodeSlice(newEp);
            }
        }
        cpMove = new Uint16Array(40320 * 10);
        for (let p = 0; p < 40320; p++) {
            const cp = decodePerm8(p);
            for (let mi = 0; mi < 10; mi++) {
                const move = FACE_MOVES[PHASE2_MOVES[mi]];
                const newCp = new Uint8Array(8);
                for (let i = 0; i < 8; i++) newCp[i] = cp[move.cp[i]];
                cpMove[p * 10 + mi] = encodePerm8(newCp);
            }
        }
        ep2Move = new Uint16Array(40320 * 10);
        for (let p = 0; p < 40320; p++) {
            const perm = decodePerm8(p);
            const ep = new Uint8Array(12);
            for (let i = 0; i < 8; i++) ep[i] = perm[i];
            for (let i = 0; i < 4; i++) ep[8 + i] = 8 + i;
            for (let mi = 0; mi < 10; mi++) {
                const move = FACE_MOVES[PHASE2_MOVES[mi]];
                const newEp = new Uint8Array(12);
                for (let i = 0; i < 12; i++) newEp[i] = ep[move.ep[i]];
                const newPerm = new Uint8Array(8);
                for (let i = 0; i < 8; i++) newPerm[i] = newEp[i];
                ep2Move[p * 10 + mi] = encodePerm8(newPerm);
            }
        }
        slice2Move = new Uint16Array(24 * 10);
        for (let p = 0; p < 24; p++) {
            const perm4 = decodePerm4(p);
            const ep = new Uint8Array(12);
            for (let i = 0; i < 8; i++) ep[i] = i;
            for (let i = 0; i < 4; i++) ep[8 + i] = 8 + perm4[i];
            for (let mi = 0; mi < 10; mi++) {
                const move = FACE_MOVES[PHASE2_MOVES[mi]];
                const newEp = new Uint8Array(12);
                for (let i = 0; i < 12; i++) newEp[i] = ep[move.ep[i]];
                const newPerm4 = new Uint8Array(4);
                for (let i = 0; i < 4; i++) newPerm4[i] = newEp[8 + i] - 8;
                slice2Move[p * 10 + mi] = encodePerm4(newPerm4);
            }
        }
    }

    // --- Pruning tables ---
    // Each one pairs two coordinates and holds the exact distance to the goal for
    // that pair, which prunes far harder than three independent coordinates would.
    let prune1Twist, prune1Flip;   // (corner twist | edge flip) x UD-slice
    let prune2Cp, prune2Ep;        // (corner perm | edge perm) x slice perm

    // BFS outwards from the SOLVED coordinate. Note the slice coordinate of a
    // solved cube is 494, not 0 - seeding at 0 aims phase 1 at the wrong goal.
    function buildPairPrune(moveA, sizeA, moveB, sizeB, numMoves, goalA, goalB) {
        const SIZE = sizeA * sizeB;
        const table = new Int8Array(SIZE);
        table.fill(-1);
        const queue = new Int32Array(SIZE);
        const goal = goalA * sizeB + goalB;
        queue[0] = goal; table[goal] = 0;
        let head = 0, tail = 1;
        while (head < tail) {
            const s = queue[head++];
            const dist = table[s];
            const rowA = ((s / sizeB) | 0) * numMoves;
            const rowB = (s % sizeB) * numMoves;
            for (let m = 0; m < numMoves; m++) {
                const ns = moveA[rowA + m] * sizeB + moveB[rowB + m];
                if (table[ns] === -1) {
                    table[ns] = dist + 1;
                    queue[tail++] = ns;
                }
            }
        }
        return table;
    }

    function initPruningTables() {
        prune1Twist = buildPairPrune(coMove, 2187, sliceMove, 495, 18, 0, SOLVED_SLICE);
        prune1Flip = buildPairPrune(eoMove, 2048, sliceMove, 495, 18, 0, SOLVED_SLICE);
        prune2Cp = buildPairPrune(cpMove, 40320, slice2Move, 24, 10, 0, 0);
        prune2Ep = buildPairPrune(ep2Move, 40320, slice2Move, 24, 10, 0, 0);
    }

    // --- Heuristics ---
    function h1(state) {
        const sl = encodeSlice(state.ep);
        const a = prune1Twist[encodeCo(state.co) * 495 + sl];
        const b = prune1Flip[encodeEo(state.eo) * 495 + sl];
        return a > b ? a : b;
    }
    function h2(state) {
        const cp = encodePerm8(state.cp);
        const ep = encodePerm8(state.ep.subarray(0, 8));
        const sl = encodePerm4([state.ep[8] - 8, state.ep[9] - 8, state.ep[10] - 8, state.ep[11] - 8]);
        const a = prune2Cp[cp * 24 + sl], b = prune2Ep[ep * 24 + sl];
        return a > b ? a : b;
    }

    // --- Phase 2: IDA* inside <U, D, R2, L2, F2, B2> ---
    // Each attempt gets its own node budget: an expensive one is abandoned and the
    // caller simply moves on to the next phase 1 solution, rather than stalling.
    function searchPhase2(state, bound, g, lastFace, prevFace, path, p2) {
        if (++p2.nodes > p2.limit) { p2.aborted = true; return false; }
        const h = h2(state);
        if (h === 0) return true;
        if (g + h > bound) return false;
        for (let mi = 0; mi < 10; mi++) {
            const m = PHASE2_MOVES[mi];
            const face = (m / 3) | 0;
            if (face === lastFace) continue;
            if (face === (lastFace + 3) % 6 && face === prevFace) continue;
            applyInPlace(state, FACE_MOVES[m]);
            path.push(m);
            if (searchPhase2(state, bound, g + 1, face, lastFace, path, p2)) return true;
            path.pop();
            applyInPlace(state, FACE_MOVES[INVERSE_MOVE[m]]);
            if (p2.aborted) return false;
        }
        return false;
    }
    function solvePhase2(state, maxDepth, ctx) {
        const path = [];
        const p2 = { nodes: 0, limit: ctx.p2NodeLimit, aborted: false };
        for (let depth = h2(state); depth <= maxDepth; depth++) {
            if (searchPhase2(state, depth, 0, -1, -1, path, p2)) return path.slice();
            path.length = 0;
            if (p2.aborted) return null;
        }
        return null;
    }

    // --- Phase 1: enumerate ways into <U, D, R2, L2, F2, B2>, each feeding phase 2 ---
    function enumPhase1(state, depth, g, lastFace, prevFace, path, ctx) {
        if (ctx.stop) return;
        if (++ctx.nodes % 4096 === 0 && outOfTime(ctx)) return;
        if (g === depth) {
            if (h1(state) === 0) tryPhase2(path, state, ctx);
            return;
        }
        if (g + h1(state) > depth) return;
        for (let m = 0; m < 18; m++) {
            const face = (m / 3) | 0;
            if (face === lastFace) continue;
            // for opposite faces (which commute) fix an order, so U D and D U
            // are not both explored
            if (face === (lastFace + 3) % 6 && face === prevFace) continue;
            applyInPlace(state, FACE_MOVES[m]);
            path.push(m);
            enumPhase1(state, depth, g + 1, face, lastFace, path, ctx);
            path.pop();
            applyInPlace(state, FACE_MOVES[INVERSE_MOVE[m]]);
            if (ctx.stop) return;
        }
    }
    // The soft deadline only applies once we actually have a solution in hand -
    // never come back empty-handed just because time ran out.
    function outOfTime(ctx) {
        const t = nowMs();
        if (t > ctx.hardDeadline || (ctx.best && t > ctx.deadline)) { ctx.stop = true; return true; }
        return false;
    }

    function tryPhase2(path1, state, ctx) {
        // only worth searching for something shorter than the best so far
        const budget = ctx.best ? ctx.best.length - path1.length - 1 : ctx.maxDepth2;
        if (budget < 0) return;
        const p2 = solvePhase2(cloneState(state), Math.min(budget, ctx.maxDepth2), ctx);
        if (!p2) return;
        const total = simplify(path1.concat(p2));
        if (!ctx.best || total.length < ctx.best.length) ctx.best = total;
        if (ctx.best.length <= ctx.goodEnough) ctx.stop = true;
    }

    // Merge consecutive turns of the same face (phase 1 can end on the face phase 2 starts on)
    function simplify(moves) {
        const out = [];
        for (const m of moves) {
            const face = (m / 3) | 0;
            const turns = (m % 3) + 1; // 1 = cw, 2 = double, 3 = ccw
            if (out.length && out[out.length - 1].face === face) {
                const merged = (out[out.length - 1].turns + turns) % 4;
                out.pop();
                if (merged !== 0) out.push({ face, turns: merged });
            } else {
                out.push({ face, turns });
            }
        }
        return out.map(o => o.face * 3 + (o.turns - 1));
    }

    // --- Public API ---
    let initialized = false;
    function init() {
        if (initialized) return;
        initTransitionTables();
        initPruningTables();
        initialized = true;
    }
    function isReady() { return initialized; }

    function getSolvedState() {
        return {
            cp: new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]),
            co: new Uint8Array(8),
            ep: new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
            eo: new Uint8Array(12)
        };
    }
    function cloneState(state) {
        return {
            cp: new Uint8Array(state.cp), co: new Uint8Array(state.co),
            ep: new Uint8Array(state.ep), eo: new Uint8Array(state.eo)
        };
    }
    function applyFaceMove(state, moveIdx) {
        applyInPlace(state, FACE_MOVES[moveIdx]);
    }
    function isSolvedState(state) {
        for (let i = 0; i < 8; i++) if (state.cp[i] !== i || state.co[i] !== 0) return false;
        for (let i = 0; i < 12; i++) if (state.ep[i] !== i || state.eo[i] !== 0) return false;
        return true;
    }

    /**
     * Solve a cubie state. Returns an array of move indices into MOVE_NAMES,
     * or null if the state cannot be solved within the time budget.
     */
    function solve(state, opts) {
        init();
        opts = opts || {};
        if (isSolvedState(state)) return [];
        const softMs = opts.timeLimitMs || 1500;
        const ctx = {
            best: null,
            stop: false,
            nodes: 0,
            deadline: nowMs() + softMs,
            hardDeadline: nowMs() + (opts.hardLimitMs || softMs * 8),
            goodEnough: opts.goodEnough || 23,
            maxDepth2: opts.maxDepth2 || 18,
            // many cheap phase 2 attempts beat a few expensive ones (measured)
            p2NodeLimit: opts.p2NodeLimit || 25000
        };
        const work = cloneState(state);
        for (let depth = h1(work); depth <= 12; depth++) {
            enumPhase1(work, depth, 0, -1, -1, [], ctx);
            if (ctx.best && ctx.best.length <= ctx.goodEnough) break;
            if (ctx.stop || outOfTime(ctx)) break;
        }
        return ctx.best;
    }

    // ---------- Reading a state off a physical cube ----------
    // Faces are pinned to world directions (U = +y, R = +x, F = +z ...); the colour
    // that belongs on each face is read from the centre currently sitting there, so
    // slice moves and whole-cube rotations need no special handling.
    const DIR_OF_FACE = { U: 'up', R: 'right', F: 'front', D: 'down', L: 'left', B: 'back' };
    const VEC_OF_FACE = { U: [0, 1, 0], R: [1, 0, 0], F: [0, 0, 1], D: [0, -1, 0], L: [-1, 0, 0], B: [0, 0, -1] };
    const CORNER_FACES = [['U', 'R', 'F'], ['U', 'F', 'L'], ['U', 'L', 'B'], ['U', 'B', 'R'],
                          ['D', 'F', 'R'], ['D', 'L', 'F'], ['D', 'B', 'L'], ['D', 'R', 'B']];
    const EDGE_FACES = [['U', 'R'], ['U', 'F'], ['U', 'L'], ['U', 'B'], ['D', 'R'], ['D', 'F'],
                        ['D', 'L'], ['D', 'B'], ['F', 'R'], ['F', 'L'], ['B', 'L'], ['B', 'R']];

    /**
     * Build a cubie state from the physical pieces.
     * pieces: [{ x, y, z, colors: { up, down, left, right, front, back } }]
     * Returns a state, or null if the pieces do not form a solvable cube.
     */
    function fromPieces(pieces) {
        const at = new Map();
        for (const p of pieces) at.set(`${p.x},${p.y},${p.z}`, p);
        const pieceAt = (v) => at.get(`${v[0]},${v[1]},${v[2]}`);
        const add = (...vs) => vs.reduce((a, v) => [a[0] + v[0], a[1] + v[1], a[2] + v[2]], [0, 0, 0]);

        // colour of each face, taken from the centre currently on it
        const faceColor = {};
        for (const face of Object.keys(VEC_OF_FACE)) {
            const centre = pieceAt(VEC_OF_FACE[face]);
            if (!centre) return null;
            faceColor[face] = centre.colors[DIR_OF_FACE[face]];
        }
        const cornerColors = CORNER_FACES.map(fs => fs.map(f => faceColor[f]));
        const edgeColors = EDGE_FACES.map(fs => fs.map(f => faceColor[f]));
        const udColors = [faceColor.U, faceColor.D];

        const cp = new Uint8Array(8), co = new Uint8Array(8);
        const ep = new Uint8Array(12), eo = new Uint8Array(12);

        for (let i = 0; i < 8; i++) {
            const fs = CORNER_FACES[i];
            const piece = pieceAt(add(...fs.map(f => VEC_OF_FACE[f])));
            if (!piece) return null;
            const f = fs.map(face => piece.colors[DIR_OF_FACE[face]]);
            let ori = 0;
            while (ori < 3 && udColors.indexOf(f[ori]) === -1) ori++;
            if (ori === 3) return null;
            const c1 = f[(ori + 1) % 3], c2 = f[(ori + 2) % 3];
            const j = cornerColors.findIndex(cc => cc[1] === c1 && cc[2] === c2);
            if (j === -1) return null;
            cp[i] = j; co[i] = ori;
        }
        for (let i = 0; i < 12; i++) {
            const fs = EDGE_FACES[i];
            const piece = pieceAt(add(...fs.map(f => VEC_OF_FACE[f])));
            if (!piece) return null;
            const f = fs.map(face => piece.colors[DIR_OF_FACE[face]]);
            let found = -1;
            for (let j = 0; j < 12; j++) {
                if (edgeColors[j][0] === f[0] && edgeColors[j][1] === f[1]) { found = j; eo[i] = 0; break; }
                if (edgeColors[j][0] === f[1] && edgeColors[j][1] === f[0]) { found = j; eo[i] = 1; break; }
            }
            if (found === -1) return null;
            ep[i] = found;
        }
        const state = { cp, co, ep, eo };
        return isValid(state) ? state : null;
    }

    function permParity(perm) {
        let parity = 0;
        for (let i = 0; i < perm.length; i++)
            for (let j = i + 1; j < perm.length; j++) if (perm[j] < perm[i]) parity ^= 1;
        return parity;
    }
    function isValid(state) {
        const seenC = new Set(state.cp), seenE = new Set(state.ep);
        if (seenC.size !== 8 || seenE.size !== 12) return false;
        let cs = 0, es = 0;
        for (let i = 0; i < 8; i++) cs += state.co[i];
        for (let i = 0; i < 12; i++) es += state.eo[i];
        if (cs % 3 !== 0 || es % 2 !== 0) return false;
        return permParity(state.cp) === permParity(state.ep);
    }

    function movesToString(moves) {
        return moves.map(m => MOVE_NAMES[m]).join(' ');
    }

    return {
        init, isReady, getSolvedState, cloneState, applyFaceMove, isSolvedState,
        solve, fromPieces, isValid, movesToString, simplify,
        MOVE_NAMES, FACE_NAMES, INVERSE_MOVE
    };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Solver;
