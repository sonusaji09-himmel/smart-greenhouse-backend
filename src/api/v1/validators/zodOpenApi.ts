import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

/**
 * Augments Zod's prototype with `.openapi(...)` for documentation metadata.
 *
 * Must be imported exactly once, before any schema that calls `.openapi()`.
 * All validator modules import `z` from this file to guarantee that ordering.
 */
extendZodWithOpenApi(z);

export { z };
