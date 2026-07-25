import { AccessError } from "@/lib/access";

/** Message to show the user for an error thrown inside a server action. */
export function errorMessage(error: unknown): string {
  if (error instanceof AccessError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

/**
 * next/navigation's redirect() signals by throwing. Any catch block in a server
 * action has to let that through untouched.
 */
export function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export function withError(path: string, error: unknown): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}error=${encodeURIComponent(errorMessage(error))}`;
}
