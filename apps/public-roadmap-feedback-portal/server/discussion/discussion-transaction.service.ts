import type { D1Database, D1PreparedStatement, D1RunResult } from "../portal-env.types.js";

export class DiscussionTransactionService {
  constructor(private readonly db: D1Database) {}

  commit = async (...groups: D1PreparedStatement[][]): Promise<D1RunResult[]> =>
    this.db.batch(groups.flat());
}
