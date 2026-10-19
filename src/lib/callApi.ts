import { ApiError, request } from "./api.ts";

/** Someone in a room's study call, as the server lists them (from LiveKit). */
export interface CallParticipant {
  userId: string;
  name: string;
  avatarUrl: string | null;
  joinedAt: string | null;
  micOn: boolean;
  camOn: boolean;
  screenOn: boolean;
}

export interface CallStatus {
  /** False until the server has LiveKit keys: hide or disable the call button. */
  configured: boolean;
  participants: CallParticipant[];
}

/** What the client needs to connect to the room's LiveKit call. */
export interface CallToken {
  token: string;
  url: string;
  roomName: string;
}

/** Payload of the room socket event `call:updated`. */
export interface CallUpdatedEvent {
  roomId: string;
  participants: CallParticipant[];
}

const callPath = (roomId: string) => `/app/rooms/${encodeURIComponent(roomId)}/call`;

export const callApi = {
  status: (roomId: string) => request<CallStatus>(callPath(roomId)),
  token: async (roomId: string): Promise<CallToken> => {
    const data = await request<CallToken | undefined>(`${callPath(roomId)}/token`, { method: "POST" });
    if (!data?.token || !data.url) throw new ApiError("Couldn't start the call. Please try again.", 500);
    return data;
  },
};
