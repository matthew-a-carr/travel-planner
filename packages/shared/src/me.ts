import { z } from 'zod';

/**
 * Response body for `GET /api/v1/me`.
 *
 * `name` is nullable because next-auth can emit a profile without a
 * display name; the server propagates that as `null` rather than
 * inventing one.
 *
 * `isApproved` reflects the ADR 029 access policy — the user can sign
 * in (the `/me` payload is returned) but trip/spend endpoints will
 * refuse them until an admin approves the account.
 */
export const meResponseSchema = z.object({
  id: z.string().min(1),
  email: z.string().min(1),
  name: z.string().nullable(),
  isApproved: z.boolean(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;
