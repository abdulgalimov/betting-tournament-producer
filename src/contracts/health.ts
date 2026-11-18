import { z } from 'zod';

export const HealthResponseSchema = z.strictObject({ status: z.literal('ok') });
