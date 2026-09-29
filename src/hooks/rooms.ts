import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type RoomInput } from "../lib/api.ts";
import { queryKeys } from "./queryKeys.ts";

const keys = { all: queryKeys.rooms, detail: queryKeys.room };

export function useRooms() {
  return useQuery({ queryKey: keys.all, queryFn: () => api.rooms().then(d => d.rooms) });
}

export function useRoom(roomId: string) {
  return useQuery({ queryKey: keys.detail(roomId), queryFn: () => api.room(roomId) });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RoomInput) => api.createRoom(input).then(d => d.room),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUpdateRoom(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RoomInput) => api.updateRoom(roomId, input).then(d => d.room),
    // Prefix match: refreshes both the list and this room's detail.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useDeleteRoom(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.deleteRoom(roomId),
    // Only the list: the room page is still mounted until the caller navigates away,
    // and refetching its (now deleted) detail would flash "Room not found".
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all, exact: true }),
  });
}
