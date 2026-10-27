import { connect, MIGRATIONS } from "./db";

async function main() {
  const { db, close, kind } = await connect();
  if (kind === "postgres") {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(db as never, { migrationsFolder: MIGRATIONS });
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as never, { migrationsFolder: MIGRATIONS });
  }
  console.log(`Migrations applied (${kind}).`);
  await close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
