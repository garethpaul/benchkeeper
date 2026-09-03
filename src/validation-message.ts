import { ZodError } from 'zod';

// Show the correction, not Zod's serialized diagnostic object. Paths remain
// useful for imported backups, where the organizer is editing structured data.
export function validationMessage(error: unknown, fallback: string): string {
  if (error instanceof ZodError)
    return error.issues
      .map((issue) =>
        issue.path.length ? `${issue.path.map(String).join('.')}: ${issue.message}` : issue.message
      )
      .join(' ');
  return error instanceof Error ? error.message : fallback;
}
