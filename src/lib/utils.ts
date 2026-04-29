// Tailwind class merger used by shadcn primitives in src/components/ui/.
// Combines clsx (conditional class composition) with tailwind-merge
// (intelligent dedupe — later classes override earlier ones for the same
// property, e.g. "p-2 p-4" -> "p-4"). All primitives accept a className
// prop that flows through this helper.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
