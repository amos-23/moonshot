import path from "path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/lib/db/schema";
import type { DB } from "@/lib/db";
import { saveProfile } from "@/lib/services/profiles";
import { profileSchema } from "@/lib/validation";

export async function testDb(): Promise<DB> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.join(__dirname, "..", "drizzle") });
  return db as unknown as DB;
}

let n = 0;
export async function makeUser(db: DB, overrides: Record<string, unknown> = {}) {
  n += 1;
  const [user] = await db.insert(schema.users).values({ email: `user${n}-${Date.now()}@example.com` }).returning();
  const input = profileSchema.parse({
    name: `Person ${n}`,
    headline: "Builder",
    roleCategory: "engineer",
    bio: "I build things for African markets.",
    interests: ["ai"],
    goals: ["meet_interesting_people"],
    offers: [],
    attendance: "in_person",
    networkingStyle: "both",
    visibility: "members",
    contactPreference: "everyone",
    ...overrides,
  });
  const { profile } = await saveProfile(db, user.id, input);
  return { user, profile };
}
