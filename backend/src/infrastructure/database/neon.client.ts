import { neon } from "@neondatabase/serverless";
import { env } from "../../config/env";

export const createNeonSqlClient = () => {
  if (!env.NEON_DATABASE_URL) {
    return null;
  }

  return neon(env.NEON_DATABASE_URL);
};
