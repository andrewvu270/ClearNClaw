/**
 * Validates that a task description is non-empty and not whitespace-only.
 * Returns true if the input is a valid task description.
 */
export function isValidTaskDescription(input: string): boolean {
  return input.trim().length > 0
}
