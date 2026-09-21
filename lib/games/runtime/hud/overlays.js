import { el, replay } from "./styles.js"

/**
 * Réticule au centre de l'écran. `style` : `"cross"` (défaut) ou `"dot"`.
 * `hit()` le fait vibrer en couleur d'accent (confirmation de touche).
 */
export function createCrosshair(root, { style = "cross" } = {}) {
  const node = el("div", `hud-crosshair hud-crosshair-${style}`)
  root.append(node)
  return {
    el: node,
    hit: () => replay(node, "hud-crosshair-hit"),
    show: () => (node.style.display = ""),
    hide: () => (node.style.display = "none"),
    setStyle(next) {
      node.className = `hud-crosshair hud-crosshair-${next}`
    },
    dispose: () => node.remove(),
  }
}

/**
 * Messages brefs empilés en haut de l'écran (« Pièce ramassée », « Vague 3 »).
 * `kind` : `"info"` (défaut), `"success"`, `"warn"`, `"danger"`.
 * Le compte à rebours est en temps réel : un toast disparaît même en pause.
 */
export function createToasts(root) {
  const container = el("div", "hud-toasts")
  root.append(container)

  return {
    show(text, { duration = 2.2, kind = "info" } = {}) {
      const toast = el("div", `hud-panel hud-toast hud-toast-${kind}`, text)
      container.append(toast)
      // Trois toasts au plus : les plus anciens cèdent la place.
      while (container.children.length > 3) container.firstChild.remove()
      setTimeout(() => {
        toast.classList.add("hud-toast-out")
        setTimeout(() => toast.remove(), 300)
      }, duration * 1000)
      return toast
    },
    dispose: () => container.remove(),
  }
}

/**
 * Grande bannière centrale (« Niveau 2 », « GO ! »). Un nouveau message
 * remplace le précédent.
 */
export function createMessage(root) {
  const node = el("div", "hud-message")
  root.append(node)
  let timer = null

  return {
    show(text, { duration = 1.8 } = {}) {
      clearTimeout(timer)
      node.textContent = text
      node.classList.add("hud-message-visible")
      if (duration > 0) timer = setTimeout(() => node.classList.remove("hud-message-visible"), duration * 1000)
    },
    hide() {
      clearTimeout(timer)
      node.classList.remove("hud-message-visible")
    },
    dispose() {
      clearTimeout(timer)
      node.remove()
    },
  }
}

/**
 * Flash sur les bords de l'écran : `flash("#ef4444")` pour un dégât,
 * `flash("#22c55e")` pour un soin.
 */
export function createFlash(root) {
  const node = el("div", "hud-flash")
  root.append(node)
  return {
    flash(color = "#ef4444", { duration = 0.45 } = {}) {
      node.style.setProperty("--flash-color", color)
      node.style.setProperty("--flash-duration", `${duration}s`)
      replay(node, "hud-flash-active")
    },
    dispose: () => node.remove(),
  }
}

/**
 * Écran modal (titre, pause, game over) : un titre, un sous-titre, des lignes
 * de texte et des boutons. Reste masqué tant qu'on n'appelle pas `show()`.
 * Avec `pauseGame`, l'affichage met le jeu en pause et le masquage le relance
 * (seulement s'il l'avait mis lui-même en pause).
 *
 * @param {object} game
 * @param {HTMLElement} root
 * @param {object} [options]
 * @param {string} [options.title]
 * @param {string} [options.subtitle]
 * @param {string[]} [options.lines] Lignes de détail (« Score : 1200 »).
 * @param {{ label: string, onClick?: (screen: object) => void, secondary?: boolean }[]} [options.buttons]
 * @param {boolean} [options.visible] Affiché dès la création.
 * @param {boolean} [options.pauseGame]
 */
export function createScreen(
  game,
  root,
  { title = "", subtitle = "", lines = [], buttons = [], visible = false, pauseGame = false } = {},
) {
  const node = el("div", "hud-screen hud-screen-hidden")
  const card = el("div", "hud-card")
  const titleEl = el("h1", "hud-title", title)
  const subtitleEl = el("p", "hud-subtitle", subtitle)
  const linesEl = el("div", "hud-lines")
  const buttonsEl = el("div", "hud-buttons")
  card.append(titleEl, subtitleEl, linesEl, buttonsEl)
  node.append(card)
  root.append(node)

  let isVisible = false
  let pausedByUs = false

  const setLines = (next) => {
    linesEl.replaceChildren(...next.map((line) => el("div", "", line)))
  }
  const setText = (element, text) => {
    element.textContent = text
    element.style.display = text ? "" : "none"
  }
  const setButtons = (next) => {
    buttonsEl.replaceChildren(
      ...next.map(({ label, onClick, secondary = false }) => {
        const button = el("button", `hud-button${secondary ? " hud-button-secondary" : ""}`, label)
        button.type = "button"
        button.addEventListener("click", () => onClick?.(screen))
        return button
      }),
    )
  }

  const screen = {
    el: node,
    get visible() {
      return isVisible
    },
    show() {
      if (isVisible) return
      isVisible = true
      node.classList.remove("hud-screen-hidden")
      if (pauseGame && !game.paused) {
        game.pause()
        pausedByUs = true
      }
      // Le premier bouton a le focus : Entrée valide sans toucher la souris.
      requestAnimationFrame(() => buttonsEl.querySelector("button")?.focus({ preventScroll: true }))
    },
    hide() {
      if (!isVisible) return
      isVisible = false
      node.classList.add("hud-screen-hidden")
      // Sans ça, le bouton (masqué) garderait le focus et volerait Espace/Entrée au jeu.
      if (node.contains(document.activeElement)) document.activeElement.blur()
      game.canvas.focus({ preventScroll: true })
      if (pausedByUs) {
        pausedByUs = false
        game.resume()
      }
    },
    toggle() {
      isVisible ? screen.hide() : screen.show()
    },
    setTitle: (text) => setText(titleEl, text),
    setSubtitle: (text) => setText(subtitleEl, text),
    setLines,
    setButtons,
    dispose() {
      if (pausedByUs) game.resume()
      node.remove()
    },
  }

  setText(titleEl, title)
  setText(subtitleEl, subtitle)
  setLines(lines)
  setButtons(buttons)
  if (visible) screen.show()
  return screen
}

/** Écran titre : `titleScreen({ title, subtitle, button: "Jouer", onStart })`. Affiché tout de suite. */
export function createTitleScreen(game, root, { title = "New game", subtitle = "", button = "Play", onStart } = {}) {
  return createScreen(game, root, {
    title,
    subtitle,
    visible: true,
    buttons: [
      {
        label: button,
        onClick: (screen) => {
          screen.hide()
          onStart?.()
        },
      },
    ],
  })
}

/**
 * Menu pause : met le jeu en pause à l'affichage. `toggle()` à brancher sur
 * l'action `pause` de l'entrée. `buttons` s'ajoute sous « Reprendre ».
 */
export function createPauseMenu(game, root, { title = "Paused", resumeLabel = "Resume", buttons = [] } = {}) {
  return createScreen(game, root, {
    title,
    pauseGame: true,
    buttons: [{ label: resumeLabel, onClick: (screen) => screen.hide() }, ...buttons],
  })
}

/**
 * Écran de fin : `show()` l'affiche ; `setLines(["Score : 1200"])` pour les
 * résultats. Le bouton masque l'écran puis appelle `onRestart`.
 */
export function createGameOverScreen(
  game,
  root,
  { title = "Game over", subtitle = "", lines = [], restartLabel = "Play again", onRestart } = {},
) {
  return createScreen(game, root, {
    title,
    subtitle,
    lines,
    buttons: [
      {
        label: restartLabel,
        onClick: (screen) => {
          screen.hide()
          onRestart?.()
        },
      },
    ],
  })
}
