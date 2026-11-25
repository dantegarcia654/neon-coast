# Neon Coast

A single-player, 3D open-city game for desktop browsers. Play as Jean Philanthrope or Mara Vega. Take a sports car from downtown to the coastal trails, board a boat at East Pier, or fly out over the coast. Five wanted levels bring cruisers, roadblocks, helicopters and officers carrying hot-dog launchers.

## Play on your computer

1. [Download Neon Coast V13](https://github.com/dantegarcia654/neon-coast/releases/download/v13.0.0/Neon-Coast-V13.zip) and **extract the entire ZIP**.
2. With [Node.js](https://nodejs.org/) installed, open the extracted folder. On Windows, double-click **START-WINDOWS.cmd**. On macOS, double-click **START.command**. On Linux, or from a terminal on any platform, run `node server.mjs`.
3. Open **http://127.0.0.1:5173/** in a desktop browser with WebGL 2 enabled. Keep the terminal open while playing. Press Ctrl+C in that terminal to stop.

If you already have Python 3, you can use its server instead. From the extracted folder run `python3 -m http.server 5173 --bind 127.0.0.1 --directory game` (on Windows use `py -3` in place of `python3`). Then open the same address.

The models, animations, textures and Three.js runtime come with the download. The interface uses fallback fonts when Google Fonts is unavailable. You can play without an account or API key.

## First session

Choose your character, vehicle and starting location. Downtown starts you on foot near your chosen car. Select a trailhead to start in the driver’s seat, or check **Start with a police chase** for an immediate one-star pursuit. **Foot patrols when on foot** lets officers get out and fire Meat Rockets during an on-foot chase.

| Control | Action |
| --- | --- |
| WASD or arrow keys | Walk, steer, accelerate or reverse |
| Shift / Space | Sprint on foot / use the handbrake |
| E | Enter a nearby vehicle or exit at low speed |
| Drag / C | Look around / look back |
| F / V | Toggle the driver’s seat / cycle camera views |
| Hold Tab, select, release | Equip a launcher or switch to empty hands |
| Left click | Fire when armed, or strike a nearby person when unarmed |
| Q / Z | Climb / descend in aircraft |
| R / Esc | Recover when clear of police / pause or start a new session |

Assaulting a civilian adds a wanted star. Separate meters track character and vehicle health. At three stars police set up roadblocks and fire Meat Rockets. At four, a search helicopter joins. At five, up to seven cruisers respond. Break sight with the ground units and helicopter for twelve seconds to clear a five-star chase.

## Run or edit the source

```sh
git clone https://github.com/dantegarcia654/neon-coast.git
cd neon-coast
node server.mjs
```

Edit the JavaScript in `game/src/`, then refresh your browser. The start screen and HUD are in `game/index.html` and `game/style.css`. Models and textures live in `game/assets/`. The server serves the game directory directly, so no build or npm install is needed.

Neon Coast is an independent, AI-assisted prototype. See the [asset credits](CREDITS.md) for authorship and third-party licenses.
