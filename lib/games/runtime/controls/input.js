/**
 * Entrées unifiées : clavier, souris, manette et tactile derrière des
 * *actions* nommées. Le jeu demande `input.pressed("jump")` sans savoir si
 * c'est Espace, le bouton A de la manette ou le bouton tactile.
 *
 * Lecture : `move` ({x, y}, y > 0 = avancer, longueur ≤ 1), `look` (déplacement
 * de visée cumulé sur la frame, en pixels), `down/pressed/released(action)`.
 * Les évènements sont accumulés entre deux frames et remis à zéro en fin de
 * frame : on peut lire l'entrée de n'importe où dans `onUpdate`/`onLateUpdate`,
 * dans l'ordre qu'on veut. Ne pas la lire dans `onFixedUpdate` (un pas peut
 * être joué zéro ou deux fois par frame) : lire dans `onUpdate`, puis passer
 * la vitesse voulue au corps physique.
 *
 * Jetons de liaison : un `KeyboardEvent.code` (`"Space"`, `"KeyE"`,
 * `"ArrowUp"`), `"Mouse0"` (gauche), `"Mouse1"` (milieu), `"Mouse2"` (droit),
 * `"Pad0"`…`"Pad15"` (boutons d'une manette standard : 0 = A, 2 = X, 7 = gâchette
 * droite, 9 = Start). Les codes sont *physiques* : WASD suit la position des
 * touches, donc ZQSD sur un clavier AZERTY, sans rien faire.
 */

const DEFAULT_BINDINGS = {
  jump: ["Space", "Pad0"],
  sprint: ["ShiftLeft", "ShiftRight", "Pad10"],
  fire: ["Mouse0", "KeyJ", "Pad7"],
  aim: ["Mouse2", "Pad6"],
  interact: ["KeyE", "Pad2"],
  action: ["Enter", "Pad1"],
  pause: ["Escape", "KeyP", "Pad9"],
}

const MOVE_KEYS = {
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  up: ["KeyW", "ArrowUp"],
  down: ["KeyS", "ArrowDown"],
}

// Touches qui feraient défiler la page de l'iframe : on les garde pour le jeu.
const PREVENT_DEFAULT = new Set([
  "Space",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
])

const STICK_DEADZONE = 0.15
/** Vitesse de visée à la manette, en pixels de souris équivalents par seconde. */
const STICK_LOOK_SPEED = 900

/**
 * @param {object} game Résultat de `createGame`.
 * @param {object} [options]
 * @param {Record<string, string[]>} [options.bindings] Actions supplémentaires ou remplacées.
 * @param {"drag"|"locked"|"lockedOrDrag"|"always"} [options.lookMode]
 *   Quand la souris fait tourner la visée : bouton enfoncé (`drag`, défaut),
 *   pointeur verrouillé (`locked`), l'un ou l'autre (`lockedOrDrag`) ou
 *   toujours (`always`).
 */
export function createInput(game, { bindings = {}, lookMode = "drag" } = {}) {
  const canvas = game.canvas
  const actionBindings = new Map(
    Object.entries({ ...DEFAULT_BINDINGS, ...bindings }),
  )

  // --- État brut alimenté par les évènements -------------------------------
  const keysDown = new Set()
  const keysPressed = new Set()
  const keysReleased = new Set()
  const buttonsDown = new Set()
  const buttonsPressed = new Set()
  const buttonsReleased = new Set()
  const virtualDown = new Set()
  const virtualPressed = new Set()
  const virtualReleased = new Set()
  const virtualMove = { x: 0, y: 0 }
  const lookDelta = { x: 0, y: 0 }
  let wheel = 0
  let mode = lookMode
  let dragging = false

  const pointer = { x: 0, y: 0, ndc: { x: 0, y: 0 }, inside: false, moved: false }

  // --- Manette : relevée une fois par frame --------------------------------
  let padDown = new Set()
  let prevPadDown = new Set()
  const padStick = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 } }
  let fresh = false

  const move = { x: 0, y: 0 }
  const look = { x: 0, y: 0 }

  const isEditable = (target) =>
    target instanceof HTMLElement &&
    // BUTTON : un bouton de menu focalisé doit garder Espace/Entrée pour lui.
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName))

  // --- Évènements -----------------------------------------------------------
  const onKeyDown = (event) => {
    if (isEditable(event.target)) return
    if (PREVENT_DEFAULT.has(event.code)) event.preventDefault()
    if (!keysDown.has(event.code)) keysPressed.add(event.code)
    keysDown.add(event.code)
  }
  const onKeyUp = (event) => {
    if (keysDown.delete(event.code)) keysReleased.add(event.code)
  }
  const onBlur = () => {
    // Fenêtre perdue : les keyup ne viendront pas, on évite les touches bloquées.
    keysDown.clear()
    buttonsDown.clear()
    dragging = false
  }

  const updatePointer = (event) => {
    const rect = canvas.getBoundingClientRect()
    pointer.x = event.clientX - rect.left
    pointer.y = event.clientY - rect.top
    pointer.ndc.x = (pointer.x / rect.width) * 2 - 1
    pointer.ndc.y = -(pointer.y / rect.height) * 2 + 1
    pointer.inside =
      pointer.x >= 0 && pointer.y >= 0 && pointer.x <= rect.width && pointer.y <= rect.height
    pointer.moved = true
  }

  const onPointerDown = (event) => {
    // Le iframe d'aperçu doit avoir le focus pour recevoir le clavier.
    window.focus()
    canvas.focus({ preventScroll: true })
    updatePointer(event)
    buttonsDown.add(event.button)
    buttonsPressed.add(event.button)
    dragging = true
  }
  const onPointerUp = (event) => {
    if (buttonsDown.delete(event.button)) buttonsReleased.add(event.button)
    if (buttonsDown.size === 0) dragging = false
  }
  const onPointerMove = (event) => {
    updatePointer(event)
    const locked = document.pointerLockElement === canvas
    const active =
      mode === "always" ||
      (mode === "locked" && locked) ||
      (mode === "drag" && dragging) ||
      (mode === "lockedOrDrag" && (locked || dragging))
    if (!active) return
    lookDelta.x += event.movementX || 0
    lookDelta.y += event.movementY || 0
  }
  const onWheel = (event) => {
    wheel += Math.sign(event.deltaY)
    event.preventDefault()
  }
  const onContextMenu = (event) => event.preventDefault()

  window.addEventListener("keydown", onKeyDown)
  window.addEventListener("keyup", onKeyUp)
  window.addEventListener("blur", onBlur)
  window.addEventListener("pointerup", onPointerUp)
  window.addEventListener("pointermove", onPointerMove)
  canvas.addEventListener("pointerdown", onPointerDown)
  canvas.addEventListener("wheel", onWheel, { passive: false })
  canvas.addEventListener("contextmenu", onContextMenu)

  // --- Instantané de frame ---------------------------------------------------
  const axis = (negative, positive) =>
    (positive.some((code) => keysDown.has(code)) ? 1 : 0) -
    (negative.some((code) => keysDown.has(code)) ? 1 : 0)

  const applyDeadzone = (x, y) => {
    const length = Math.hypot(x, y)
    if (length < STICK_DEADZONE) return [0, 0]
    // Rééchelonne pour partir de 0 juste après la zone morte.
    const scaled = Math.min(1, (length - STICK_DEADZONE) / (1 - STICK_DEADZONE))
    return [(x / length) * scaled, (y / length) * scaled]
  }

  function pollGamepad() {
    padDown = new Set()
    padStick.move.x = padStick.move.y = padStick.look.x = padStick.look.y = 0
    const pad = navigator.getGamepads?.().find((p) => p?.connected)
    if (!pad) return
    pad.buttons.forEach((button, i) => {
      if (button.pressed) padDown.add(i)
    })
    ;[padStick.move.x, padStick.move.y] = applyDeadzone(pad.axes[0] ?? 0, -(pad.axes[1] ?? 0))
    ;[padStick.look.x, padStick.look.y] = applyDeadzone(pad.axes[2] ?? 0, pad.axes[3] ?? 0)
    // Croix directionnelle = déplacement (boutons 12 à 15).
    if (pad.buttons[14]?.pressed) padStick.move.x = -1
    if (pad.buttons[15]?.pressed) padStick.move.x = 1
    if (pad.buttons[12]?.pressed) padStick.move.y = 1
    if (pad.buttons[13]?.pressed) padStick.move.y = -1
  }

  function snapshot() {
    if (fresh) return
    fresh = true
    pollGamepad()

    // Déplacement : on garde la source la plus « engagée » (clavier, stick, joystick tactile).
    let kx = axis(MOVE_KEYS.left, MOVE_KEYS.right)
    let ky = axis(MOVE_KEYS.down, MOVE_KEYS.up)
    const klen = Math.hypot(kx, ky)
    if (klen > 1) {
      kx /= klen
      ky /= klen
    }
    const sources = [
      [kx, ky],
      [padStick.move.x, padStick.move.y],
      [virtualMove.x, virtualMove.y],
    ]
    let best = sources[0]
    for (const source of sources) {
      if (Math.hypot(...source) > Math.hypot(...best)) best = source
    }
    move.x = best[0]
    move.y = best[1]

    // Visée : souris (déjà cumulée) + stick droit, qui a besoin de dt.
    const dt = game.time.realDelta
    look.x = lookDelta.x + padStick.look.x * STICK_LOOK_SPEED * dt
    look.y = lookDelta.y + padStick.look.y * STICK_LOOK_SPEED * dt
  }

  const tokenState = (token, kind) => {
    if (token.startsWith("Mouse")) {
      const button = Number(token.slice(5))
      const set =
        kind === "down" ? buttonsDown : kind === "pressed" ? buttonsPressed : buttonsReleased
      return set.has(button)
    }
    if (token.startsWith("Pad")) {
      const index = Number(token.slice(3))
      if (kind === "down") return padDown.has(index)
      if (kind === "pressed") return padDown.has(index) && !prevPadDown.has(index)
      return !padDown.has(index) && prevPadDown.has(index)
    }
    const set = kind === "down" ? keysDown : kind === "pressed" ? keysPressed : keysReleased
    return set.has(token)
  }

  const query = (action, kind) => {
    snapshot()
    const virtual =
      kind === "down" ? virtualDown : kind === "pressed" ? virtualPressed : virtualReleased
    if (virtual.has(action)) return true
    const tokens = actionBindings.get(action) ?? []
    return tokens.some((token) => tokenState(token, kind))
  }

  game.onFrameEnd(() => {
    keysPressed.clear()
    keysReleased.clear()
    buttonsPressed.clear()
    buttonsReleased.clear()
    virtualPressed.clear()
    virtualReleased.clear()
    lookDelta.x = lookDelta.y = 0
    wheel = 0
    pointer.moved = false
    prevPadDown = padDown
    fresh = false
  })

  return {
    canvas,
    pointer,

    /** Définit (remplace) les jetons d'une action : `bind("dash", ["KeyQ", "Pad3"])`. */
    bind(action, tokens) {
      actionBindings.set(action, Array.isArray(tokens) ? tokens : [tokens])
    },
    down: (action) => query(action, "down"),
    /** Vrai uniquement sur la frame où l'action vient d'être enfoncée. */
    pressed: (action) => query(action, "pressed"),
    released: (action) => query(action, "released"),

    /** Touche brute par `KeyboardEvent.code`, sans passer par une action. */
    keyDown: (code) => keysDown.has(code),
    keyPressed: (code) => keysPressed.has(code),

    /** Déplacement `{ x, y }` (x > 0 = droite, y > 0 = avant), longueur ≤ 1. */
    get move() {
      snapshot()
      return move
    },
    /** Visée `{ x, y }` cumulée sur la frame, en pixels (y > 0 = vers le bas). */
    get look() {
      snapshot()
      return look
    },
    /** Molette cumulée sur la frame : -1 (vers le haut), 0 ou 1 (vers le bas) par cran. */
    get wheel() {
      return wheel
    },
    get pointerDown() {
      return buttonsDown.size > 0
    },
    get pointerLocked() {
      return document.pointerLockElement === canvas
    },

    setLookMode(next) {
      mode = next
    },
    /** Verrouille le pointeur (à appeler depuis un clic). Sans effet si le navigateur refuse. */
    lockPointer() {
      try {
        const result = canvas.requestPointerLock?.()
        result?.catch?.(() => {})
      } catch {
        // Iframe sans `allow-pointer-lock` : le mode `lockedOrDrag` prend le relais.
      }
    },
    unlockPointer() {
      document.exitPointerLock?.()
    },

    /** Utilisé par les commandes tactiles : force une action ou le déplacement. */
    setVirtualAction(action, isDown) {
      if (isDown && !virtualDown.has(action)) virtualPressed.add(action)
      if (!isDown && virtualDown.has(action)) virtualReleased.add(action)
      isDown ? virtualDown.add(action) : virtualDown.delete(action)
    },
    setVirtualMove(x, y) {
      virtualMove.x = x
      virtualMove.y = y
    },

    dispose() {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", onBlur)
      window.removeEventListener("pointerup", onPointerUp)
      window.removeEventListener("pointermove", onPointerMove)
      canvas.removeEventListener("pointerdown", onPointerDown)
      canvas.removeEventListener("wheel", onWheel)
      canvas.removeEventListener("contextmenu", onContextMenu)
    },
  }
}
