# Plank Floor Visualizer

A static browser app for visualizing rectangular plank floor layouts.

## Local Use

Run the local server:

```bash
npm run dev
```

Then open http://localhost:8000.

No npm dependencies are required; the dev server uses Node's built-in HTTP module. You can also open `index.html` directly in a browser, but a local server better matches GitHub Pages.

## GitHub Pages

This project is ready to host as a static site. In the repository settings, enable GitHub Pages from the root of the default branch.

## Features

- Room dimensions entered in inches
- Plank width and length inputs, defaulting to 7 x 48 inches
- 1/3 stair-step row offset pattern with minimum end-cut adjustment
- Minimum rip width handling by balancing first and last row rips
- Planks can run along the room's long side or short side
- Full planks and cut planks are drawn with distinct colors/textures
- Cut lists include dimensions, rip-only cuts, tongue/groove end guidance, and cut stock groupings
- Estimates required plank count and waste with compatible offcut reuse
