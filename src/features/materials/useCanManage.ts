import { useAuth } from "../../auth/AuthContext.tsx";
import type { Room } from "../../lib/api.ts";
import type { Material } from "../../lib/learningApi.ts";

/** Only the uploader or the room owner may delete or retry a material (the server enforces this too). */
export function useCanManage(room: Room): (material: Material) => boolean {
  const { user } = useAuth();
  return material => room.role === "owner" || (!!user && material.uploadedBy === user.id);
}
