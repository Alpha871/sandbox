/*
 * Rapporte à l'app parente si la partie a planté. Chargé en script classique
 * (pas de `type="module"`) avant `main.js` dans index.html : un script
 * classique s'exécute immédiatement et bloque le parseur, donc les écouteurs
 * ci-dessous sont déjà en place avant même que `main.js` soit demandé — une
 * erreur de syntaxe dedans est donc capturée comme n'importe quelle autre.
 *
 * Protocole : l'app envoie `{ type: "game-ping" }` par postMessage, cette
 * frame répond `{ type: "game-status", error }` avec la première erreur
 * rencontrée. Si la partie va bien, elle ne répond rien du tout — l'app doit
 * traiter un ping resté sans réponse comme "en bonne santé" plutôt que
 * d'attendre un message explicite qui n'arrivera jamais.
 */
;(() => {
  let firstError = null

  function record(details) {
    if (firstError) return
    firstError = details
  }

  window.addEventListener("error", (event) => {
    record({
      message: String(event.message || "Erreur inconnue"),
      source: event.filename || undefined,
      line: event.lineno || undefined,
      column: event.colno || undefined,
      stack: event.error && event.error.stack ? String(event.error.stack) : undefined,
    })
  })

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason
    record({
      message: reason && reason.message ? String(reason.message) : String(reason),
      stack: reason instanceof Error ? String(reason.stack) : undefined,
    })
  })

  window.addEventListener("message", (event) => {
    if (!event.data || event.data.type !== "game-ping") return
    if (!firstError) return
    // La frame n'a pas d'origine parente fiable à vérifier (voir runtime.ts :
    // aperçu cross-origin), donc on répond au `source` du ping plutôt qu'à
    // une origine connue à l'avance.
    const target = event.source || window.parent
    target.postMessage({ type: "game-status", error: firstError }, "*")
  })
})()
