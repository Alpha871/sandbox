/*
 * Welcome scene: an orange cube slowly turning in the dark, over a red glow on
 * the floor and a few specks of dust. It is the placeholder shown until the
 * assistant builds the real game: replace this whole file with the game.
 */
import { THREE, createGame, createLights, createParticles, createSky, damp } from "./engine/index.js"
import { createInput, createPicker } from "./controls/index.js"
import { createAnimator } from "./animations/index.js"
import { createHud } from "./hud/index.js"
import { drawTexture } from "./models/textures.js"

const ORANGE = 0xea580c

function showFatal(message) {
  const box = document.createElement("div")
  box.textContent = message
  Object.assign(box.style, {
    position: "fixed", inset: "0", display: "grid", placeItems: "center",
    padding: "24px", textAlign: "center", color: "#fff", background: "#000",
    font: "600 18px system-ui, sans-serif",
  })
  document.body.append(box)
}

let game
try {
  // Default tone mapping (ACES) on purpose: it turns the overexposed top of the
  // cube from raw orange into a soft peach, like a lit object in a dark room.
  game = createGame({ background: 0x000000, fov: 38 })
} catch (error) {
  console.error(error)
  showFatal("WebGL is not available in this browser, so the 3D preview cannot start.")
}

if (game) start(game)

function start(game) {
  const anim = createAnimator(game)
  const input = createInput(game)

  // --- Décor : noir, à peine réchauffé près de l'horizon ---
  createSky(game, { top: 0x000000, bottom: 0x14100f, exponent: 0.6 })
  createLights(game, {
    // Un éclairage dur presque à la verticale : le dessus du cube est très clair, les côtés restent sombres.
    sun: { color: 0xfff0e0, intensity: 2.0, position: [1.5, 8, 3] },
    hemi: { sky: 0xffe8d8, ground: 0x200804, intensity: 0.12 },
    shadowSize: 4,
    shadowMapSize: 1024,
  })

  // --- Le cube, à arêtes vives, posé sur une face ---
  const SIZE = 2
  // Le dessus reçoit presque toute la lumière et « délave » vers le pêche ; un seul albédo orange
  // ne peut pas donner ce rendu sans surexposer tout le cube, donc le dessus a sa propre teinte.
  const side = new THREE.MeshStandardMaterial({ color: ORANGE, roughness: 0.55 })
  const top = new THREE.MeshStandardMaterial({ color: 0xeeac89, roughness: 0.55 })
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(SIZE, SIZE, SIZE),
    // Ordre des groupes de BoxGeometry : +x, -x, +y (dessus), -y, +z, -z.
    [side, side, top, side, side, side],
  )
  cube.castShadow = true
  const spinner = new THREE.Group()
  spinner.add(cube)
  game.scene.add(spinner)

  // Lueur rouge sur le sol, sous le cube : un dégradé radial peint sur un plan, sans éclairage.
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    new THREE.MeshBasicMaterial({
      map: drawTexture(256, (ctx, w, h) => {
        const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
        gradient.addColorStop(0, "rgba(72, 14, 8, 1)")
        gradient.addColorStop(0.3, "rgba(50, 11, 7, 0.75)")
        gradient.addColorStop(0.65, "rgba(28, 13, 11, 0.3)")
        gradient.addColorStop(1, "rgba(20, 15, 14, 0)")
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, w, h)
      }),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  )
  glow.rotation.x = -Math.PI / 2
  glow.position.y = -SIZE / 2 - 0.06
  game.scene.add(glow)

  // --- Mouvement : rotation régulière, léger flottement, apparition ---
  // La vitesse de rotation est un ressort : un clic lui donne un coup, elle retombe seule.
  const spin = anim.spring(0.45, { stiffness: 30, damping: 6 })
  spin.target = 0.45
  game.onUpdate((dt) => {
    spinner.rotation.y += spin.value * dt
  })
  anim.float(spinner, { amplitude: 0.07, speed: 1.4, phase: 0 })

  let ready = false
  anim.popIn(spinner, { duration: 0.9, delay: 0.15 }).finished.then(() => (ready = true))

  // --- Poussière : quelques points très discrets, répartis dans toute la scène ---
  const dust = createParticles(game, { max: 90, size: 0.05 })
  let sinceDust = 0
  const spot = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  game.onUpdate((dt) => {
    sinceDust += dt
    while (sinceDust > 0.22) {
      sinceDust -= 0.22
      const halfWidth = Math.max(3, game.aspect * 3.6)
      spot.set((Math.random() * 2 - 1) * halfWidth, -1.5 + Math.random() * 5.5, (Math.random() - 0.5) * 6)
      dust.emit({ position: spot, count: 1, color: 0xb0b0b0, speed: 0.25, life: 9, direction: up, spread: 0.6 })
    }
  })

  // --- Interaction : le curseur incline la vue, un clic fait réagir le cube ---
  createPicker(game, {
    objects: [spinner],
    onClick: (hit) => {
      if (!ready) return
      spin.impulse(8)
      anim.squash(spinner, { amount: 0.1, duration: 0.5 })
      dust.sparks(hit.point, { color: 0xffb98a, count: 22 })
    },
  })

  // Portrait : la largeur limite (7.6 / aspect). Paysage : la hauteur limite, avec de la place pour le texte.
  const framing = () => Math.max(9.2, 7.6 / game.aspect)
  const CAMERA_HEIGHT = 3.4
  const look = anim.spring3(new THREE.Vector3(0, CAMERA_HEIGHT, framing()), { stiffness: 45, damping: 9 })
  const focus = new THREE.Vector3(0, -0.2, 0)
  game.onLateUpdate((dt) => {
    const { ndc } = input.pointer
    // Champ vertical fixe : en portrait le champ horizontal devient étroit, on recule
    // pour que le cube (≈ 2.8 de large en rotation) garde la même place à l'écran.
    look.target.set(ndc.x * 0.9, CAMERA_HEIGHT + ndc.y * 0.5, framing())
    // En paysage on vise plus bas : le cube remonte à l'écran et laisse le texte respirer.
    focus.y = game.aspect > 1 ? -0.6 : -0.2
    game.camera.position.copy(look.value)
    game.camera.lookAt(focus)
    // Léger roulis du cube vers le curseur.
    spinner.rotation.x = damp(spinner.rotation.x, -ndc.y * 0.1, 4, dt)
    spinner.rotation.z = damp(spinner.rotation.z, ndc.x * 0.07, 4, dt)
  })
  look.snap(new THREE.Vector3(0, CAMERA_HEIGHT, framing()))
  game.camera.position.copy(look.value)

  // --- Texte d'accueil (dans ce fichier : il disparaît avec lui) ---
  const hud = createHud(game, { accent: "#ea580c" })
  const slot = hud.slot("bottom-center")
  slot.style.paddingBottom = "max(15vh, 56px)"
  slot.style.textAlign = "center"
  // Une ancre `left: 50%` ne peut pas dépasser la moitié de l'écran : sans ça, le texte passe à la ligne.
  slot.style.width = "100%"

  const title = document.createElement("h1")
  title.className = "hud-title"
  title.textContent = "New game"
  title.style.fontSize = "clamp(28px, 4.6vw, 46px)"
  const subtitle = document.createElement("p")
  subtitle.className = "hud-subtitle"
  subtitle.textContent = "Nothing has been built yet — describe the game you want."
  subtitle.style.fontSize = "clamp(14px, 1.9vw, 18px)"
  slot.append(title, subtitle)

  for (const [index, node] of [title, subtitle].entries()) {
    Object.assign(node.style, {
      opacity: "0",
      transform: "translateY(14px)",
      transition: `opacity 0.7s ease-out ${0.5 + index * 0.15}s, transform 0.7s ease-out ${0.5 + index * 0.15}s`,
    })
  }
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      title.style.opacity = "1"
      subtitle.style.opacity = "0.75"
      for (const node of [title, subtitle]) node.style.transform = "none"
    }),
  )
}
