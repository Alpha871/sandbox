import { el, replay } from "./styles.js"

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

/** `75.3` → `"1:15"` ; avec `tenths`, `"1:15.3"`. */
export function formatTime(seconds, { tenths = false } = {}) {
  // En dixièmes entiers : `75.3 - 60` vaut 15.299999…, ce qui afficherait « .2 ».
  const totalTenths = Math.floor(Math.max(0, seconds) * 10 + 1e-6)
  const minutes = Math.floor(totalTenths / 600)
  const whole = String(Math.floor(totalTenths / 10) % 60).padStart(2, "0")
  const fraction = tenths ? `.${totalTenths % 10}` : ""
  return `${minutes}:${whole}${fraction}`
}

/**
 * Statistique : score, pièces, munitions, niveau… Le chiffre « pulse » quand
 * il change.
 *
 * @param {{ label?: string, value?: number|string, format?: (v: any) => string }} [options]
 */
export function createStat({ label = "", value = 0, format = defaultFormat } = {}) {
  const root = el("div", "hud-panel hud-stat")
  const labelEl = el("span", "hud-stat-label", label)
  const valueEl = el("span", "hud-stat-value")
  if (label) root.append(labelEl)
  root.append(valueEl)

  let current = value
  const render = (animate) => {
    valueEl.textContent = format(current)
    if (animate) replay(valueEl, "hud-pop")
  }
  render(false)

  const stat = {
    el: root,
    get value() {
      return current
    },
    set(next) {
      if (next === current) return
      current = next
      render(true)
    },
    add(amount = 1) {
      stat.set(current + amount)
    },
    setLabel(text) {
      labelEl.textContent = text
    },
  }
  return stat
}

const defaultFormat = (value) =>
  typeof value === "number" ? value.toLocaleString("fr-FR") : String(value)

/**
 * Barre de progression (vie, endurance, chargement) avec une traînée blanche
 * qui rattrape la perte. Passe en alerte sous 25 %.
 *
 * @param {{ label?: string, value?: number, max?: number, color?: string, showNumbers?: boolean, lowThreshold?: number }} [options]
 */
export function createBar({
  label = "",
  value = 100,
  max = 100,
  color = "#22c55e",
  showNumbers = true,
  lowThreshold = 0.25,
} = {}) {
  const root = el("div", "hud-panel hud-bar")
  root.style.setProperty("--bar-color", color)
  const head = el("div", "hud-bar-head")
  const labelEl = el("span", "", label)
  const numbersEl = el("span")
  head.append(labelEl)
  if (showNumbers) head.append(numbersEl)
  const track = el("div", "hud-bar-track")
  const trail = el("div", "hud-bar-trail")
  const fill = el("div", "hud-bar-fill")
  track.append(trail, fill)
  if (label || showNumbers) root.append(head)
  root.append(track)

  let current = value
  let maximum = max

  const render = () => {
    const ratio = maximum > 0 ? clamp(current / maximum, 0, 1) : 0
    const width = `${ratio * 100}%`
    fill.style.width = width
    trail.style.width = width
    numbersEl.textContent = `${Math.ceil(current)} / ${Math.ceil(maximum)}`
    root.classList.toggle("hud-bar-low", ratio > 0 && ratio <= lowThreshold)
  }
  render()

  const bar = {
    el: root,
    get value() {
      return current
    },
    get max() {
      return maximum
    },
    get ratio() {
      return maximum > 0 ? current / maximum : 0
    },
    set(next) {
      current = clamp(next, 0, maximum)
      render()
    },
    add(amount) {
      bar.set(current + amount)
    },
    setMax(next, { fill: refill = false } = {}) {
      maximum = next
      current = refill ? next : Math.min(current, next)
      render()
    },
    setColor(next) {
      root.style.setProperty("--bar-color", next)
    },
  }
  return bar
}

/**
 * Minuteur : chronomètre, ou compte à rebours avec `countdown` (secondes).
 * Il avance avec le temps de jeu (`dt`), donc s'arrête tout seul en pause.
 * Sous 10 s, un compte à rebours passe en rouge.
 *
 * @param {object} game
 * @param {{ countdown?: number, autoStart?: boolean, tenths?: boolean, onEnd?: () => void }} [options]
 */
export function createTimer(
  game,
  { countdown = null, autoStart = false, tenths = false, onEnd } = {},
) {
  const root = el("div", "hud-panel hud-timer")
  let elapsed = 0
  let running = autoStart

  const remaining = () => (countdown === null ? null : Math.max(0, countdown - elapsed))
  const render = () => {
    const shown = countdown === null ? elapsed : remaining()
    root.textContent = formatTime(shown, { tenths: tenths && shown < 10 })
    root.classList.toggle("hud-timer-low", countdown !== null && shown <= 10 && running)
  }
  render()

  const off = game.onUpdate((dt) => {
    if (!running || dt === 0) return
    elapsed += dt
    if (countdown !== null && elapsed >= countdown) {
      elapsed = countdown
      running = false
      render()
      onEnd?.()
      return
    }
    render()
  })

  return {
    el: root,
    /** Secondes écoulées. */
    get time() {
      return elapsed
    },
    /** Secondes restantes (`null` pour un chronomètre). */
    get remaining() {
      return remaining()
    },
    get running() {
      return running
    },
    start() {
      running = true
      render()
    },
    stop() {
      running = false
      render()
    },
    reset(startAt = 0) {
      elapsed = startAt
      render()
    },
    /** Ajoute du temps à un compte à rebours (bonus) ; en retire si négatif. */
    addTime(seconds) {
      elapsed = Math.max(0, elapsed - seconds)
      render()
    },
    dispose: off,
  }
}

/** Compteur d'images par seconde, lissé et rafraîchi 4 fois par seconde. */
export function createFps(game) {
  const root = el("div", "hud-panel hud-fps", "-- fps")
  let smoothed = 60
  let sinceRender = 0

  const off = game.onUpdate(() => {
    const dt = game.time.realDelta
    if (dt <= 0) return
    smoothed += (1 / dt - smoothed) * 0.1
    sinceRender += dt
    if (sinceRender >= 0.25) {
      sinceRender = 0
      root.textContent = `${Math.round(smoothed)} fps`
    }
  })

  return { el: root, dispose: off }
}
