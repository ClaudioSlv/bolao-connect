import { errorMessage, logAppError } from "@/lib/app-error-log";

export async function register() {}

export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routePath: string; routeType: string },
) {
  await logAppError({
    source: context.routePath || request.path || "servidor",
    message: errorMessage(error),
    details: {
      method: request.method,
      route_type: context.routeType,
    },
  });
}
