"use client"

import { useEffect, useState } from "react"

import {
  DEFAULT_GAME_MODEL_ID,
  isGameModelId,
  type GameModelId,
} from "./model-catalog"

const STORAGE_KEY = "game-model"

/**
 * Le dernier modèle choisi, dans un chat ou avant même de créer une partie
 * (`NewGameComposer`), gardé dans `localStorage` pour servir de défaut au
 * prochain chat — y compris celui de la partie qu'on est en train de créer :
 * la préférence est déjà enregistrée quand `ChatThread` monte, juste après la
 * redirection.
 *
 * Le rendu serveur ne connaît pas cette préférence, donc le premier rendu
 * client reste sur `DEFAULT_GAME_MODEL_ID` et se met à jour juste après (pas
 * d'erreur d'hydratation, juste un choix qui apparaît un instant plus tard).
 */
export function usePreferredModel() {
  const [modelId, setModelIdState] = useState<GameModelId>(
    DEFAULT_GAME_MODEL_ID
  )

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored && isGameModelId(stored)) setModelIdState(stored)
    } catch {
      // Stockage indisponible (navigation privée, etc.) : on garde le défaut.
    }
  }, [])

  function setModelId(id: GameModelId) {
    setModelIdState(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // Idem : la préférence ne survivra pas à la session, tant pis.
    }
  }

  return [modelId, setModelId] as const
}
