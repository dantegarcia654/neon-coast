# Neon Coast

**[Play Neon Coast in your browser](https://dantegarcia654.github.io/neon-coast/)**

Use a desktop browser with WebGL 2 and a keyboard and mouse. Choose a character and starting vehicle, then enter the city.

A single-player, 3D open-city game for desktop browsers. Play as Jean Philanthrope or Mara Vega. Take a sports car from downtown to the coastal trails, board a boat at East Pier, or fly out over the coast. Five wanted levels bring cruisers, roadblocks, helicopters and officers carrying hot-dog launchers.

The Quick Getaway route passes the Last Order hot-dog cart. To park nearby and watch the queue and crosswalk, choose **Free Roam → Hot-dog corner**. Listen for the griddle and storefront radio there, or basketballs and sneaker squeaks at the downtown court.

## Play on your computer

1. [Download Neon Coast V21](https://github.com/dantegarcia654/neon-coast/archive/refs/tags/v21.0.0.zip) and **extract the entire ZIP**.
2. With [Node.js](https://nodejs.org/) installed, open the extracted folder. On Windows, double-click **START-WINDOWS.cmd**. On macOS, double-click **START.command**. On Linux, or from a terminal on any platform, run `node server.mjs`.
3. Open **http://127.0.0.1:5173/** in a desktop browser with WebGL 2 enabled. Keep the terminal open while playing. Press Ctrl+C in that terminal to stop.

If you already have Python 3, you can use its server instead. From the extracted folder run `python3 -m http.server 5173 --bind 127.0.0.1 --directory docs` (on Windows use `py -3` in place of `python3`). Then open the same address.

The models, animations, textures and Three.js runtime come with the download. The interface uses fallback fonts when Google Fonts is unavailable. You can play without an account or API key.

## First session

Choose **Quick Getaway** to start in your selected road car with one star and a cruiser in view. Press **W** to accelerate and **A/D** to steer. Lose the cruiser to reveal the coastal delivery.

Choose **Free Roam** to start downtown on foot, select a trailhead, or take a boat or aircraft from its station. Free Roam also offers the optional chase start and foot-patrol setting. Both modes load your chosen lead and vehicle first. The rest of the roster loads during play.

| Control | Action |
| --- | --- |
| WASD or arrow keys | Walk, steer, accelerate or reverse |
| Shift / Space | Sprint on foot / use the handbrake |
| E | Pull a driver out, enter an empty vehicle, or exit at low speed |
| Drag / C | Look around / look back |
| F / V | Toggle the driver’s seat / cycle camera views |
| Hold Tab, select, release | Equip a launcher or switch to empty hands |
| J (on foot) / hold Space (unarmed) | Punch or swing the equipped hammer / guard against punches |
| Left click | Fire a launcher, swing the hammer, or punch with empty hands |
| Q / Z | Climb / descend in aircraft |
| R / Esc | Recover when clear of police / pause or start a new session |

Assaulting a civilian adds a wanted star. Separate meters track character and vehicle health. At three stars police set up roadblocks and fire Meat Rockets. At four, a search helicopter joins. At five, up to seven cruisers respond. Break sight with the ground units and helicopter for twelve seconds to clear a five-star chase.

Hold Tab and press **3** to select **Bombardiro Crocodilo**. Release Tab and click a target. The winged crocodile flies straight and detonates on contact. Nearby pedestrians fall, a direct hit wrecks a civilian vehicle, and police vehicles are disabled for at least eight seconds. The launcher also works from a vehicle. The model is an original interpretation of the [crocodile-plane meme](https://knowyourmeme.com/memes/bombardiro-crocodilo-italian-brainrot).

Hold **Tab**, press **4**, and release **Tab** to equip the **Chimpanzini Bananini** hammer. On foot, press **J** or click a nearby opponent to swing. The green chimp and curled banana peel form the mallet head. Each hit deals twice the damage of a punch, with a slower recovery between swings.

Close the distance for a fistfight. Punches alternate hands and land at full extension. Face your opponent and hold **Space** to block. Heavy finishing blows knock opponents off their feet. A Crocodilo blast can send a nearby pedestrian tumbling or shove a moving wreck along the street. Solid scenery shields actors from splash damage.

Traffic drivers have individual temperaments. Cautious drivers brake and honk when you stand in their lane. Aggressive drivers can knock you down. Press **E** near occupied traffic to pull the driver out. You stay on foot while the driver flees or confronts you. Press **E** again to take the car. With empty hands, click an opponent or press **J** to punch, or hold **Space** to block.

A finishing punch buckles the opponent's knees. A bumper sweeps the legs and carries the body along the road. A close explosion lifts the whole figure and sends the limbs outward. The ground supports the head and torso as the elbows, hands, knees and feet settle. Another car can redirect someone who is already down. Cars slide along walls on a glancing impact. A square hit transfers more momentum and costs more vehicle health.

## Run or edit the source

```sh
git clone https://github.com/dantegarcia654/neon-coast.git
cd neon-coast
node server.mjs
```

Edit the JavaScript in `docs/src/`, then refresh your browser. The start screen and HUD are in `docs/index.html` and `docs/style.css`. Models and textures live in `docs/assets/`. The local server serves `docs/` directly. GitHub Pages publishes that same folder from `main`. Edits go live after GitHub finishes the Pages deployment.

Neon Coast is an independent, AI-assisted prototype. See the [asset credits](CREDITS.md) for authorship and third-party licenses.

### Fartaculous encounter (feature branch)

Leave **Fartaculous monster chase** checked on the start screen to meet the giant green-and-yellow, double-butt monster. He chases you, turns around to wind up, then releases two gas clouds and summons Diarrhea Pookie. Sprint clear of the clouds or get into a vehicle for protection. Existing melee and launcher hits can defeat both monsters. Turn the checkbox off for an ordinary session.

### Ocean stunt roads and Cactus Crossing (feature branch)

Choose **Free Roam → Start location → Ocean stunt road**, then enter Free Roam. The gateway also connects to the east end of the city's northern waterfront avenue (x 164, z −144).

Hold **W** to accelerate, **S / Space** to brake, and **A / D** to move across the magnetic road. Before the fork, use **1** for Tidal Slalom (weaving bends and boost strips), **2** for Sky Loop (a full vertical loop), or **3** for Corkscrew Run (a twisting barrel-roll road). Magnetic grip keeps the vehicle attached through inverted sections. All three branches merge at a desert island with cacti, colorful houses, a plaza, festival flags, and a stepped sun tower: **Cactus Crossing**.

At the island, normal driving resumes. Slow down and press **E** to explore on foot. Get back into a car and press **R** to return to the fork and try another route. The route HUD tracks which branches you've completed. Exotic aircraft and boats use their existing launch locations; the stunt start requires a road car.
