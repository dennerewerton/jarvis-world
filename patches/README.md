# Jarvis patches for upstream Webaverse

Apply these patches after initializing `webaverse/app` at the recorded upstream
commit and before running the standalone runtime:

```text
git -C webaverse/app apply ../patches/0001-disable-legacy-web3-bootstrap.patch
git -C webaverse/app apply ../patches/0002-disable-retired-preauthenticator.patch
git -C webaverse/app apply ../patches/0003-vite2-html-comment-compat.patch
git -C webaverse/app apply ../patches/0004-disable-retired-voice-catalog.patch
git -C webaverse/app apply ../patches/0005-disable-web3-wallet-autologin.patch
git -C webaverse/app apply ../patches/0006-local-preview-and-no-wallet-iframe.patch
git -C webaverse/app apply ../patches/0007-add-local-baseline-scene.patch
git -C webaverse/app apply ../patches/0008-add-stable-local-baseline-world.patch
git -C webaverse/app apply ../patches/0009-localize-visible-ui-pt-br.patch
git -C webaverse/app apply ../patches/0010-add-discord-activity-shell.patch
git -C webaverse/app apply ../patches/0011-default-to-local-baseline-scene.patch
git -C webaverse/app apply ../patches/0012-preserve-vite-request-paths.patch
git -C webaverse/app apply ../patches/0013-add-jarvis-read-only-bridge.patch
git -C webaverse/app apply ../patches/0014-disable-production-vite-prebundle.patch
git -C webaverse/app apply ../patches/0015-fix-pt-br-regexes.patch
git -C webaverse/app apply ../patches/0016-retry-transient-runtime-import.patch
git -C webaverse/app apply ../patches/0017-vendor-lore-model.patch
git -C webaverse/app apply ../patches/0018-disable-legacy-web3-runtime.patch
git -C webaverse/app apply ../patches/0019-stabilize-runtime-startup.patch
git -C webaverse/app apply ../patches/0020-disable-pilot-offscreen-previews.patch
git -C webaverse/app apply ../patches/0021-restore-vendored-street-scene.patch
git -C webaverse/app apply ../patches/0022-game-only-shell.patch
git -C webaverse/app apply ../patches/0023-restore-stable-local-baseline-scene.patch
git -C webaverse/app apply ../patches/0024-enhance-stable-local-plaza.patch
git -C webaverse/app apply ../patches/0025-replace-test-plaza-with-local-city.patch
git -C webaverse/app apply ../patches/0026-lock-final-gameplay-controls.patch
git -C webaverse/app apply ../patches/0027-social-parkour-runtime.patch
git -C webaverse/app apply ../patches/0028-integrate-ithappy-cartoon-city.patch
git -C webaverse/app apply ../patches/0029-guard-cartoon-city-runtime.patch
git -C webaverse/app apply ../patches/0030-preload-jarvis-plaza-sectors.patch
git -C webaverse/app apply ../patches/0031-fix-plaza-ground-z-fighting.patch
git -C webaverse/app apply ../patches/0032-social-hud-and-remove-crosshair.patch
git -C webaverse/app apply ../patches/0033-remove-hidden-editor-and-target-inputs.patch
git -C webaverse/app apply ../patches/0034-prune-social-runtime-dependencies.patch
git -C webaverse/app apply ../patches/0048-shared-jarvis-city-multiplayer-room.patch
git -C webaverse/app apply ../patches/0049-render-remote-avatars-without-voice.patch
git -C webaverse/app apply ../patches/0050-show-remote-player-presence-fallback.patch
git -C webaverse/app/packages/totum apply ../../../patches/totum/0001-vite2-html-comment-compat.patch
```

`0001-disable-legacy-web3-bootstrap.patch` is intentionally narrow. It removes
only the two remote contract-config imports that prevent the historical runtime
from booting when the retired Webaverse contract service is unavailable. It
does not implement a replacement wallet, contract, balance, ownership store,
RPC call or transaction path. Jarvis remains the sole authority for all such
state.

`0007-add-local-baseline-scene.patch` adds the declarative scene entry.
`0008-add-stable-local-baseline-world.patch` adds the local, code-only baseline
module: a collision floor, plaza, and static landmarks. It avoids the retired
street shader path for acceptance testing while leaving the vendored historical
street packages available for later comparison. It executes through the
upstream Webaverse module loader and does not replace its renderer, player,
camera, animation, or physics runtime.

`0009-localize-visible-ui-pt-br.patch` installs an isolated Portuguese (Brazil)
presentation layer before the React UI mounts. It covers the visible HUD, action
menu, settings, world list, inventory labels, loading states, and radial-emote
labels without translating command values, asset IDs, storage keys, API values,
or player data.

`0010-add-discord-activity-shell.patch` makes the root document the authenticated
Discord Activity entry point. It performs the existing Jarvis health, Discord
OAuth, backend exchange, Guild Access Gate, short-session validation and WebGL
checks before dynamically importing the Webaverse runtime. It also keeps a
development-only `/standalone` route and changes the production realtime client
to use same-origin `/worlds/`, which becomes `wss://` through the HTTPS proxy.

`0011-default-to-local-baseline-scene.patch` makes the deterministic local
Jarvis scene the first runtime scene. The historical remote street scene stays
available, but is no longer loaded implicitly after Activity authentication.

`0012-preserve-vite-request-paths.patch` keeps the original request URL intact
while the security-header middleware runs. Express otherwise consumes the full
path at `app.use('*', ...)`, so Vite receives `/` for module requests and the
Discord iframe stays blank even though the root HTML itself returns HTTP 200.

`0013-add-jarvis-read-only-bridge.patch` implements the narrow FW-5 read-only
adapter for current user, profile, wallet, inventory and shop. FW-6 consumes
the verified current user/profile/wallet snapshot in React context and replaces
the legacy Webaverse wallet-login control with Jarvis display name, avatar and
canonical balance. No method accepts a user id or exposes a mutation.

`0014-disable-production-vite-prebundle.patch` keeps Vite only as the legacy
module transformer in production. It bypasses the historical project-wide Vite
configuration while retaining the required `metaversefile` loader, serves the
approved HTML entry documents directly, disables HMR and the full-project
dependency scan, and prebundles only React, ReactDOM, the Discord SDK and the
seven dependencies discovered by the first authenticated Webaverse graph. This
prevents Vite from changing its dependency hash during the first Activity
import, avoids exhausting Square runtime memory and retains the CommonJS
interoperability required by React 17.

`0015-fix-pt-br-regexes.patch` corrects over-escaped regular expressions in
the isolated localization layer. The fix prevents an empty DOM text node from
aborting Activity startup and restores patterned translations.

`0016-retry-transient-runtime-import.patch` retries only transient module-fetch
failures with bounded delays and versioned URLs. This lets the legacy Vite
optimizer finish its first authenticated module graph behind the Discord proxy
without bypassing the Activity shell or hiding permanent runtime errors.

`0017-vendor-lore-model.patch` copies the pinned upstream lore model into the
runtime so executable JavaScript never has to cross the Activity CSP boundary.
The vendored source is byte-identical to the public module previously re-exported
from `webaverse.github.io` (SHA-256
`5b14a806ae29725def193a5e571d027867ff8262318d75a4b8e88d43beaa6407`).

`0018-disable-legacy-web3-runtime.patch` removes the remaining eager imports of
the retired Web3 bundle and makes the unused compatibility hook return `null`.
It also permits only WebAssembly compilation through `wasm-unsafe-eval`; generic
JavaScript `unsafe-eval`, remote scripts, wallets and transaction paths remain
disabled.

`0019-stabilize-runtime-startup.patch` keeps the retired remote particle catalog
inactive for the self-hosted baseline, routes startup through a named inert
particle manager and makes unavailable particle textures fail only when
explicitly requested. It also fixes the upstream infobox cleanup identifier so
React can safely unmount the first rendered interface. The Activity boundary
uses a versioned `webaverse.js` import to invalidate the historical fatal module
response without duplicating the singleton `metaversefile-api.js` registration.

`0020-disable-pilot-offscreen-previews.patch` preserves the animated portrait
and remote equipment-preview APIs with inert pilot facades. These optional UI
previews therefore remain on their existing placeholders instead of starting
the historical offscreen inline-module loader, while the main 3D avatar,
renderer, physics, world and authenticated Jarvis HUD remain unchanged.

`0021-restore-vendored-street-scene.patch` trialed the local vendored Street,
Street Base, and Skybox modules as the default Jarvis scene. The follow-up
`0023-restore-stable-local-baseline-scene.patch` restores the local baseline
after the vendored street renderer produced a blank canvas in production.

`0022-game-only-shell.patch` removes the public editor and diagnostics controls:
world/object controls, settings, mode and VR controls, map generation, drag and
drop imports, the build marker, and FPS stats. Gameplay controls and the
authenticated Jarvis interface remain available.

`0024-enhance-stable-local-plaza.patch` turns the compatibility plaza into a
complete local night-time hub: a sky dome, paved boulevards, fountain, city
facades, parks, lamps and benches. It remains dependency-free and keeps the
single floor collider used by the stable baseline.

`0025-replace-test-plaza-with-local-city.patch` replaces the compatibility
plaza with the approved local Jarvis City assets. The bootstrap copies the
versioned GLBs into the pinned runtime's public assets before it starts.

`0026-lock-final-gameplay-controls.patch` closes the historical editor paths:
scene transforms, object drag/drop, generic object grabbing, object deletion,
scene export and edit mode. Avatar movement, camera controls, jumping and use
of equipped items stay available as normal gameplay.

`0027-social-parkour-runtime.patch` turns the pilot into a social-and-parkour
world. It removes the combat/monster/quest/health update loops, weapon and
magic input paths, RPG HUD, hotbar, inventory panels and legacy story UI from
the loaded runtime graph. Chat, emotes, the Jarvis identity, avatar movement,
camera controls, collision and jumping remain available.

`0028-integrate-ithappy-cartoon-city.patch` makes the licensed ITHappy Cartoon
City Free demo derivative the production scene. It first loads the actual demo
plaza sector, streams the remaining 11 sectors by player distance, keeps the
old Kenney scene as a non-default rollback, and uses one ground plus six coarse
building colliders instead of thousands of static physics objects. The module
contains only visual POI markers: it does not duplicate or mutate Shop, Daily,
wallet, inventory, reward or fast-travel authority.

`0029-guard-cartoon-city-runtime.patch` contains a circuit breaker around the
sector-streaming frame handler. An unexpected asset/renderer failure is logged
and stops only further city streaming; it cannot unmount the authenticated
Activity shell or invalidate the Jarvis session.

`0030-preload-jarvis-plaza-sectors.patch` keeps the original sectorized city,
but waits for the Plaza and its four immediate neighbours before the player is
shown. It also treats an early, unbound player transform as transient, so a
first-frame timing race cannot permanently stop later distance streaming.

`0031-fix-plaza-ground-z-fighting.patch` places the visual fallback ground
below the ITHappy road and plaza geometry. The separate physics ground remains
at the walking surface, preventing camera-dependent flicker without changing
player collisions.

`0032-social-hud-and-remove-crosshair.patch` removes the combat reticle and
adds a small social HUD with Chat, Emotes and Controls. Chat uses the existing
chat panel; Emotes opens the existing radial emote menu without adding combat,
inventory or a second state system.

`0033-remove-hidden-editor-and-target-inputs.patch` disables the remaining
legacy editor/debug shortcuts and all aim/targeting input paths, including
Brazilian keyboard quote/tilde mappings and the right/middle mouse paths.

`0034-prune-social-runtime-dependencies.patch` removes the unused legacy
music and target-manager modules from the production startup dependency graph.

`0035-prune-social-loadout-runtime.patch` replaces the legacy loadout manager
in the production graph with a tiny inert social facade. This removes the
hotbar, inventory, object-sprite and infobox renderer imports while retaining
safe no-op compatibility for historical game-manager calls. Avatar skins and
wearable character appearance remain handled by the avatar system.

`0036-prune-social-story-and-npc-controls.patch` removes the legacy story
wheel interceptor and NPC-possession shortcut from the production input path.
Mouse-wheel camera zoom remains available. This does not remove avatar skins
or the avatar appearance pipeline.

`0037-refine-jarvis-social-hud.patch` gives the social HUD a compact Jarvis
City visual treatment using local JSX and CSS only: branded surface, social
status, CSS-drawn action icons, clear active states and responsive sizing. It
introduces no image requests, game state, economy action or per-frame work.

`0038-separate-social-arena-from-city.patch` relocates the non-combat Arena
marker from a Cartoon City block to a separate south exterior at `[0, 0.02,
-108]`. The static ground/collider expands only enough to support that social
and parkour destination; it does not load a second city or a combat arena.

`0040-stabilize-city-streaming-and-static-colliders.patch` makes streamed
sectors persistent for the current world entry and admits at most one nearest
sector every 250 ms. It eliminates the walk-time GPU disposal/reload churn that
could stall the renderer or place the follow camera inside a facade. The city
now uses 31 cheap static box colliders for buildings, fountains, parked cars
and bus shelters; small vegetation and street decoration remain non-collidable.
There are no dynamic rigid bodies or mesh colliders.

`0041-enforce-safe-city-spawn-and-visible-hud.patch` moves the default spawn
to the open road beside Jarvis Plaza and reapplies it after the initial five
sectors plus their colliders are ready. This closes the upstream asynchronous
spawnpoint race that could begin the camera inside a facade. It also adds an
unambiguous EXPLORE / SOCIAL / PARKOUR status strip to the local HUD.

`0042-force-clear-legacy-aim-markers.patch` consumes right-button input for
the social world and removes any retained legacy `aim` action on press and
release. This removes the old combat target-reticle geometry without affecting
left-button interaction or camera movement.

`0043-premium-social-city-hud.patch` replaces the compact bottom panel with a
responsive, CSS-only Jarvis City social HUD: a local identity/status card, the
existing Chat/Emotes/Guide actions, a chat entry affordance and non-interactive
run/jump hints. It adds no images, fonts, requests, state, economy, inventory,
XP, quests or combat controls.

`0044-harden-city-physics-and-map-recovery.patch` closes the four physical
edges of the 240-metre support slab, safely returns a player who falls or
escapes the authored map to the verified Plaza road spawn, and retries transient
sector downloads with a bounded policy. It keeps the 31 primitive city
colliders and does not introduce mesh colliders, dynamic bodies or per-object
frame loops.

`0045-disable-target-reticle-renderer.patch` retires the combat target-reticle
at its renderer boundary. The compatibility module returns an invisible empty
object with an inert `setReticles` method, creates no geometry or shader and
registers no frame callback. This guarantees that right-button input or stale
session state cannot bring the triangular combat markers back.

`0046-reference-social-dashboard-hud.patch` replaces the interim compact HUD
and duplicate header with a responsive Jarvis City dashboard based on the
approved visual reference. It uses the authenticated Jarvis identity and wallet
balance, the existing Chat and Emotes paths, on-demand read-only Shop and Daily
requests, a lightweight map/guide surface and CSS-only decoration. It does not
restore inventory, XP, items, weapons, combat or client-authoritative rewards.

`0047-restore-plaza-ground-and-sector-visibility.patch` restores the full
3×3 Plaza visual ring before spawn and applies the culling exception only to
authored `road_` and `Set_` walking roots. The same roots retain normal opaque
depth behavior and double-sided visibility; buildings and decorative props keep
normal frustum culling. Cars remain on their authored pivots, while development
validation warns about a missing surface, invalid bounds or an implausible
vehicle ground offset without adding a production debug HUD or a per-frame
raycast.

`0048-shared-jarvis-city-multiplayer-room.patch` makes the authenticated
Activity enter the singleton `jarvis-city` room and seeds that room from the
same Cartoon City scene used by the local runtime. Every authenticated player
therefore receives the same shared CRDT world and the existing Webaverse remote
player renderer/interpolation shows the other connected avatars. The standalone
development entry retains its historical scene and room tooling.

`0049-render-remote-avatars-without-voice.patch` makes voice metadata optional
when a remote player is initialized. A missing or malformed legacy voice
descriptor is ignored, so avatar loading and realtime transform interpolation
continue normally.

`0050-show-remote-player-presence-fallback.patch` makes the already replicated
remote-player position visible immediately. A lightweight cyan marker is shown
at the initial transform and follows later updates until the full avatar is
ready; it is removed when the player leaves.

`0002-disable-retired-preauthenticator.patch` replaces an unavailable remote
settings helper with an inert local facade. It is unrelated to Jarvis session
authentication and only disables the legacy optional external AI-key settings.

`0003-vite2-html-comment-compat.patch` and its ordered `totum/` companion
remove a less-than sign from the two copies of a dead JavaScript comment that
the historical Vite HTML transform mistakes for markup. The companion is
applied in the pinned nested `packages/totum` checkout.

Apply the queue in a direct checkout of the recorded commit. The workspace may
expose that checkout through a junction for local testing, but the Git
submodule remains the reproducible source of record.

The automated Linux and Square Cloud installers pass `--ignore-space-change`
to `git apply` because the pinned upstream commit contains a mixed LF/CRLF
history. Patch text and non-whitespace context must still match; this flag only
keeps platform line endings from invalidating an otherwise exact patch.

`0004-disable-retired-voice-catalog.patch` leaves the legacy voice catalog
empty. Discord remains the Activity's voice provider; no parallel microphone,
voice service or remote Webaverse catalogue is initialized.

`0005-disable-web3-wallet-autologin.patch` removes the unauthenticated
MetaMask auto-login probe. It does not log a user in; the future Activity shell
will populate identity only from a verified Jarvis session.

`0006-local-preview-and-no-wallet-iframe.patch` serves the upstream offscreen
preview page from the current runtime origin and prevents the retired wallet
iframe from being created. It changes no wallet, balance, inventory or session
state.
