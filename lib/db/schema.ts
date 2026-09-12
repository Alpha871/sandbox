import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

export const games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Clerk `org_id` — Clerk reste la source de vérité des identités. */
    orgId: text("org_id").notNull(),
    title: text("title").notNull(),
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
