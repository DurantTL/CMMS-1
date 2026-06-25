import { revalidatePath } from "next/cache";

/**
 * `revalidatePath` wrapper that is safe to call outside a Next.js request /
 * render scope.
 *
 * When a server action or route handler is invoked directly — e.g. from an
 * integration test or a one-off script — `revalidatePath` throws
 * `Invariant: static generation store missing in revalidatePath ...` because
 * there is no request store to attach the revalidation to. In that context the
 * revalidation is a meaningless no-op anyway, so we swallow ONLY that specific
 * invariant and rethrow anything else.
 *
 * Inside a real request (the normal production path) this behaves exactly like
 * `revalidatePath`.
 */
export function safeRevalidatePath(path: string, type?: "layout" | "page"): void {
  try {
    if (type) {
      revalidatePath(path, type);
    } else {
      revalidatePath(path);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("static generation store")) {
      return;
    }
    throw error;
  }
}
