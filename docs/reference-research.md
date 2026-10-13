# Geometry Dash reference research and implementation status

## Scope and research method

The requested scope is the single-player game and functionality that can run locally, including creation, testing, and saving levels. Online level discovery, accounts, leaderboards, multiplayer, and other server-dependent features are excluded.

Research uses YouTube and trusted sources. No external videos, images, assets, source archives, packages, or webpage bodies were downloaded or saved during this pass. Accessible GitHub HTML pages were read in memory with TLS verification enabled. The app's visuals, courses, sounds, progression tables, and physics remain original implementations.

## Sources actually reviewed

The [Geode bindings repository](https://github.com/geode-sdk/bindings/blob/main/README.md) provides community-maintained class bindings and reconstructed inline definitions. The inspected binding directory targets **2.2081**. This is third-party documentation, not RobTop's complete source code or proof of the latest official release.

| Reviewed reference | Evidence available | Limits |
| --- | --- | --- |
| [Game enums](https://github.com/geode-sdk/bindings/blob/main/bindings/include/Geode/Enums.hpp#L50) | Separate normal/reverse/toggle gravity, dual/solo, mirror, teleport, dash, gravity-dash, and spider objects | Names do not establish exact dimensions, collision rules, or artwork |
| [Icon and speed enums](https://github.com/geode-sdk/bindings/blob/main/bindings/include/Geode/Enums.hpp#L929) | Cube, ship, ball, UFO, wave, robot, spider, swing, and a jetpack icon type; named speed tiers | Jetpack is not evidence of a ninth classic physics mode; numeric speed constants were not obtained |
| [Player movement fields](https://github.com/geode-sdk/bindings/blob/main/bindings/2.2081/inline/PlayerObject.cpp#L338) | Platformer horizontal velocity is distinct from classic player speed; dual-spawn gravity/velocity handling also appears in the inspected file | Core update, jumping, gravity, and mode-dynamics implementations were absent |
| [Input dispatch](https://github.com/geode-sdk/bindings/blob/main/bindings/2.2081/inline/GJBaseGameLayer.cpp#L956) | Timestamped press/release events for jump, left, and right, with player-two selection | Does not provide all input buffering or repeat rules |
| [Linked teleport handling](https://github.com/geode-sdk/bindings/blob/main/bindings/2.2081/inline/GJBaseGameLayer.cpp#L698) | Linked portal and target-group position handling | Exact animation, collision, and velocity preservation need further verification |
| [Local trigger handling](https://github.com/geode-sdk/bindings/blob/main/bindings/2.2081/inline/GJBaseGameLayer.cpp#L350) | Counter arithmetic, delayed group spawning, follow, dynamic movement, gravity, rotation, and stopping sound effects in the inspected file | The web runtime implements a defined subset; it is not the complete trigger catalog |
| [Checkpoint handling](https://github.com/geode-sdk/bindings/blob/main/bindings/2.2081/inline/PlayLayer.cpp#L205) | Latest-checkpoint restoration and separate player records | All native checkpoint fields and platformer completion rules were not established |
| [Editor bindings](https://github.com/geode-sdk/bindings/blob/main/bindings/2.2081/inline/EditorUI.cpp) | Grid snapping and relative-position copying; LevelEditorLayer exposes undo/redo behavior | Does not establish the entire commercial editor's tools or UI |
| [Button documentation](https://github.com/geode-sdk/docs/blob/main/tutorials/buttons.md) | Circular main-menu controls and different button families for categories, creation, and editor actions | Describes Geode/Cocos conventions, not a pixel specification |
| [Popup documentation](https://github.com/geode-sdk/docs/blob/main/tutorials/popup.md) | Shaded alerts, framed backgrounds, and elastic popup entrances | No original textures or fonts were obtained |
| [Positioning documentation](https://github.com/geode-sdk/docs/blob/main/tutorials/positioning.md) | Viewport anchors and bottom-left Cocos coordinates | The web canvas uses its own coordinate system |

## Official sources still blocked

The cloud outbound proxy rejected these requests before their pages or footage could be reviewed:

- [RobTop's YouTube channel](https://www.youtube.com/@RobTopGames) and the [in-game trailer link found in the bindings](https://www.youtube.com/watch?v=k90y6PIzIaE).
- [RobTop's website](https://www.robtopgames.com/).
- [Steam listing](https://store.steampowered.com/app/322170/Geometry_Dash/).
- [Apple App Store listing](https://apps.apple.com/us/app/geometry-dash/id625334537).
- [Google Play listing](https://play.google.com/store/apps/details?id=com.robtopx.geometryjump&hl=en_US).

These destinations are in the editable cloud network draft. Saving a draft does not apply it to the running machine. No video timestamps, screenshot measurements, original physics constants, or official level-layout comparisons are claimed.

## Current feature matrix

“Implemented” means functioning in this repository and locally tested. It does not mean identical to the commercial game.

| Area | Current implementation | Remaining difference or uncertainty |
| --- | --- | --- |
| Main menu and level selection | Saturated geometric background, moving cube and ground, circular controls, paged campaign, original difficulty faces, normal/practice bars, coin indicators | Original vector art and system typography; native spacing, textures, transitions, and exact visual parity are unverified |
| Campaign | 14 original courses, including two platformer courses; three additional remixable mechanics labs | Official levels, official music, and official difficulty/reward tables are absent |
| Movement | Eight classic modes; variable robot jumps, wave direction, gravity flips, mini mode, platformer acceleration/friction, and ship/jetpack presentation | Original physics approximations; exact timings, speeds, slopes, and input tolerances are unmeasured |
| Portals and interactive objects | Explicit gravity/dual/mirror/direction states, speed tiers, per-player forms and sizes, linked/group/coordinate teleports, colored pads/orbs, dash/gravity-dash/spider/teleport/trigger effects | Does not include every native object or prove every color/mode interaction identical |
| Collision and motion | Blocks, spikes, slopes, saws, moving platforms, ground/ceiling behavior, independent dual players | Collision geometry is defined by this engine; arbitrary native-object collision and rotation parity are not established |
| Triggers | Groups; move, rotate, color, alpha, toggle, delayed spawn, pickup counters, follow, gravity, camera, SFX/stop-SFX, end, and pulse; easing and recursion limits | Advanced shaders, complete native camera/animation/music/trigger families, and original serialization are absent |
| Practice and platformer checkpoints | Manual/automatic practice checkpoints, removal, native platformer checkpoint objects, both players and queued runtime state restored; music phase and SFX channel state restored | Audio attack envelopes resume approximately; checkpoint timing and all native fields remain unverified |
| Editor | 13 object categories, grid placement, inspector, multiselection, marquee, groups, linked-target remapping, rotate/flip/nudge/duplicate, undo/redo, local save/import/export, remix, start positions, and reward-free testing | Smaller original editor; complete native object catalog, textures, tools, and file-format compatibility are absent |
| Local progression | Separate normal/practice progress, stars/moons, secret coins, attempts/jumps/time, achievements, earned currencies, 20 shop items, 24 cube icons, colors/trails, v1/v2 save migration and backup | Original finite economy and unlock rules; no official vaults, shops, collectible catalog, secret codes, or full native unlock progression |
| Offline browser support | Self-caching static app, local saves, keyboard/pointer/touch controls, uniform 8:5 canvas scaling, responsive menus and dialogs | Initial load requires HTTPS or localhost; browser storage and platform audio policies apply |
| Server features | Deliberately excluded | Accounts, uploaded-level services, ratings, comments, leaderboards, online challenges, and multiplayer are outside the requested scope |

## Verification evidence

The current automated suite checks portal idempotence, distinct dual states, direction versus mirroring, dash release, linked teleportation, slopes and large saws, moving-platform carry, runtime animation/delayed-spawn restoration, repeatable touch triggers, bounded recursion, independent sound channels, editor-test reward exclusion, save migration, and purchase rollback.

All 14 original campaign courses and all three mechanics labs completed under an engine-driven traversal check. That establishes reachability, not official-game equivalence.

Installed Chromium checks exercise campaign paging/filtering, local cosmetics and purchasing, editor save/undo/redo and actual test completion, retries/pause/practice, modal controls, in-memory save export and import, offline reload, and platformer touch movement at 320px, portrait, and landscape sizes. No external assets, physical downloads, or screenshot files are needed by those checks.

## Further comparison needed

Once official references are reachable, record the game version and video timestamps, measure menu and gameplay presentation, test each tap/hold interaction across modes and object colors, and compare practice/platformer restoration and the offline editor catalog. Replace assumptions only with source-backed observations. Exact 1:1 parity is not supported by the currently available evidence.
