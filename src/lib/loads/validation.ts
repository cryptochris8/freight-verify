import { randomInt } from "crypto";
import { loadCreateSchema } from "@/lib/validation/schemas";

/**
 * Form schema for the load creation UI.
 * Derives from loadCreateSchema to ensure consistent validation rules
 * between the Server Action path and the API route path.
 */
export const loadFormSchema = loadCreateSchema;

export type LoadFormValues = typeof loadCreateSchema._output;

export function generateReferenceNumber(): string {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, "0") +
    now.getDate().toString().padStart(2, "0");
  const rand = randomInt(100000, 1000000).toString();
  return "FV-" + dateStr + "-" + rand;
}
