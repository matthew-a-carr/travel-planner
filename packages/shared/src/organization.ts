import { z } from 'zod';

export const organizationRoleSchema = z.enum(['owner', 'member']);
export type WireOrganizationRole = z.infer<typeof organizationRoleSchema>;

/** Organization choice returned to authenticated mobile clients. */
export const organizationSummarySchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  role: organizationRoleSchema,
});
export type OrganizationSummary = z.infer<typeof organizationSummarySchema>;
