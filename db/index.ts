import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — see .env.example");
}

// neon-http: each query is a single stateless fetch to Neon's HTTP endpoint.
// Good fit for serverless / RSC where we don't hold a long-lived connection.
// If we ever need transactions or LISTEN/NOTIFY, switch to the WebSocket pool driver.
const sql = neon(process.env.DATABASE_URL);

export const db = drizzle(sql, { schema });
