import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useDeleteRoom, useRoom, useUpdateRoom } from "../hooks/rooms.ts";
import { ApiError, type RoomMember } from "../lib/api.ts";
import { formatDate, initials, plural, roomColor } from "../lib/format.ts";
import { Modal } from "../components/Modal.tsx";
import { RoomForm } from "../components/RoomForm.tsx";
import { RoomAvatar } from "../components/RoomAvatar.tsx";
import { FormAlert } from "../components/fields.tsx";
import { useToast } from "../components/Toaster.tsx";
import { UserAvatar } from "../components/UserAvatar.tsx";
import { useAuth } from "../auth/AuthContext.tsx";

const TABS = [
  { id: "materials", label: "Materials" },
  { id: "quizzes", label: "Quizzes" },
  { id: "tutor", label: "AI Tutor" },
  { id: "progress", label: "Progress" },
  { id: "members", label: "Members" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function RoomPage() {
  const { roomId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: TabId = TABS.some(t => t.id === tabParam) ? (tabParam as TabId) : "materials";

  const query = useRoom(roomId);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (query.isPending) {
    return (
      <div className="page-center-inline" role="status">
        <span className="spinner spinner-lg" aria-hidden="true" />
        <span className="visually-hidden">Loading room…</span>
      </div>
    );
  }

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="empty-state">
        <p className="empty-title">{notFound ? "Room not found" : "Couldn't load this room"}</p>
        <p className="muted">{notFound ? "It may have been deleted, or you're not a member." : query.error.message}</p>
        <Link to="/" className="btn btn-secondary">
          Back to your rooms
        </Link>
      </div>
    );
  }

  const { room, members } = query.data;
  const isOwner = room.role === "owner";

  return (
    <>
      <Link to="/" className="back-link">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
        All rooms
      </Link>

      <header className="room-header">
        <RoomAvatar name={initials(room.name)} color={roomColor(room.id)} size="lg" />
        <div className="room-header-text">
          <h1 className="page-title">{room.name}</h1>
          {room.description && <p className="room-header-description">{room.description}</p>}
          <p className="room-card-meta">
            {plural(room.memberCount, "member")} · You're {isOwner ? "the owner" : "a member"}
          </p>
        </div>
        {isOwner && (
          <div className="room-header-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button type="button" className="btn btn-danger-outline" onClick={() => setDeleting(true)}>
              Delete
            </button>
          </div>
        )}
      </header>

      <nav className="tabs" aria-label="Room sections">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className="tab"
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() => setSearchParams(t.id === "materials" ? {} : { tab: t.id }, { replace: true })}
          >
            {t.label}
            {t.id === "members" && <span className="tab-count">{room.memberCount}</span>}
          </button>
        ))}
      </nav>

      <section className="tab-panel">
        {tab === "materials" && (
          <ComingSoon title="Upload your study materials">
            PDFs, Word documents, slides and photos of your notes will live here. Everything you add becomes material for your quizzes and your AI tutor.
          </ComingSoon>
        )}
        {tab === "quizzes" && (
          <ComingSoon title="Quizzes from your notes">
            Generate multiple-choice, true/false and fill-in-the-blank quizzes from one file or the whole room, then take them and see your score.
          </ComingSoon>
        )}
        {tab === "tutor" && (
          <ComingSoon title="Chat with your material">
            Ask questions about anything you've uploaded. The tutor answers from your notes and tells you which document it used.
          </ComingSoon>
        )}
        {tab === "progress" && (
          <ComingSoon title="See what you know">
            Accuracy, questions answered and how you're doing on each topic, so you know what to revise.
          </ComingSoon>
        )}
        {tab === "members" && <MembersList members={members} />}
      </section>

      <Modal open={editing} title="Edit room" onClose={() => setEditing(false)}>
        <EditRoom roomId={room.id} initial={{ name: room.name, description: room.description }} onDone={() => setEditing(false)} />
      </Modal>

      <Modal open={deleting} title="Delete this room?" onClose={() => setDeleting(false)}>
        <DeleteRoom roomId={room.id} name={room.name} memberCount={room.memberCount} onCancel={() => setDeleting(false)} />
      </Modal>
    </>
  );
}

function ComingSoon({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty-state empty-state-panel">
      <span className="badge badge-muted">Coming soon</span>
      <p className="empty-title">{title}</p>
      <p className="muted">{children}</p>
    </div>
  );
}

function MembersList({ members }: { members: RoomMember[] }) {
  const { user } = useAuth();
  return (
    <div className="members">
      <div className="members-header">
        <p className="muted">Everyone here can see the room's materials and quizzes.</p>
        <button type="button" className="btn btn-secondary" disabled title="Invites are coming soon">
          Invite people
        </button>
      </div>
      <ul className="member-list">
        {members.map(member => (
          <li key={member.userId} className="member">
            <UserAvatar name={member.name} url={member.avatarUrl} size="md" />
            <div className="member-text">
              <span className="member-name">
                {member.name}
                {member.userId === user?.id && <span className="muted"> (you)</span>}
              </span>
              <span className="member-meta">Joined {formatDate(member.joinedAt)}</span>
            </div>
            <span className={`badge ${member.role === "owner" ? "" : "badge-muted"}`}>{member.role === "owner" ? "Owner" : "Member"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EditRoom({ roomId, initial, onDone }: { roomId: string; initial: { name: string; description: string }; onDone: () => void }) {
  const updateRoom = useUpdateRoom(roomId);
  const { toast } = useToast();
  return (
    <RoomForm
      initial={initial}
      submitLabel="Save changes"
      pendingLabel="Saving…"
      onCancel={onDone}
      onSubmit={async input => {
        await updateRoom.mutateAsync(input);
        onDone();
        toast("Room updated");
      }}
    />
  );
}

function DeleteRoom({ roomId, name, memberCount, onCancel }: { roomId: string; name: string; memberCount: number; onCancel: () => void }) {
  const deleteRoom = useDeleteRoom(roomId);
  const navigate = useNavigate();
  const { toast } = useToast();

  return (
    <div className="stack">
      {deleteRoom.isError && <FormAlert>{deleteRoom.error.message}</FormAlert>}
      <p>
        <strong>{name}</strong> and everything in it will be permanently deleted
        {memberCount > 1 ? ` for all ${memberCount} members` : ""}. This can't be undone.
      </p>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={deleteRoom.isPending}
          aria-busy={deleteRoom.isPending}
          onClick={async () => {
            await deleteRoom.mutateAsync();
            navigate("/", { replace: true });
            toast(`Deleted "${name}"`);
          }}
        >
          {deleteRoom.isPending && <span className="spinner" aria-hidden="true" />}
          {deleteRoom.isPending ? "Deleting…" : "Delete room"}
        </button>
      </div>
    </div>
  );
}
