/**
 * Audio synthétisé avec WebAudio : aucun fichier son à charger, donc rien à
 * embarquer ni à télécharger. Les navigateurs bloquent l'audio avant un geste
 * de l'utilisateur ; le contexte est donc créé et repris au premier clic,
 * toucher ou touche (les sons demandés avant sont simplement ignorés).
 *
 * `tone` et `noise` sont les briques ; `sfx.*` sont des sons prêts à l'emploi ;
 * `music.play(...)` joue une boucle d'arpèges.
 */
export function createAudio({ volume = 0.5 } = {}) {
  let ctx = null
  let master = null
  let muted = false
  let masterVolume = volume
  let noiseBuffer = null

  function ensure() {
    if (!ctx) {
      const Context = window.AudioContext ?? window.webkitAudioContext
      if (!Context) return null
      ctx = new Context()
      master = ctx.createGain()
      master.gain.value = muted ? 0 : masterVolume
      master.connect(ctx.destination)
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {})
    return ctx
  }

  const unlock = () => ensure()
  for (const type of ["pointerdown", "keydown", "touchstart"]) {
    window.addEventListener(type, unlock, { passive: true })
  }

  /**
   * Note : oscillateur avec enveloppe, et glissando optionnel de `freq` vers `to`.
   * @param {{ freq?: number, to?: number, duration?: number, type?: OscillatorType,
   *   volume?: number, attack?: number, delay?: number }} [note]
   */
  function tone({
    freq = 440,
    to,
    duration = 0.15,
    type = "square",
    volume: level = 0.3,
    attack = 0.005,
    delay = 0,
  } = {}) {
    if (!ensure() || muted) return
    const start = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, start)
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), start + duration)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(level, start + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    osc.connect(gain).connect(master)
    osc.start(start)
    osc.stop(start + duration + 0.02)
  }

  /** Bruit blanc filtré : explosions, impacts, vent. */
  function noise({
    duration = 0.3,
    volume: level = 0.3,
    filter = 1200,
    filterTo,
    delay = 0,
  } = {}) {
    if (!ensure() || muted) return
    if (!noiseBuffer) {
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
      const data = noiseBuffer.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    }
    const start = ctx.currentTime + delay
    const source = ctx.createBufferSource()
    const lowpass = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    source.buffer = noiseBuffer
    source.loop = true
    lowpass.type = "lowpass"
    lowpass.frequency.setValueAtTime(filter, start)
    if (filterTo) lowpass.frequency.exponentialRampToValueAtTime(Math.max(filterTo, 1), start + duration)
    gain.gain.setValueAtTime(level, start)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    source.connect(lowpass).connect(gain).connect(master)
    source.start(start)
    source.stop(start + duration + 0.02)
  }

  const sfx = {
    click: () => tone({ freq: 660, to: 880, duration: 0.06, type: "triangle" }),
    jump: () => tone({ freq: 300, to: 700, duration: 0.18, type: "square", volume: 0.2 }),
    coin() {
      tone({ freq: 988, duration: 0.07, type: "square", volume: 0.2 })
      tone({ freq: 1319, duration: 0.25, type: "square", volume: 0.2, delay: 0.07 })
    },
    shoot: () => tone({ freq: 900, to: 120, duration: 0.15, type: "sawtooth", volume: 0.2 }),
    hit() {
      tone({ freq: 200, to: 60, duration: 0.2, type: "sawtooth", volume: 0.3 })
      noise({ duration: 0.12, volume: 0.25, filter: 2500 })
    },
    explosion: () => noise({ duration: 0.7, volume: 0.5, filter: 2200, filterTo: 80 }),
    powerup() {
      ;[523, 659, 784, 1047].forEach((freq, i) =>
        tone({ freq, duration: 0.12, type: "triangle", volume: 0.25, delay: i * 0.07 }),
      )
    },
    win() {
      ;[523, 659, 784, 1047, 1319].forEach((freq, i) =>
        tone({ freq, duration: 0.2, type: "triangle", volume: 0.25, delay: i * 0.11 }),
      )
    },
    lose() {
      ;[392, 349, 294, 220].forEach((freq, i) =>
        tone({ freq, duration: 0.3, type: "sawtooth", volume: 0.2, delay: i * 0.18 }),
      )
    },
  }

  let musicTimer = null
  const music = {
    /**
     * Boucle d'arpège. `notes` : fréquences en Hz (`0` = silence).
     * @example audio.music.play([220, 277, 330, 277], { tempo: 140 })
     */
    play(notes, { tempo = 120, type = "triangle", volume: level = 0.08 } = {}) {
      music.stop()
      if (!ensure()) return
      const step = 60 / tempo / 2
      let index = 0
      const tick = () => {
        const freq = notes[index++ % notes.length]
        if (freq) tone({ freq, duration: step * 0.9, type, volume: level })
      }
      tick()
      musicTimer = setInterval(tick, step * 1000)
    },
    stop() {
      clearInterval(musicTimer)
      musicTimer = null
    },
  }

  return {
    tone,
    noise,
    sfx,
    music,
    get muted() {
      return muted
    },
    setMuted(value) {
      muted = value
      if (master) master.gain.value = muted ? 0 : masterVolume
    },
    toggleMute() {
      this.setMuted(!muted)
      return muted
    },
    setVolume(value) {
      masterVolume = Math.min(1, Math.max(0, value))
      if (master && !muted) master.gain.value = masterVolume
    },
    dispose() {
      music.stop()
      for (const type of ["pointerdown", "keydown", "touchstart"]) {
        window.removeEventListener(type, unlock)
      }
      ctx?.close()
      ctx = null
    },
  }
}
