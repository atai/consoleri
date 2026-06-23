import type { IpcMainInvokeEvent } from 'electron'
import type { ZodTypeAny, z } from 'zod'

/**
 * Wraps an IPC handler with Zod schema validation.
 *
 * For object schemas, pass the payload as a single argument.
 * For tuple schemas, spread the positional args – they are collected into
 * an array before parsing, matching the variadic IPC call signature.
 *
 * On validation failure the returned handler rejects with a ZodError so the
 * renderer receives a structured error and the underlying fn is never called.
 */
export function createHandler<TSchema extends ZodTypeAny>(
  schema: TSchema,
  fn: (args: z.infer<TSchema>) => Promise<unknown>
): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown> {
  return async (_event: IpcMainInvokeEvent, ...rest: unknown[]) => {
    // Tuple schemas receive spread positional arguments; object/primitive
    // schemas receive a single payload.
    const raw = schema._def.typeName === 'ZodTuple' ? rest : rest[0]
    const parsed = schema.parse(raw) as z.infer<TSchema>
    return fn(parsed)
  }
}
