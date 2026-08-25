# 🎲 Interactive 3D Rubik's Cube

A fully interactive, browser-based 3×3 Rubik's Cube with a solver, step-by-step guide, speedcubing timer, and classic puzzle patterns. Built with vanilla JavaScript and Three.js — no build step required.

[🔗 Live Demo](https://rubiks-cube-black.vercel.app/) 

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **🖱️ Drag & Turn** | Click and drag any face to rotate it intuitively |
| **🖐️ Touch Support** | Fully responsive on mobile and tablet |
| **🤖 Solver** | Kociemba two-phase algorithm finds near-optimal solutions in ~1 second |
| **📖 Step-by-Step Guide** | Interactive layer-by-layer beginner guide with hints and auto-play |
| **⏱️ Speedcubing Timer** | Session timer with Best, Ao5, Ao12, and solve history (persisted in localStorage) |
| **🔀 Smart Scramble** | 22-move random scramble with no redundant face pairs; shareable via URL |
| **📅 Daily Challenge** | Same scramble for everyone, seeded by today's date |
| **🎨 Pattern Gallery** | 9 classic patterns including Superflip, Cube in a Cube, Anaconda, and more |
| **⌨️ Keyboard Controls** | Full notation support: `R L U D F B M E S` with `Shift` for prime; `X Y Z` for whole-cube rotation |
| **↩️ Undo / Redo** | Full move history with `Z` undo and `Ctrl+Shift+Z` redo |
| **🔊 Audio Feedback** | Satisfying turn clicks and a victory chime |
| **🎉 Solve Celebration** | Confetti burst when you solve the cube |

---

## ⌨️ Controls

| Input | Action |
|-------|--------|
| **Drag face** | Turn that face |
| **Right-drag** | Orbit the camera |
| **Scroll** | Zoom in/out |
| `R` `L` `U` `D` `F` `B` | Turn face clockwise |
| `Shift` + face key | Turn face counter-clockwise |
| `M` `E` `S` | Slice moves |
| `X` `Y` `Z` | Rotate the whole cube |
| `Space` | Scramble |
| `Z` | Undo last move |
| `Ctrl+Shift+Z` | Redo |
| `H` or `?` | Toggle guide panel |
| `Esc` | Close banner / panels |

---


## 🤖 Solver Algorithm

The solver implements **Kociemba's Two-Phase Algorithm**:

1. **Phase 1** — Search into the subgroup `<U, D, R2, L2, F2, B2>` using coordinate-based IDA* with paired pruning tables (twist×slice, flip×slice).
2. **Phase 2** — Complete the solve with only half-turns for the side faces, using corner-perm×slice and edge-perm×slice pruning.

Transition tables and pruning tables are built lazily on first run (~1 second). The solver is packaged as a self-contained module (`Solver`) that can also be used standalone or from Node.js.

---

## 🛠️ Tech Stack

- **Three.js** (r128) — 3D rendering and OrbitControls
- **Vanilla JavaScript** — No frameworks, no build step
- **Web Workers** — Off-thread solving to keep the animation loop at 60fps
- **Web Audio API** — Synthesized sound effects (no external audio files)
- **localStorage** — Session persistence for times and sound preference


---

## 📝 License

MIT

---

## 🙌 Credits

- Solver based on Herbert Kociemba's [Two-Phase Algorithm](http://kociemba.org/cube.htm)
- Cube colors follow the [WCA standard](https://www.worldcubeassociation.org/): white/yellow, red/orange, blue/green
