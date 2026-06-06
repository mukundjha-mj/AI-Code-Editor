import { Pool } from "pg";
import { env } from "../../config/env";

export const createPostgresPool = () => {
  if (!env.DATABASE_URL) {
    return null;
  }

  return new Pool({ connectionString: env.DATABASE_URL });
};
