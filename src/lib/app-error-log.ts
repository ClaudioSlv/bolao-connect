import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type ErrorLogInput = {
  source: string;
  message: string;
  poolId?: string | null;
  details?: Record<string, unknown>;
};

const clean = (value: string, limit: number) =>
  value
    .replace(
      /(token|secret|password|authorization)\s*[=:]\s*[^\s,;]+/gi,
      "$1=[protegido]",
    )
    .slice(0, limit);

export async function logAppError(input: ErrorLogInput) {
  try {
    const s = createAdminClient();
    await s.from("app_error_logs").insert({
      pool_id: input.poolId || null,
      source: clean(input.source || "server", 120),
      message: clean(input.message || "Erro não identificado", 800),
      details: input.details || {},
    });
  } catch (error) {
    console.error("Falha ao registrar erro no painel", error);
  }
}

export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : String(error || "Erro desconhecido");
}
