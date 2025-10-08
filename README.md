# Flappy Bird Clone

A from-scratch Flappy Bird remake built with HTML5 canvas, CSS, and vanilla JavaScript. The game runs fullscreen on desktop and mobile with responsive physics tuned to feel close to the original.

## Features

- Responsive, fullscreen canvas that adapts to any device size
- Time-based physics for smooth, authentic Flappy Bird movement
- Mouse, touch, and keyboard input (tap/click/space/arrow up)
- Dynamic pipe generation with scalable gaps and speed
- Persistent best score stored locally in the browser
- Animated background, ground parallax, and polished overlays

## How to Play

1. Open `index.html` in any modern browser.
2. Tap, click, or press **Space**/**Arrow Up** to flap.
3. Navigate between pipes without touching them or the ground.
4. Try to beat your best score!

## Development Notes

- All assets are procedurally drawn on the canvas—no external images required.
- Physics constants scale with the viewport so gameplay remains consistent across devices.
- Scores are stored using `localStorage` under the key `flappy-bird-clone-best`.

Feel free to tweak the values in `game.js` if you want to experiment with difficulty or visuals.
