import { and, eq } from 'drizzle-orm';
import type {
  ExecuteIdempotentCommandInput,
  IdempotentCommandExecutor,
  IdempotentCommandRepositories,
  IdempotentCommandResult,
  StoredHttpResponse,
} from '@/application/ports/idempotent-command-executor';
import type { DbSession } from './client';
import { idempotentCommands } from './schema';

export type CreateCommandRepositories = (db: DbSession) => IdempotentCommandRepositories;

export class DrizzleIdempotentCommandExecutor implements IdempotentCommandExecutor {
  constructor(
    private readonly db: DbSession,
    private readonly createRepositories: CreateCommandRepositories,
  ) {}

  async execute(
    input: ExecuteIdempotentCommandInput,
    command: (repositories: IdempotentCommandRepositories) => Promise<StoredHttpResponse>,
  ): Promise<IdempotentCommandResult> {
    return this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(idempotentCommands)
        .values({
          userId: input.userId,
          operation: input.operation,
          idempotencyKey: input.idempotencyKey,
          requestHash: input.requestHash,
        })
        .onConflictDoNothing({
          target: [
            idempotentCommands.userId,
            idempotentCommands.operation,
            idempotentCommands.idempotencyKey,
          ],
        })
        .returning({ id: idempotentCommands.id });

      if (!inserted[0]) {
        const existing = await tx
          .select({
            requestHash: idempotentCommands.requestHash,
            responseStatus: idempotentCommands.responseStatus,
            responseBody: idempotentCommands.responseBody,
            completedAt: idempotentCommands.completedAt,
          })
          .from(idempotentCommands)
          .where(
            and(
              eq(idempotentCommands.userId, input.userId),
              eq(idempotentCommands.operation, input.operation),
              eq(idempotentCommands.idempotencyKey, input.idempotencyKey),
            ),
          )
          .limit(1);

        const replay = existing[0];
        if (!replay) throw new Error('Idempotency claim disappeared');
        if (replay.requestHash !== input.requestHash) return { kind: 'conflict' };
        if (replay.responseStatus === null || replay.completedAt === null) {
          throw new Error('Idempotency claim has no completed response');
        }

        return {
          kind: 'replayed',
          response: { status: replay.responseStatus, body: replay.responseBody },
        };
      }

      const response = await command(this.createRepositories(tx));
      await tx
        .update(idempotentCommands)
        .set({
          responseStatus: response.status,
          responseBody: response.body,
          completedAt: new Date(),
        })
        .where(eq(idempotentCommands.id, inserted[0].id));

      return { kind: 'executed', response };
    });
  }
}
