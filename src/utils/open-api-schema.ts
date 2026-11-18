import type { SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';

export function openApiSchema(schema: z.ZodType): SchemaObject {
  return z.toJSONSchema(schema, { target: 'openapi-3.0' }) as SchemaObject;
}
