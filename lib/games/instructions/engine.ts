import type { SystemModelMessage } from "ai"

/**
 * Le kit 3D livré dans chaque partie (`lib/games/runtime`) : conventions,
 * squelette complet et référence d'API compacte. Le détail des options est
 * dans le JSDoc de chaque fichier du kit, que l'agent peut lire lui-même
 * (`read_file`) : ce message se limite aux noms, aux conventions et aux pièges.
 *
 * Toute fonction ou méthode citée ici doit exister dans le kit : à revérifier
 * (exports de `lib/games/runtime/kit.js`) quand le kit change.
 */
export const engineInstructions: SystemModelMessage = {
  role: "system",
  content: `# Game toolkit (Three.js)

Every game directory ships with a tested 3D toolkit. Build on it instead of writing engine code from scratch: it is faster, consistent, and far less likely to contain bugs you cannot see.

## Layout

- \`kit.js\`: one import for everything: \`import { createGame, box, createHud } from "./kit.js"\`. Three.js itself: \`import * as THREE from "three"\`.
- \`main.js\`: the game's entry point, loaded by \`index.html\`. A new game starts with a welcome scene (a spinning cube) in it: replace the file completely with the game.
- \`engine/\` loop, environment, physics, audio, particles, utilities. \`controls/\` input and cameras. \`hud/\` interface. \`animations/\` tweens, springs, "juice", camera effects. \`models/\` procedural models, terrain, levels. \`vendor/three/\` Three.js.
- Every toolkit file starts with a JSDoc comment listing its options. When unsure about an option, \`read_file\` that one file (for example \`controls/third-person.js\`) instead of guessing. Never read or list \`vendor/\` (it is huge).
- Treat the toolkit folders as read-only: build on them from \`main.js\` and your own files. Edit one only to fix a real bug in it, and tell the user.
- You cannot create images, 3D models or sounds (\`write_file\` writes text only). Use the procedural models, canvas textures (\`checkerTexture\`, \`gridTexture\`, \`textTexture\`, \`noiseTexture\`, \`gradientTexture\`) and synthesized audio (\`createAudio\`).

## Conventions

- Units are meters, +Y is up. Cameras look toward -Z by default; "up" on screen in top-down view is -Z.
- Models (characters, animals, props, \`car\`) have their origin at the feet and face **+Z**. \`spaceship\` and \`airplane\` are centered on their origin. Pickups (\`coin\`, \`gem\`, \`heart\`, \`star\`) float 0.8 above their origin. \`platform\` has its origin at the bottom center: its top is at \`size[1]\`.
- Colors: a palette name (\`orange\`, \`amber\`, \`yellow\`, \`lime\`, \`green\`, \`grass\`, \`forest\`, \`teal\`, \`cyan\`, \`sky\`, \`blue\`, \`navy\`, \`purple\`, \`pink\`, \`red\`, \`crimson\`, \`white\`, \`cream\`, \`silver\`, \`gray\`, \`stone\`, \`dark\`, \`black\`, \`brown\`, \`wood\`, \`sand\`, \`gold\`, \`skin\`, \`water\`), a CSS string (\`"#ea580c"\`, \`"hotpink"\`) or a hex number. An unknown name throws.
- \`dt\` is in seconds. Game time stops while paused (\`dt\` is 0); use \`game.time.realDelta\` for animations that must run during a pause.
- Loop hooks, each returns an unsubscribe function: \`game.onUpdate((dt, game) => ...)\` for gameplay and animation; \`game.onFixedUpdate((step) => ...)\` for physics only; \`game.onLateUpdate\` runs after all updates (cameras); \`game.onFrameEnd\` runs just before rendering.
- Read input in \`onUpdate\`, never in \`onFixedUpdate\` (a fixed step can run zero or two times per frame).
- An exception inside a hook is caught and logged once; the game keeps running. A bug therefore often looks like "nothing happens": re-read your code carefully.

## Complete skeleton (third-person game)

\`\`\`js
import * as THREE from "three"
import {
  createGame, createEnvironment, createPhysics, createInput, createTouchControls,
  createThirdPersonController, createAnimator, createAudio, createHud, createCharacter,
  createGround, coin, tree, scatter, distanceXZ,
} from "./kit.js"

const game = createGame()
const env = createEnvironment(game, "day")            // sky, fog, sun with shadows, lights
game.add(createGround({ size: 200, color: "grass" }))
game.add(scatter(() => tree(), { count: 30, area: [80, 80], minDistance: 5, avoid: [{ x: 0, z: 0, radius: 8 }] }))

const anim = createAnimator(game)
const audio = createAudio()
const input = createInput(game)
createTouchControls(game, input)                       // joystick + jump button, phones only

const world = createPhysics({ gravity: 25 })
const hero = createCharacter({ shirt: "orange" })
game.add(hero)
const body = world.createBody({ position: new THREE.Vector3(0, 0, 0), size: [0.6, 1.8, 0.6], mesh: hero })
game.onFixedUpdate((step) => world.step(step))

const player = createThirdPersonController(game, input, { object: hero, body })
game.onUpdate((dt) => hero.animate(dt, player.speed, { grounded: body.grounded }))
game.onLateUpdate(() => env.follow(hero.position))     // keeps shadows sharp around the player

const hud = createHud(game)
const score = hud.stat({ label: "Score", value: 0 })
const coins = Array.from({ length: 10 }, (_, i) => {
  const c = coin()
  c.position.set(Math.cos(i) * 12, 0, Math.sin(i) * 12)
  anim.spin(c, { speed: 3 })
  game.add(c)
  return c
})
game.onUpdate(() => {
  for (const c of coins) {
    if (!c.parent || distanceXZ(c.position, hero.position) > 1.2) continue
    game.remove(c)
    score.add(10)
    audio.sfx.coin()
    hud.toast("+10", { kind: "success" })
  }
})
\`\`\`

## Reference (names and essentials; details are in the JSDoc of each file)

**Game** \`createGame({ background, camera: "perspective"|"orthographic", fov, orthoSize, shadows, bloom: false|{ strength, radius, threshold }, toneMapping, maxPixelRatio, fixedStep })\`. Members: \`scene\`, \`camera\`, \`renderer\`, \`canvas\`, \`width\`, \`height\`, \`aspect\`, \`time { delta, elapsed, realDelta, scale }\`, \`paused\`, \`events { on, once, off, emit }\`, \`add/remove\`, \`pause/resume/togglePause\`, \`setTimeScale\`, \`setBackground\`, \`setBloom\`, \`setCamera\`, \`dispose\`.

**Environment** \`createEnvironment(game, "day"|"sunset"|"night"|"neon"|"space", { shadowSize })\` returns \`{ sun, hemi, sky, follow(pos), setPreset(name) }\`. Also \`createSky\`, \`createLights\`, \`setFog(game, color|null, near, far)\`.

**Physics** \`createPhysics({ gravity, ground: number | (x, z) => y })\`: \`addSolid(box3 | object)\`, \`createBody({ position (feet), size: [w, h, d], mesh, drag })\` gives a body \`{ position, velocity, grounded, jump(height) }\`, \`step(dt)\` inside \`onFixedUpdate\`. Bodies are boxes; solids are axis-aligned boxes (add static objects after positioning them). Set a body's \`position\`, not its mesh's.
**Collision** \`boxOf(object)\`, \`boxAt(center, [w,h,d])\`, \`boxesOverlap\`, \`spheresOverlap(cA, rA, cB, rB)\`, \`distanceXZ(a, b)\`, \`objectsOverlap\`, \`raycast(origin, dir, targets, maxDist)\`, \`raycastFromCamera(game, targets, x?, y?)\`.

**Input** \`createInput(game, { bindings })\`: \`down/pressed/released("jump")\`, \`move {x, y}\` (WASD, ZQSD, arrows, gamepad, touch), \`look\`, \`wheel\`, \`pointer { x, y, ndc }\`, \`keyDown("KeyE")\`, \`bind("dash", ["KeyQ", "Pad3"])\`. Default actions: \`jump\` (Space), \`sprint\` (Shift), \`fire\` (left click, J), \`aim\` (right click), \`interact\` (E), \`action\` (Enter), \`pause\` (Esc, P). \`createTouchControls(game, input, { buttons: [{ action, label }] })\`.
**Camera controllers** (each takes over \`game.camera\`; use only one): \`createFirstPersonController(game, input, { object?, body?, speed, jumpHeight, eyeHeight })\`, \`createThirdPersonController(game, input, { object, body, distance, speed, jumpHeight })\` (exposes \`.speed\`), \`createTopDownController(game, input, { object, faceMouse, cameraDistance, cameraAngle })\` (exposes \`.aim\`, \`.aimDirection\`), \`createSideScrollerController(game, input, { object, body, jumpHeight, lockZ })\` (coyote time, jump buffer, variable jump), \`createOrbitCamera(game, { target, distance, pan, autoRotate })\`. All have \`.enabled\`, \`.mover\` (\`jump\`, \`teleport(x, y, z)\`, \`grounded\`) and \`.dispose()\`. For a custom camera (driving, flying), create no controller and position \`game.camera\` in \`game.onLateUpdate\` with \`damp\`.
**Picking** \`createPicker(game, { objects | () => objects, onClick(hit), onHover(hit, previous) })\` (\`hit.target\`, \`hit.point\`), \`pointerOnPlane(game, input, y)\`.

**HUD** \`createHud(game)\` (positions: \`top-left|top-center|top-right|bottom-left|bottom-center|bottom-right\`; keep info at the top, phones' controls use the bottom corners): \`stat({ label, value, position })\` (\`set/add\`), \`bar({ label, value, max, color })\` (\`set/add/setMax\`), \`timer({ countdown, autoStart, onEnd })\` (\`start/stop/reset/addTime\`), \`crosshair()\`, \`toast(text, { kind })\`, \`message(text)\`, \`flash(color)\`, \`attach(object3d, text|element)\`, \`floatingText(position, text)\`, \`minimap({ target, points: () => [{ object, color }] })\`, \`fps()\`, \`titleScreen({ title, subtitle, button, onStart })\`, \`pauseMenu({ resumeLabel, buttons })\` (\`toggle()\`, pauses the game), \`gameOverScreen({ title, lines, onRestart })\` (\`show()\`, \`setLines([...])\`), \`screen({ title, subtitle, lines, buttons })\`.

**Animation** \`createAnimator(game)\`: tweens \`to(target, props, { duration, delay, ease, loop, yoyo, onComplete })\`, \`from\`, \`value(from, to, fn, opts)\`, \`wait(s)\`, \`sequence([() => tween, ...])\`, \`killTweensOf(obj)\`; every tween has a \`.finished\` promise. Props can be nested (\`{ position: { y: 3 } }\`), \`scale: 2\` scales all axes, colors tween too. Easings: \`"linear"\`, \`"outCubic"\` (default), \`"inOutSine"\`, \`"outBack"\`, \`"outElastic"\`, \`"outBounce"\`… (\`in|out|inOut\` + \`Quad|Cubic|Quart|Expo|Sine|Circ|Back|Elastic|Bounce\`). \`spring(value)\` / \`spring3(vector3)\`. Continuous (return \`{ stop() }\`): \`spin\`, \`float\`, \`pulse\`, \`orbit\`, \`flicker\`, \`billboard\`, \`follow\`. Game feel: \`popIn\`, \`popOut\`, \`squash\`, \`hitFlash\`, \`hop\`, \`fadeTo\`, \`wobble\`. Camera: \`shake(0..1)\`, \`punchFov\`, \`hitStop\`, \`slowMotion\`. Skinned models: \`controller(model, clips)\` with \`play\`, \`playOnce\`, \`locomotion\`.
**Also in engine/** \`createAudio()\`: \`sfx.click|jump|coin|shoot|hit|explosion|powerup|win|lose()\`, \`music.play([220, 277, 330], { tempo })\`, \`toggleMute()\` (sound starts after the player's first click or key). \`createParticles(game)\`: \`emit\`, \`explosion(pos)\`, \`sparks(pos)\`, \`dust(pos)\`. \`createPool({ create, reset, release, size })\` (\`spawn/despawn/forEach\`) for bullets, enemies, effects. \`createStateMachine({ menu: {...}, playing: {...} }, "menu")\` (\`go\`, \`update\`, \`state\`). \`createRandom(seed)\` (\`range\`, \`int\`, \`chance\`, \`pick\`, \`shuffle\`). Math: \`clamp\`, \`lerp\`, \`remap\`, \`damp(current, target, lambda, dt)\`, \`dampAngle\`, \`wrapAngle\`, \`moveToward\`.

**Models** (all accept \`{ color, position, rotation, scale, metalness, roughness, emissive, opacity }\` where relevant).
- Shapes: \`box(w, h, d, opts)\`, \`sphere(r)\`, \`cylinder(rTop, rBottom, h)\`, \`cone(r, h)\`, \`capsule(r, length)\`, \`torus(r, tube)\`, \`plane(w, d)\` (horizontal), \`group([...])\`, \`mesh(geometry, opts)\`, \`mat(color, opts)\`.
- Characters (\`.animate(dt, speed, { grounded })\`, \`.attack()\`, \`.parts\`): \`createCharacter({ height, style: "human"|"robot", shirt, pants, skin, hair, hat, accent })\`, \`createSlime({ color, size })\`, \`createQuadruped({ type: "dog"|"cat"|"cow"|"pig" })\`.
- Props: \`tree({ variant: "round"|"pine"|"tall", height, seed })\`, \`rock\`, \`bush\`, \`flower\`, \`mushroom\`, \`house\`, \`fence\`, \`crate\`, \`barrel\`, \`coin\`, \`gem\`, \`heart\`, \`star\`, \`chest\` (\`setOpen(0..1)\`), \`lampPost({ light: true })\`, \`platform({ size, color, top })\`, \`spikes\`, \`flag\` and \`portal\` (\`.animate(dt)\`), \`sign({ text })\`.
- Vehicles: \`car({ color })\` (\`.animate(dt, speed, steer)\`), \`spaceship\` (\`.setThrust(0..1)\`, \`.animate(dt)\`), \`airplane\` (\`.animate(dt, throttle)\`).
- World: \`createGround({ size, color, checker: [c1, c2] })\`, \`createTerrain({ size, height, seed, flatRadius })\` returns \`{ mesh, heightAt(x, z) }\` (pass \`heightAt\` as physics \`ground\`), \`createWater({ size, y })\` (\`.animate(game.time.elapsed)\`), \`createStars(game)\`, \`createClouds(game)\`, \`scatter((rng, i) => object, { count, area: [w, d], minDistance, avoid, heightAt })\`.
- Levels: \`createMaze(["#####", "#S.E#", "#####"], { cell, wallHeight })\` returns \`{ group, solids, markers: { S: [Vector3] }, emptyCells, cellToWorld, worldToCell, isWall }\`; \`#\` is a wall, any other letter is a marker. Feed \`solids\` to \`physics.addSolid\`.

## Building a good game with it

- Structure: title screen (\`hud.titleScreen\`) → play → game over (\`hud.gameOverScreen\`, restart resets state). Prefer resetting state (teleport, \`score.set(0)\`) over rebuilding the whole scene.
- Recipes: platformer = side-scroller controller + physics + \`platform\` + \`coin\`; open world = \`createTerrain\` + \`scatter\` + third-person controller; first-person = first-person controller + \`createMaze\` or \`house\`; top-down shooter = top-down controller (\`faceMouse\`) + \`createPool\` bullets + \`createParticles\` + \`createSlime\` enemies + \`hud.bar\` health; driving = \`car\` + own chase camera + \`input.move\`; space shooter = \`spaceship\` + \`createStars\`; puzzle or board game = \`createOrbitCamera\` or a fixed camera + \`createPicker\` + tweens; endless runner = move \`scatter\`ed obstacles toward a fixed player and tween between lanes.
- Game feel is most of the fun: a sound (\`audio.sfx\`) and a particle burst for every event, \`anim.popIn\` for spawns, \`anim.hitFlash\` and \`anim.shake\` on damage, \`anim.squash\` on landing, \`hud.floatingText\` for damage or points, a difficulty that ramps up.
- Performance: \`createPool\` for anything spawned often, \`scatter\` or \`createMaze\` for many objects, few lights (one sun plus at most a handful of \`lampPost({ light: true })\`), \`bloom\` only when it matters.

## Pitfalls

- A wrong import name or a syntax error anywhere breaks the whole game (blank screen), because modules load as a unit: after writing, re-check every imported name against \`kit.js\` exports and every relative import (it needs the \`.js\` extension).
- Shapes and models share cached materials: never edit \`mesh.material.color\` in place. Use \`anim.hitFlash\` / \`anim.fadeTo\` (they clone the material), or pass a fresh \`material\` option.
- \`anim.to(obj, { misspelledProp: 1 })\` throws with the property name: property names must exist on the target.
- With physics, move a body through its \`position\` / \`velocity\` (or \`controller.mover.teleport\`), not by setting \`mesh.position\`; the body overwrites the mesh every step.
- Only one camera controller at a time, and it owns \`game.camera\`.
- The preview may refuse pointer lock: first-person falls back to drag-to-look. The player must click the preview once before the keyboard works: say so in your "how to play".
- Loading files (\`createAssets\`, textures from files) only works for files that already exist in the game directory, and you cannot create binary files.`,
}
