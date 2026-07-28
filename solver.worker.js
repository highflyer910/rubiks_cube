// Runs the two-phase search off the main thread so the cube keeps animating
// while a solution is computed. cube.js falls back to solving inline if the
// browser refuses to start this worker (opening index.html straight from disk
// does that, for instance).
importScripts('solver.js');

self.onmessage = function (e) {
    const msg = e.data || {};
    if (msg.type === 'warm') {
        Solver.init();
        self.postMessage({ type: 'warm' });
        return;
    }
    const s = msg.state;
    const state = {
        cp: new Uint8Array(s.cp), co: new Uint8Array(s.co),
        ep: new Uint8Array(s.ep), eo: new Uint8Array(s.eo)
    };
    const started = Date.now();
    let solution = null;
    try {
        solution = Solver.solve(state, msg.opts || {});
    } catch (err) {
        self.postMessage({ type: 'solution', solution: null, error: String(err) });
        return;
    }
    self.postMessage({ type: 'solution', solution, ms: Date.now() - started });
};
