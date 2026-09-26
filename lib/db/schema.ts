import type { UIMessage } from "ai"
import {
  bigint,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"

/**
 * Jeton de session Trigger.dev du chat, tel que le transport le restaure au
 * chargement de la page. Le curseur de reprise du flux vit à part, dans
 * `GameChatCursors` : c'est `TranscriptStorage.save` qui l'écrit à chaque
 * tour, pas le code qui gère ce jeton.
 */
export type GameChatSession = {
  publicAccessToken: string
}

/**
 * Curseurs de reprise du flux Trigger.dev de la partie, écrits par
 * `gameTranscriptStorage.save` (voir `trigger/chat-store.ts`). Opaques : rien
 * ici ne les interprète, ils sont juste rendus au runtime au tour suivant.
 */
export type GameChatCursors = {
  lastOutEventId?: string
  lastInEventId?: string
}

export const games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Clerk `org_id` — Clerk reste la source de vérité des identités. */
    orgId: text("org_id").notNull(),
    title: text("title").notNull(),
    /** Fil du chat de la partie, au format `UIMessage` de l'AI SDK. */
    messages: jsonb("messages").$type<UIMessage[]>().notNull().default([]),
    /** Session Trigger.dev du chat ; `null` tant que le chat n'a pas démarré. */
    chatSession: jsonb("chat_session").$type<GameChatSession>(),
    /**
     * État opaque de la transcript storage (résumé de compaction, contexte
     * injecté) ; `null` tant que rien n'a été enregistré. Voir
     * `gameTranscriptStorage` dans `trigger/chat-store.ts`.
     */
    chatState: jsonb("chat_state"),
    /** Curseurs de reprise du flux Trigger.dev ; `null` avant le premier tour. */
    chatCursors: jsonb("chat_cursors").$type<GameChatCursors>(),
    /** Sandbox Daytona de la partie ; `null` tant qu'elle n'est pas créée. */
    sandboxId: text("sandbox_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  // Alimente la liste « Recents » de la sidebar, filtrée par organisation.
  (t) => [index("games_org_updated_idx").on(t.orgId, t.updatedAt.desc())]
)

export type Game = typeof games.$inferSelect
export type NewGame = typeof games.$inferInsert

export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Clerk `org_id` — Clerk reste la source de vérité des identités. */
    orgId: text("org_id").notNull(),
    /** Ce que représente la ligne, ex. `"step:<responseId>"`. */
    entryKey: text("entry_key").notNull(),
    /** Milliardièmes de dollar ; peut être négatif. */
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique().on(t.orgId, t.entryKey)]
)

export type CreditLedgerEntry = typeof creditLedger.$inferSelect
export type NewCreditLedgerEntry = typeof creditLedger.$inferInsert
