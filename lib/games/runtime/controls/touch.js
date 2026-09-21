const ACCENT = "234, 88, 12"

function isTouchDevice() {
  return (
    window.matchMedia?.("(pointer: coarse)").matches ||
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0
  )
}

/**
 * Commandes tactiles à l'écran : un joystick virtuel à gauche (alimente
 * `input.move`) et des boutons à droite (déclenchent des actions d'`input`).
 * Affichées seulement sur un appareil tactile, sauf avec `force: true`.
 * La visée se fait naturellement en glissant le doigt sur le reste du canvas
 * (mode `drag` de l'entrée).
 *
 * @param {object} game
 * @param {ReturnType<import("./input.js").createInput>} input
 * @param {object} [options]
 * @param {boolean} [options.joystick] Joystick de déplacement (défaut : true).
 * @param {{ action: string, label?: string }[]} [options.buttons] Boutons, du plus
 *   proche du pouce au plus éloigné. Défaut : un bouton de saut.
 * @param {boolean} [options.force] Affiche même sans écran tactile (tests).
 */
export function createTouchControls(
  game,
  input,
  { joystick = true, buttons = [{ action: "jump", label: "▲" }], force = false } = {},
) {
  const enabled = force || isTouchDevice()
  const root = document.createElement("div")
  Object.assign(root.style, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: "20",
    userSelect: "none",
    webkitUserSelect: "none",
    display: enabled ? "block" : "none",
  })
  game.container.appendChild(root)

  const cleanups = []

  if (joystick) {
    const RADIUS = 56
    const base = document.createElement("div")
    Object.assign(base.style, {
      position: "absolute",
      left: "28px",
      bottom: "28px",
      width: `${RADIUS * 2}px`,
      height: `${RADIUS * 2}px`,
      borderRadius: "50%",
      background: "rgba(255,255,255,0.08)",
      border: "2px solid rgba(255,255,255,0.25)",
      touchAction: "none",
      pointerEvents: "auto",
    })
    const knob = document.createElement("div")
    Object.assign(knob.style, {
      position: "absolute",
      left: `${RADIUS - 24}px`,
      top: `${RADIUS - 24}px`,
      width: "48px",
      height: "48px",
      borderRadius: "50%",
      background: `rgba(${ACCENT}, 0.85)`,
      boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
      pointerEvents: "none",
    })
    base.appendChild(knob)
    root.appendChild(base)

    let activePointer = null
    const setKnob = (event) => {
      const rect = base.getBoundingClientRect()
      let dx = event.clientX - (rect.left + rect.width / 2)
      let dy = event.clientY - (rect.top + rect.height / 2)
      const length = Math.hypot(dx, dy)
      if (length > RADIUS) {
        dx = (dx / length) * RADIUS
        dy = (dy / length) * RADIUS
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`
      // Écran : y vers le bas ; entrée : y > 0 = avancer.
      input.setVirtualMove(dx / RADIUS, -dy / RADIUS)
    }
    const release = () => {
      activePointer = null
      knob.style.transform = "translate(0, 0)"
      input.setVirtualMove(0, 0)
    }
    base.addEventListener("pointerdown", (event) => {
      if (activePointer !== null) return
      activePointer = event.pointerId
      base.setPointerCapture(event.pointerId)
      setKnob(event)
    })
    base.addEventListener("pointermove", (event) => {
      if (event.pointerId === activePointer) setKnob(event)
    })
    base.addEventListener("pointerup", release)
    base.addEventListener("pointercancel", release)
    cleanups.push(release)
  }

  buttons.forEach(({ action, label = action }, index) => {
    const size = 68
    const button = document.createElement("button")
    button.type = "button"
    button.textContent = label
    Object.assign(button.style, {
      position: "absolute",
      right: `${28 + (index % 2) * (size + 12)}px`,
      bottom: `${28 + Math.floor(index / 2) * (size + 12) + (index % 2) * 28}px`,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: "50%",
      border: "2px solid rgba(255,255,255,0.35)",
      background: `rgba(${ACCENT}, 0.55)`,
      color: "#fff",
      font: "600 20px system-ui, sans-serif",
      touchAction: "none",
      pointerEvents: "auto",
    })
    const press = (event) => {
      event.preventDefault()
      button.setPointerCapture(event.pointerId)
      button.style.background = `rgba(${ACCENT}, 0.95)`
      input.setVirtualAction(action, true)
    }
    const release = () => {
      button.style.background = `rgba(${ACCENT}, 0.55)`
      input.setVirtualAction(action, false)
    }
    button.addEventListener("pointerdown", press)
    button.addEventListener("pointerup", release)
    button.addEventListener("pointercancel", release)
    root.appendChild(button)
    cleanups.push(release)
  })

  return {
    element: root,
    get visible() {
      return root.style.display !== "none"
    },
    show() {
      root.style.display = "block"
    },
    hide() {
      root.style.display = "none"
    },
    dispose() {
      cleanups.forEach((fn) => fn())
      root.remove()
    },
  }
}
