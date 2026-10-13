# Geometry Dash reference research

## User requirements

Research the appearance and operation of the single-player game using only YouTube and trusted sources. Do not download external videos, images, assets, source archives, packages, or saved webpage bodies. Use the existing browser tools for viewing and in-memory observations. Implement drawings and behavior locally; do not obtain commercial assets.

The intended scope includes features usable without game servers. Local creation, testing, and saving remain in scope; online level browsing, accounts, multiplayer, and server-dependent features do not.

## Source access and evidence

No external source content has yet been reviewed for this research pass. Each first request below was rejected by the cloud outbound proxy before returning a page. YouTube and RobTop failed browser navigation with `ERR_TUNNEL_CONNECTION_FAILED`; all four official-site requests failed with proxy `403 Forbidden`.

| Reference | Intended use | Status |
| --- | --- | --- |
| [RobTop YouTube channel](https://www.youtube.com/@RobTopGames) | Official footage, menu and gameplay observations | Blocked |
| [RobTop](https://www.robtopgames.com/) | Publisher information and official reference links | Blocked |
| [Steam listing](https://store.steampowered.com/app/322170/Geometry_Dash/) | Official feature descriptions, screenshots, and trailers | Blocked |
| [Apple App Store listing](https://apps.apple.com/us/app/geometry-dash/id625334537) | Official mobile descriptions and interface references | Blocked |
| [Google Play listing](https://play.google.com/store/apps/details?id=com.robtopx.geometryjump&hl=en_US) | Official Android descriptions and interface references | Blocked |

The required page domains were added to the editable cloud network draft while preserving existing Vercel destinations. Saving that draft does not apply it to this running machine. Any additional media host must be identified from an accessible trusted page before requesting its network access. Streaming in the browser must not become an asset or video download.

## Confirmed local findings

These findings come from the web implementation, rather than newly reviewed commercial-game references:

- The renderer uses a fixed 960 by 600 world. The initial stylesheet stretched it independently to the viewport width and height, visibly distorting geometry on portrait displays. Uniform scaling and letterboxing now correct this defect without changing physics. Local Chromium checks confirmed a 1.6 canvas ratio at 1440×1000, 390×844, and 844×390, with usable HUD controls and successful platformer touch movement in both mobile orientations. These checks saved no screenshots and downloaded no files.
- The interface currently uses a sidebar dashboard and catalog card grid. The exact commercial menu and level-selection layouts still need visual verification.
- Normal and practice progress are stored separately, but catalog cards currently display only normal progress.
- Garage previews round the corners of icons 6–11; the engine draws square outer silhouettes for all cube icons.
- All original courses currently share a navy scenery family. Level color, distinctive decorations, and transition behavior need comparison with actual references before redesign.
- Gameplay physics are original approximations. Their constants are not measured commercial-game constants, despite the successful traversal and regression tests.
- The engine records activated portals for the current attempt. Re-entry behavior when backtracking in platformer mode needs reference verification.
- Platformer completion is recorded and earns an achievement; a separate moon reward system is not implemented.

## Viewing checklist once sources are accessible

1. Identify the referenced game version from an official source. Record the source URL and, for videos, timestamps for each observation.
2. Observe the boot/main menu, logo proportions, background motion, circular controls, icon garage, level selection, difficulty faces, coin indicators, and normal/practice progress presentation.
3. Observe each of the eight movement modes. Distinguish taps from holds, automatic repeated actions, grounded actions, robot jump height, wave slopes, gravity direction, and mini-size behavior. Do not infer exact physics constants from a trailer alone.
4. Check pads and orbs by color, their activation requirements, mode/gravity/size/speed/dual portals, collision behavior, and boundary handling. Separate observed behavior from assumptions.
5. Observe practice checkpoint creation, removal, automatic placement, death recovery, and reward eligibility. Compare normal completion, attempts, collected coins, and completion panels.
6. Observe offline platformer controls, backward movement, checkpoints, pause behavior, completion timing, and rewards.
7. Compare editor placement, selection, transforms, groups/triggers, preview/testing, local save management, and offline options. Mark missing features explicitly rather than calling the current small editor equivalent to the complete commercial editor.
8. Build a verified feature matrix: implemented, different, missing, server-dependent, or not yet verified. Prioritize corrections backed by observations and keep official content separate from original local content.

Prior knowledge suggests that the dashboard, small typography, and card catalog differ substantially from the game's familiar menu style. Those are hypotheses for the visual comparison, not findings from footage viewed during this pass. No claim of full-game parity is supported by the current evidence.
