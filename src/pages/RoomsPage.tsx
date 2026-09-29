import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.tsx";
import { useToast } from "../components/Toaster.tsx";
import { useCreateRoom, useRooms } from "../hooks/rooms.ts";
import { initials, plural, roomColor, timeAgo } from "../lib/format.ts";
import { Modal } from "../components/Modal.tsx";
import { RoomForm } from "../components/RoomForm.tsx";
import { RoomAvatar } from "../components/RoomAvatar.tsx";
import type { Room } from "../lib/api.ts";

export function RoomsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const rooms = useRooms();
  const createRoom = useCreateRoom();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");

  // "New room" in the sidebar links to /?new=1 so it works from any page.
  const creating = searchParams.get("new") === "1";
  const setCreating = (open: boolean) => setSearchParams(open ? { new: "1" } : {}, { replace: !open });

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle || !rooms.data) return rooms.data;
    return rooms.data.filter(room => `${room.name} ${room.description}`.toLowerCase().includes(needle));
  }, [rooms.data, search]);

  const newRoomButton = (
    <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
      New room
    </button>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <p className="page-eyebrow">
            {greeting()}, {user?.name.split(" ")[0]}
          </p>
          <h1 className="page-title">Your study rooms</h1>
          <p className="page-subtitle">Each room holds the notes, quizzes and people for one subject.</p>
        </div>
        {rooms.data && rooms.data.length > 0 && newRoomButton}
      </div>

      {rooms.data && rooms.data.length > 3 && (
        <div className="toolbar">
          <label className="search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span className="visually-hidden">Search rooms</span>
            <input type="search" placeholder="Search rooms" value={search} onChange={e => setSearch(e.target.value)} />
          </label>
          <span className="muted toolbar-count">
            {filtered?.length === rooms.data.length ? `${rooms.data.length} rooms` : `${filtered?.length} of ${rooms.data.length} rooms`}
          </span>
        </div>
      )}

      {rooms.isPending ? (
        <ul className="room-grid" aria-busy="true" aria-label="Loading rooms">
          {[0, 1, 2].map(i => (
            <li key={i} className="room-card skeleton" />
          ))}
        </ul>
      ) : rooms.isError ? (
        <div className="empty-state">
          <p className="empty-title">Couldn't load your rooms</p>
          <p className="muted">{rooms.error.message}</p>
          <button type="button" className="btn btn-secondary" onClick={() => rooms.refetch()}>
            Try again
          </button>
        </div>
      ) : rooms.data.length === 0 ? (
        <div className="empty-state">
          <svg className="empty-doodle" viewBox="0 0 120 90" fill="none" aria-hidden="true">
            <path d="M60 22C46 12 28 11 12 15v58c16-4 33-2 48 8 15-10 32-12 48-8V15c-16-4-34-3-48 7z" />
            <path d="M60 22v59" />
            <path d="M22 32c8-2 17-2 26 1M22 44c8-2 17-2 26 1M72 33c9-3 18-3 26-1" />
          </svg>
          <p className="empty-title">Create your first study room</p>
          <p className="muted">A room is where one subject lives: upload your notes, generate quizzes, and invite friends.</p>
          {newRoomButton}
        </div>
      ) : filtered?.length === 0 ? (
        <div className="empty-state">
          <p className="empty-title">No rooms match "{search}"</p>
          <button type="button" className="btn btn-secondary" onClick={() => setSearch("")}>
            Clear search
          </button>
        </div>
      ) : (
        <ul className="room-grid">
          {filtered?.map(room => (
            <RoomCard key={room.id} room={room} />
          ))}
        </ul>
      )}

      <Modal open={creating} title="New study room" onClose={() => setCreating(false)}>
        <RoomForm
          submitLabel="Create room"
          pendingLabel="Creating…"
          onCancel={() => setCreating(false)}
          onSubmit={async input => {
            const room = await createRoom.mutateAsync(input);
            navigate(`/rooms/${room.id}`, { replace: true });
            toast(`Created "${room.name}"`);
          }}
        />
      </Modal>
    </>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function RoomCard({ room }: { room: Room }) {
  return (
    <li>
      <Link to={`/rooms/${room.id}`} className="room-card">
        <div className="room-card-top">
          <RoomAvatar name={initials(room.name)} color={roomColor(room.id)} />
          {room.role === "owner" && <span className="badge">Owner</span>}
        </div>
        <h2 className="room-card-name">{room.name}</h2>
        <p className={`room-card-description ${room.description ? "" : "muted"}`}>{room.description || "No description"}</p>
        <p className="room-card-meta">
          {plural(room.memberCount, "member")} · Updated {timeAgo(room.updatedAt)}
        </p>
      </Link>
    </li>
  );
}
