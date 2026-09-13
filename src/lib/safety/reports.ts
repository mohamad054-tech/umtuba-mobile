import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mapUgcRpcError,
  validateReportInput,
  type UgcReasonCode,
} from "@/src/lib/safety/ugcPolicy";

export type SafetyActionResult<T = Record<string, never>> =
  | ({ ok: true } & T)
  | {
      ok: false;
      message: string;
      requiresAuth?: boolean;
      duplicate?: boolean;
    };

export async function reportUgcContent(
  supabase: SupabaseClient,
  input: {
    postId: number;
    reasonCode: UgcReasonCode | string;
    detail?: string | null;
  }
): Promise<SafetyActionResult<{ reportId: string }>> {
  if (!Number.isFinite(input.postId) || input.postId <= 0) {
    return { ok: false, message: "That video cannot be reported." };
  }

  const validated = validateReportInput({
    reasonCode: input.reasonCode,
    detail: input.detail,
  });
  if (!validated.ok) return validated;

  const { data, error } = await supabase.rpc("report_ugc_content", {
    p_post_id: input.postId,
    p_reason_code: validated.reasonCode,
    p_reason_detail: validated.detail,
  });

  if (error) {
    return mapUgcRpcError(
      error.message,
      "Unable to send this report. Please try again."
    );
  }

  const reportId = typeof data === "string" ? data : data != null ? String(data) : "";
  if (!reportId) {
    return { ok: false, message: "Unable to send this report. Please try again." };
  }
  return { ok: true, reportId };
}

export async function reportUgcUser(
  supabase: SupabaseClient,
  input: {
    userId: string;
    reasonCode: UgcReasonCode | string;
    detail?: string | null;
  }
): Promise<SafetyActionResult<{ reportId: string }>> {
  const userId = input.userId?.trim();
  if (!userId) {
    return { ok: false, message: "That account cannot be reported." };
  }

  const validated = validateReportInput({
    reasonCode: input.reasonCode,
    detail: input.detail,
  });
  if (!validated.ok) return validated;

  const { data, error } = await supabase.rpc("report_ugc_user", {
    p_user_id: userId,
    p_reason_code: validated.reasonCode,
    p_reason_detail: validated.detail,
  });

  if (error) {
    return mapUgcRpcError(
      error.message,
      "Unable to send this report. Please try again."
    );
  }

  const reportId = typeof data === "string" ? data : data != null ? String(data) : "";
  if (!reportId) {
    return { ok: false, message: "Unable to send this report. Please try again." };
  }
  return { ok: true, reportId };
}
