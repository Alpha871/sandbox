const STYLE_ID = "hud-styles"

const CSS = /* css */ `
.hud-root {
  --hud-accent: #ea580c;
  --hud-panel: rgba(12, 12, 16, 0.55);
  --hud-radius: 12px;
  position: fixed;
  inset: 0;
  z-index: 10;
  pointer-events: none;
  color: #fff;
  font-family: var(--hud-font, system-ui, -apple-system, "Segoe UI", sans-serif);
  user-select: none;
  -webkit-user-select: none;
}

/* Couches empilées dans cet ordre : monde, ancres, overlays, écrans. */
.hud-layer { position: absolute; inset: 0; pointer-events: none; }

/* Ancres : les éléments du HUD s'empilent dans six zones. */
.hud-slot {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding:
    calc(16px + env(safe-area-inset-top))
    calc(16px + env(safe-area-inset-right))
    calc(16px + env(safe-area-inset-bottom))
    calc(16px + env(safe-area-inset-left));
}
.hud-top-left { top: 0; left: 0; align-items: flex-start; }
.hud-top-center { top: 0; left: 50%; transform: translateX(-50%); align-items: center; }
.hud-top-right { top: 0; right: 0; align-items: flex-end; }
.hud-bottom-left { bottom: 0; left: 0; align-items: flex-start; justify-content: flex-end; }
.hud-bottom-center { bottom: 0; left: 50%; transform: translateX(-50%); align-items: center; justify-content: flex-end; }
.hud-bottom-right { bottom: 0; right: 0; align-items: flex-end; justify-content: flex-end; }

.hud-panel {
  background: var(--hud-panel);
  border-radius: var(--hud-radius);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
}

/* Statistique (score, pièces, munitions…) */
.hud-stat {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 8px 14px;
}
.hud-stat-label {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.7;
}
.hud-stat-value {
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.hud-pop { animation: hud-pop 0.28s ease-out; }
@keyframes hud-pop {
  0% { transform: scale(1); }
  40% { transform: scale(1.28); color: var(--hud-accent); }
  100% { transform: scale(1); }
}

/* Barre (vie, énergie, chargement) */
.hud-bar { width: min(240px, 60vw); padding: 8px 12px; }
.hud-bar-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-variant-numeric: tabular-nums;
}
.hud-bar-head span:last-child { opacity: 0.75; }
.hud-bar-track {
  position: relative;
  height: 12px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.14);
  overflow: hidden;
}
.hud-bar-trail,
.hud-bar-fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 6px;
}
/* La traînée blanche suit la perte avec retard : on voit d'où l'on vient. */
.hud-bar-trail {
  background: rgba(255, 255, 255, 0.85);
  transition: width 0.6s ease-out 0.25s;
}
.hud-bar-fill {
  background: var(--bar-color, #22c55e);
  transition: width 0.15s ease-out;
}
.hud-bar-low .hud-bar-fill { animation: hud-pulse 0.7s ease-in-out infinite; }
@keyframes hud-pulse { 50% { opacity: 0.45; } }

/* Minuteur */
.hud-timer {
  padding: 6px 18px;
  font-size: 28px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}
.hud-timer-low { color: #f87171; animation: hud-pulse 1s ease-in-out infinite; }

/* Réticule */
.hud-crosshair {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 26px;
  height: 26px;
  transform: translate(-50%, -50%);
  pointer-events: none;
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.8));
}
.hud-crosshair::before,
.hud-crosshair::after { content: ""; position: absolute; background: #fff; }
.hud-crosshair-cross::before { left: 50%; top: 0; width: 2px; height: 100%; margin-left: -1px; -webkit-mask: linear-gradient(#000 0 34%, transparent 34% 66%, #000 66%); mask: linear-gradient(#000 0 34%, transparent 34% 66%, #000 66%); }
.hud-crosshair-cross::after { top: 50%; left: 0; height: 2px; width: 100%; margin-top: -1px; -webkit-mask: linear-gradient(90deg, #000 0 34%, transparent 34% 66%, #000 66%); mask: linear-gradient(90deg, #000 0 34%, transparent 34% 66%, #000 66%); }
.hud-crosshair-dot::before { left: 50%; top: 50%; width: 6px; height: 6px; margin: -3px 0 0 -3px; border-radius: 50%; }
.hud-crosshair-hit { animation: hud-hit 0.18s ease-out; }
.hud-crosshair-hit::before,
.hud-crosshair-hit::after { background: var(--hud-accent); }
@keyframes hud-hit { 0% { transform: translate(-50%, -50%) scale(1.5); } 100% { transform: translate(-50%, -50%) scale(1); } }

/* Toasts et bannière */
.hud-toasts {
  position: absolute;
  top: 16%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.hud-toast {
  padding: 8px 16px;
  font-weight: 600;
  border-left: 4px solid var(--hud-accent);
  animation: hud-toast-in 0.2s ease-out;
  transition: opacity 0.3s, transform 0.3s;
}
.hud-toast-success { border-left-color: #22c55e; }
.hud-toast-warn { border-left-color: #eab308; }
.hud-toast-danger { border-left-color: #ef4444; }
.hud-toast-out { opacity: 0; transform: translateY(-8px); }
@keyframes hud-toast-in { from { opacity: 0; transform: translateY(-8px); } }

.hud-message {
  position: absolute;
  left: 50%;
  top: 30%;
  transform: translate(-50%, -50%);
  max-width: 90vw;
  text-align: center;
  font-size: clamp(28px, 6vw, 64px);
  font-weight: 800;
  text-shadow: 0 2px 16px rgba(0, 0, 0, 0.6);
  opacity: 0;
  transition: opacity 0.25s, transform 0.25s;
}
.hud-message-visible { opacity: 1; }

/* Flash plein écran (dégât, soin) */
.hud-flash {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 45%, var(--flash-color, #ef4444) 130%);
}
.hud-flash-active { animation: hud-flash var(--flash-duration, 0.45s) ease-out; }
@keyframes hud-flash { 0% { opacity: 0.85; } 100% { opacity: 0; } }

/* Écrans (titre, pause, game over) */
.hud-screen {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(8, 8, 12, 0.62);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  pointer-events: auto;
  opacity: 1;
  transition: opacity 0.25s;
}
.hud-screen-hidden { opacity: 0; visibility: hidden; pointer-events: none; }
.hud-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  max-width: 560px;
  text-align: center;
}
.hud-title {
  margin: 0;
  font-size: clamp(34px, 8vw, 76px);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.02em;
  text-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
}
.hud-subtitle { margin: 0; font-size: clamp(15px, 2.4vw, 20px); opacity: 0.8; }
.hud-lines { display: flex; flex-direction: column; gap: 4px; font-size: 18px; font-variant-numeric: tabular-nums; }
.hud-lines:empty { display: none; }
.hud-buttons { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; min-width: 200px; }
.hud-button {
  font: inherit;
  font-weight: 700;
  font-size: 18px;
  padding: 12px 28px;
  border: 2px solid var(--hud-accent);
  border-radius: 999px;
  background: var(--hud-accent);
  color: #fff;
  cursor: pointer;
  transition: transform 0.12s, filter 0.12s;
}
.hud-button:hover { transform: scale(1.04); filter: brightness(1.1); }
.hud-button:active { transform: scale(0.98); }
.hud-button:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
.hud-button-secondary { background: transparent; }

/* Éléments ancrés au monde 3D */
.hud-world { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.hud-label {
  position: absolute;
  left: 0;
  top: 0;
  padding: 2px 8px;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  will-change: transform;
}
.hud-float {
  position: absolute;
  left: 0;
  top: 0;
  font-weight: 800;
  white-space: nowrap;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.7);
  will-change: transform, opacity;
}

/* Minimap et FPS */
.hud-minimap { padding: 0; overflow: hidden; border: 2px solid rgba(255, 255, 255, 0.35); }
.hud-minimap canvas { display: block; }
.hud-fps { padding: 3px 8px; font: 12px ui-monospace, Menlo, monospace; opacity: 0.85; }
`

/** Injecte la feuille de style du HUD une seule fois par document. */
export function injectStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
}

/** Crée un élément avec une classe et, si fourni, un texte (jamais du HTML). */
export function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/** Rejoue une animation CSS sur un élément déjà à l'écran. */
export function replay(node, className) {
  node.classList.remove(className)
  void node.offsetWidth
  node.classList.add(className)
}
