import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.tsx";
import { useRooms } from "../hooks/rooms.ts";
import { api, ApiError, type FieldErrors } from "../lib/api.ts";
import { formatDate } from "../lib/format.ts";
import { passwordStrength } from "../lib/passwordStrength.ts";
import { AvatarCropper } from "../components/AvatarCropper.tsx";
import { FormAlert, PasswordField, TextField } from "../components/fields.tsx";
import { Modal } from "../components/Modal.tsx";
import { useToast } from "../components/Toaster.tsx";
import { UserAvatar } from "../components/UserAvatar.tsx";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024; // before cropping; the upload itself is ~50 KB

export function SettingsPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile & settings</h1>
          <p className="page-subtitle">Manage how you appear to others and keep your account secure.</p>
        </div>
      </div>

      <div className="settings">
        <nav className="settings-nav" aria-label="Settings sections">
          <NavLink to="/settings" end className="settings-nav-item">
            Profile
          </NavLink>
          <NavLink to="/settings/security" className="settings-nav-item">
            Password & security
          </NavLink>
          <NavLink to="/settings/account" className="settings-nav-item">
            Account
          </NavLink>
        </nav>
        <div className="settings-content">
          <Routes>
            <Route index element={<ProfileSection />} />
            <Route path="security" element={<SecuritySection />} />
            <Route path="account" element={<AccountSection />} />
            <Route path="*" element={<Navigate to="/settings" replace />} />
          </Routes>
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- profile */

function ProfileSection() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(user?.name ?? "");
  const [nameError, setNameError] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [removing, setRemoving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;
  const nameChanged = name.trim() !== user.name;

  function pick(candidate: File | undefined) {
    if (!candidate) return;
    if (!ACCEPTED.includes(candidate.type)) {
      toast("Choose a JPEG, PNG or WebP image.", "error");
      return;
    }
    if (candidate.size > MAX_BYTES) {
      toast("That image is over 10 MB. Try a smaller one.", "error");
      return;
    }
    setFile(candidate);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    pick(event.dataTransfer.files[0]);
  }

  async function saveName(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setNameError("Name is required");
      return;
    }
    setNameError("");
    setSavingName(true);
    try {
      const { user: updated } = await api.updateProfile({ name });
      updateUser(updated);
      setName(updated.name);
      toast("Name updated");
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.name) setNameError(error.fieldErrors.name);
      else toast(error instanceof Error ? error.message : "Couldn't save your name.", "error");
    } finally {
      setSavingName(false);
    }
  }

  async function removePhoto() {
    setRemoving(true);
    try {
      const { user: updated } = await api.removeAvatar();
      updateUser(updated);
      toast("Photo removed");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn't remove your photo.", "error");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <>
      <section className="card" aria-labelledby="photo-heading">
        <h2 id="photo-heading" className="card-title">
          Profile photo
        </h2>
        <p className="card-description">Shown to people in your study rooms.</p>
        <div className="avatar-editor">
          <button
            type="button"
            className={`avatar-drop ${dragging ? "dragging" : ""}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={event => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            aria-label="Change profile photo"
          >
            <UserAvatar name={user.name} url={user.avatarUrl} size="xl" />
            <span className="avatar-drop-overlay" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
            </span>
          </button>
          <div className="avatar-editor-actions">
            <div className="button-row">
              <button type="button" className="btn btn-primary" onClick={() => inputRef.current?.click()}>
                {user.avatarUrl ? "Change photo" : "Upload photo"}
              </button>
              {user.avatarUrl && (
                <button type="button" className="btn btn-secondary" onClick={removePhoto} disabled={removing}>
                  {removing ? "Removing…" : "Remove"}
                </button>
              )}
            </div>
            <p className="field-hint">JPEG, PNG or WebP. You can also drag an image onto the circle.</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="visually-hidden"
            tabIndex={-1}
            onChange={event => {
              pick(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
      </section>

      <section className="card" aria-labelledby="details-heading">
        <h2 id="details-heading" className="card-title">
          Personal details
        </h2>
        <form className="stack" onSubmit={saveName} noValidate>
          <TextField label="Name" name="name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} error={nameError} maxLength={100} />
          <TextField label="Email" name="email" type="email" value={user.email} readOnly disabled hint="Your email is used to log in and can't be changed yet." />
          <div className="card-footer">
            <span className="field-hint">Member since {formatDate(user.createdAt)}</span>
            <button type="submit" className="btn btn-primary" disabled={!nameChanged || savingName} aria-busy={savingName}>
              {savingName && <span className="spinner" aria-hidden="true" />}
              {savingName ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </section>

      <Modal open={!!file} title="Crop your photo" onClose={() => setFile(null)}>
        {file && (
          <AvatarCropper
            file={file}
            onCancel={() => setFile(null)}
            onConfirm={async image => {
              const extension = image.type === "image/webp" ? "webp" : "png";
              const { user: updated } = await api.uploadAvatar(image, `avatar.${extension}`);
              updateUser(updated);
              setFile(null);
              toast("Photo updated");
            }}
          />
        )}
      </Modal>
    </>
  );
}

/* --------------------------------------------------------------- security */

function SecuritySection() {
  const { replaceToken } = useAuth();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const strength = passwordStrength(newPassword);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const local: FieldErrors = {};
    if (!currentPassword) local.currentPassword = "Enter your current password";
    if (newPassword.length < 8) local.newPassword = "Password must be at least 8 characters";
    if (confirmPassword !== newPassword) local.confirmPassword = "Passwords don't match";
    setErrors(local);
    if (Object.keys(local).length) return;

    setSaving(true);
    try {
      const { token } = await api.changePassword({ currentPassword, newPassword });
      replaceToken(token);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast("Password changed. You've been logged out everywhere else.");
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) setErrors(error.fieldErrors);
      else toast(error instanceof Error ? error.message : "Couldn't change your password.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card" aria-labelledby="password-heading">
      <h2 id="password-heading" className="card-title">
        Change password
      </h2>
      <p className="card-description">After you change it, any other device logged into your account will be signed out.</p>
      <form className="stack" onSubmit={submit} noValidate>
        <PasswordField
          label="Current password"
          name="currentPassword"
          autoComplete="current-password"
          value={currentPassword}
          onChange={e => setCurrentPassword(e.target.value)}
          error={errors.currentPassword}
        />
        <div>
          <PasswordField
            label="New password"
            name="newPassword"
            autoComplete="new-password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            error={errors.newPassword}
          />
          {newPassword && !errors.newPassword && (
            <div className="strength" data-score={strength.score}>
              <div className="strength-bars" aria-hidden="true">
                {[1, 2, 3, 4].map(i => (
                  <span key={i} className={i <= strength.score ? "on" : ""} />
                ))}
              </div>
              <span className="strength-label">{strength.label}</span>
            </div>
          )}
        </div>
        <PasswordField
          label="Confirm new password"
          name="confirmPassword"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
        />
        <div className="card-footer card-footer-end">
          <button type="submit" className="btn btn-primary" disabled={saving} aria-busy={saving}>
            {saving && <span className="spinner" aria-hidden="true" />}
            {saving ? "Changing…" : "Change password"}
          </button>
        </div>
      </form>
    </section>
  );
}

/* ---------------------------------------------------------------- account */

function AccountSection() {
  const { user, logout } = useAuth();
  const rooms = useRooms();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  if (!user) return null;
  const ownedRooms = rooms.data?.filter(room => room.role === "owner") ?? [];

  async function deleteAccount(event: FormEvent) {
    event.preventDefault();
    if (!password) {
      setError("Enter your password to confirm");
      return;
    }
    setDeleting(true);
    setError("");
    try {
      await api.deleteAccount({ password });
      // Logging out sends the user to the login page (RequireAuth).
      logout();
      toast("Your account has been deleted.", "info");
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.password) setError(err.fieldErrors.password);
      else setError(err instanceof Error ? err.message : "Couldn't delete your account.");
      setDeleting(false);
    }
  }

  return (
    <>
      <section className="card" aria-labelledby="account-heading">
        <h2 id="account-heading" className="card-title">
          Your account
        </h2>
        <dl className="details">
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Member since</dt>
            <dd>{formatDate(user.createdAt)}</dd>
          </div>
          <div>
            <dt>Study rooms</dt>
            <dd>{rooms.data ? `${rooms.data.length} (you own ${ownedRooms.length})` : "…"}</dd>
          </div>
        </dl>
      </section>

      <section className="card card-danger" aria-labelledby="danger-heading">
        <h2 id="danger-heading" className="card-title">
          Delete account
        </h2>
        <p className="card-description">
          Permanently deletes your account, your profile photo and every study room you own, including everything in them. You'll be removed from rooms other people own.
        </p>
        <div className="card-footer card-footer-end">
          <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>
            Delete my account
          </button>
        </div>
      </section>

      <Modal
        open={confirming}
        title="Delete your account?"
        onClose={() => {
          setConfirming(false);
          setPassword("");
          setError("");
        }}
      >
        <form className="stack" onSubmit={deleteAccount} noValidate>
          <p>This can't be undone.</p>
          {ownedRooms.length > 0 && (
            <div className="danger-list">
              <p>
                These {ownedRooms.length === 1 ? "room" : `${ownedRooms.length} rooms`} will be deleted for everyone in them:
              </p>
              <ul>
                {ownedRooms.map(room => (
                  <li key={room.id}>
                    {room.name}
                    {room.memberCount > 1 && <span className="muted"> · {room.memberCount} members</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && !error.startsWith("Incorrect") && <FormAlert>{error}</FormAlert>}
          <PasswordField
            label="Enter your password to confirm"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            error={error.startsWith("Incorrect") || error.startsWith("Enter") ? error : undefined}
            autoFocus
          />
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)} disabled={deleting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-danger" disabled={deleting} aria-busy={deleting}>
              {deleting && <span className="spinner" aria-hidden="true" />}
              {deleting ? "Deleting…" : "Delete account"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
