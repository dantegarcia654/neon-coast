# Neon Coast

**[Play Neon Coast in your browser](https://dantegarcia654.github.io/neon-coast/)**

Use a desktop browser with WebGL 2 and a keyboard and mouse. Choose a character and starting vehicle, then enter the city.

A single-player, 3D open-city game for desktop browsers. Play as Jean Philanthrope or Mara Vega. Take a sports car from downtown to the coastal trails, board a boat at East Pier, or fly out over the coast. Five wanted levels bring cruisers, roadblocks, helicopters and officers carrying hot-dog launchers.

## Play on your computer

1. [Download Neon Coast V15](https://github.com/dantegarcia654/neon-coast/archive/refs/tags/v15.0.0.zip) and **extract the entire ZIP**.
2. With [Node.js](https://nodejs.org/) installed, open the extracted folder. On Windows, double-click **START-WINDOWS.cmd**. On macOS, double-click **START.command**. On Linux, or from a terminal on any platform, run `node server.mjs`.
3. Open **http://127.0.0.1:5173/** in a desktop browser with WebGL 2 enabled. Keep the terminal open while playing. Press Ctrl+C in that terminal to stop.

If you already have Python 3, you can use its server instead. From the extracted folder run `python3 -m http.server 5173 --bind 127.0.0.1 --directory docs` (on Windows use `py -3` in place of `python3`). Then open the same address.

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

Hold Tab and press **3** to select **Bombardiro Crocodilo**. Release Tab and click a target. The winged crocodile flies straight and detonates on contact. Nearby pedestrians fall, a direct hit wrecks a civilian vehicle, and police vehicles are disabled for at least eight seconds. The launcher also works from a vehicle. The model is an original interpretation of the [crocodile-plane meme](https://knowyourmeme.com/memes/bombardiro-crocodilo-italian-brainrot).

A light vehicle hit makes a pedestrian stumble. A faster hit knocks them off balance, carries them away from the bumper, and gives them time to get back on their feet. Cars slide along walls on a glancing impact. A square hit transfers more momentum and costs more vehicle health.

## Run or edit the source

```sh
git clone https://github.com/dantegarcia654/neon-coast.git
cd neon-coast
node server.mjs
```

Edit the JavaScript in `docs/src/`, then refresh your browser. The start screen and HUD are in `docs/index.html` and `docs/style.css`. Models and textures live in `docs/assets/`. The local server serves `docs/` directly. GitHub Pages publishes that same folder from `main`. Edits go live after GitHub finishes the Pages deployment.

Neon Coast is an independent, AI-assisted prototype. See the [asset credits](CREDITS.md) for authorship and third-party licenses.
