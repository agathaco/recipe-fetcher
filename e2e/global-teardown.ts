import { neon } from "@neondatabase/serverless";

// Remove anything the E2E run created. Everything it makes is prefixed "e2e-".
export default async function globalTeardown() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`delete from recipe where title like 'e2e-%'`;
  await sql`delete from tag where name like 'e2e-%'`;
}
