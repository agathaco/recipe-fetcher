import { neon } from "@neondatabase/serverless";

// Remove anything the E2E run created. Everything it makes is prefixed "e2e-".
// Deleting the user rows first is enough on its own (recipe/tag/session all
// cascade off owner_id/user_id -> user.id), the recipe/tag deletes below are
// just a backstop for anything not tied to an e2e-prefixed account.
export default async function globalTeardown() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`delete from "user" where email like 'e2e-%'`;
  await sql`delete from recipe where title like 'e2e-%'`;
  await sql`delete from tag where name like 'e2e-%'`;
}
