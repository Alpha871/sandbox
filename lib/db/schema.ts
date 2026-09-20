import type { UIMessage } from "ai"
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

/**
 * État de la session Trigger.dev du chat, tel que le transport le restaure :
 * jeton d'accès de la session et curseur de reprise du flux. Écrit avec
 * `messages` dans la même requête, sinon un rechargement reprendrait depuis
 * un curseur périmé et afficherait la réponse deux fois.
 */
export type GameChatSession = {
  publicAccessToken: string
  lastEventId?: string
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
