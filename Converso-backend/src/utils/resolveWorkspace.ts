import { supabaseAdmin } from "../lib/supabase";

export async function resolveActiveWorkspace({
  userId,
  workspaceId,
}: {
  userId: string;
  workspaceId?: string;
}) {
  // If workspaceId is explicitly provided, verify membership
  if (workspaceId) {
    const { data, error } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) {
      throw new Error("User is not a member of this workspace");
    }

    return {
      workspaceId: data.workspace_id,
      role: data.role,
    };
  }

  // Otherwise, fallback to user's FIRST workspace (temporary)
  const { data, error } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error("User does not belong to any workspace");
  }

  return {
    workspaceId: data.workspace_id,
    role: data.role,
  };
}

