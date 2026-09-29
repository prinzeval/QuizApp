import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  Flex,
  Group,
  List,
  NavLink,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { Dropzone, type FileRejection } from "@mantine/dropzone";
import { IconAlertCircle, IconAlertTriangle, IconCamera, IconKey, IconSettings, IconUser } from "@tabler/icons-react";
import { useAuth } from "../auth/AuthContext.tsx";
import { useRooms } from "../hooks/rooms.ts";
import { api, ApiError, type FieldErrors } from "../lib/api.ts";
import { formatDate } from "../lib/format.ts";
import { notify } from "../notify.ts";
import { AvatarCropper } from "../components/AvatarCropper.tsx";
import { PasswordField, StrengthMeter } from "../components/PasswordField.tsx";
import { UserAvatar } from "../components/UserAvatar.tsx";
import { FormModal } from "../components/FormModal.tsx";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024; // before cropping; the upload itself is ~50 KB

const SECTIONS = [
  { to: "/settings", label: "Profile", short: "Profile", icon: IconUser },
  { to: "/settings/security", label: "Password & security", short: "Security", icon: IconKey },
  { to: "/settings/account", label: "Account", short: "Account", icon: IconSettings },
];

export function SettingsPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const current = pathname.replace(/\/$/, "");

  return (
    <>
      <Box mb="xl">
        <Title order={1}>Profile & settings</Title>
        <Text c="dimmed" mt={6}>
          Manage how you appear to others and keep your account secure.
        </Text>
      </Box>

      <Box
        display={{ base: "block", sm: "grid" }}
        style={{ gridTemplateColumns: "200px minmax(0, 1fr)", gap: "var(--mantine-spacing-xl)", alignItems: "start" }}
      >
        <Box component="nav" aria-label="Settings sections" mb={{ base: "lg", sm: 0 }}>
          <SegmentedControl
            hiddenFrom="sm"
            fullWidth
            size="md"
            radius="md"
            styles={{ label: { minHeight: 40, display: "flex", alignItems: "center", justifyContent: "center" } }}
            value={SECTIONS.some(s => s.to === current) ? current : "/settings"}
            onChange={to => navigate(to)}
            data={SECTIONS.map(({ to, short }) => ({ value: to, label: short }))}
          />
          <Stack gap={2} visibleFrom="sm">
            {SECTIONS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                component={Link}
                to={to}
                label={label}
                leftSection={<Icon size={18} stroke={1.8} />}
                active={current === to}
                aria-current={current === to ? "page" : undefined}
                style={{ borderRadius: "var(--mantine-radius-md)" }}
              />
            ))}
          </Stack>
        </Box>
        <Stack gap="lg" miw={0}>
          <Routes>
            <Route index element={<ProfileSection />} />
            <Route path="security" element={<SecuritySection />} />
            <Route path="account" element={<AccountSection />} />
            <Route path="*" element={<Navigate to="/settings" replace />} />
          </Routes>
        </Stack>
      </Box>
    </>
  );
}

function SectionCard({ title, description, children, danger = false }: { title: string; description?: ReactNode; children?: ReactNode; danger?: boolean }) {
  return (
    <Card component="section" aria-label={title} bd={danger ? "1px solid var(--mantine-color-red-outline)" : undefined}>
      <Title order={2} c={danger ? "red" : undefined}>
        {title}
      </Title>
      {description && (
        <Text size="sm" c="dimmed" mt={4}>
          {description}
        </Text>
      )}
      {children && <Box mt="lg">{children}</Box>}
    </Card>
  );
}

/* ---------------------------------------------------------------- profile */

function ProfileSection() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [nameError, setNameError] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [removing, setRemoving] = useState(false);
  const openRef = useRef<() => void>(null);

  if (!user) return null;
  const nameChanged = name.trim() !== user.name;

  function pick(candidate: File | undefined) {
    if (!candidate) return;
    if (!ACCEPTED.includes(candidate.type)) {
      notify("Choose a JPEG, PNG or WebP image.", "error");
      return;
    }
    if (candidate.size > MAX_BYTES) {
      notify("That image is over 10 MB. Try a smaller one.", "error");
      return;
    }
    setFile(candidate);
  }

  function onReject([rejection]: FileRejection[]) {
    // Same messages as pick() so drag-and-drop and the picker agree.
    if (rejection) pick(rejection.file);
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
      notify("Name updated");
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.name) setNameError(error.fieldErrors.name);
      else notify(error instanceof Error ? error.message : "Couldn't save your name.", "error");
    } finally {
      setSavingName(false);
    }
  }

  async function removePhoto() {
    setRemoving(true);
    try {
      const { user: updated } = await api.removeAvatar();
      updateUser(updated);
      notify("Photo removed");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Couldn't remove your photo.", "error");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <>
      <SectionCard title="Profile photo" description="Shown to people in your study rooms.">
        <Flex direction={{ base: "column", xs: "row" }} align={{ base: "flex-start", xs: "center" }} gap="lg">
          <Dropzone
            onDrop={files => pick(files[0])}
            onReject={onReject}
            accept={ACCEPTED}
            maxSize={MAX_BYTES}
            multiple={false}
            openRef={openRef}
            radius={999}
            p={4}
            w={104}
            h={104}
            style={{ flexShrink: 0, borderWidth: 2 }}
            aria-label="Change profile photo"
            inputProps={{ "aria-label": "Profile photo file" }}
          >
            <Box pos="relative">
              <UserAvatar name={user.name} url={user.avatarUrl} size={92} />
              <Dropzone.Accept>
                <Box pos="absolute" inset={0} bg="rgba(0,0,0,0.45)" c="white" display="grid" style={{ placeItems: "center", borderRadius: "50%" }}>
                  <IconCamera size={24} />
                </Box>
              </Dropzone.Accept>
            </Box>
          </Dropzone>
          <Stack gap="xs">
            <Group gap="sm">
              <Button onClick={() => openRef.current?.()}>{user.avatarUrl ? "Change photo" : "Upload photo"}</Button>
              {user.avatarUrl && (
                <Button variant="default" onClick={removePhoto} loading={removing}>
                  Remove
                </Button>
              )}
            </Group>
            <Text size="xs" c="dimmed">
              JPEG, PNG or WebP. You can also drag an image onto the circle.
            </Text>
          </Stack>
        </Flex>
      </SectionCard>

      <SectionCard title="Personal details">
        <form onSubmit={saveName} noValidate>
          <Stack gap="md">
            <TextInput label="Name" name="name" autoComplete="name" value={name} onChange={e => setName(e.currentTarget.value)} error={nameError} maxLength={100} />
            <TextInput
              label="Email"
              name="email"
              type="email"
              value={user.email}
              readOnly
              disabled
              description="Your email is used to log in and can't be changed yet."
              inputWrapperOrder={["label", "input", "description", "error"]}
            />
            <Group justify="space-between" gap="sm" mt="xs">
              <Text size="xs" c="dimmed">
                Member since {formatDate(user.createdAt)}
              </Text>
              <Button type="submit" disabled={!nameChanged} loading={savingName}>
                Save changes
              </Button>
            </Group>
          </Stack>
        </form>
      </SectionCard>

      <FormModal opened={!!file} onClose={() => setFile(null)} title="Crop your photo" size="auto">
        {file && (
          <AvatarCropper
            file={file}
            onCancel={() => setFile(null)}
            onConfirm={async image => {
              const extension = image.type === "image/webp" ? "webp" : "png";
              const { user: updated } = await api.uploadAvatar(image, `avatar.${extension}`);
              updateUser(updated);
              setFile(null);
              notify("Photo updated");
            }}
          />
        )}
      </FormModal>
    </>
  );
}

/* --------------------------------------------------------------- security */

function SecuritySection() {
  const { replaceToken } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

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
      notify("Password changed. You've been logged out everywhere else.");
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) setErrors(error.fieldErrors);
      else notify(error instanceof Error ? error.message : "Couldn't change your password.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard title="Change password" description="After you change it, any other device logged into your account will be signed out.">
      <form onSubmit={submit} noValidate>
        <Stack gap="md" maw={420}>
          <PasswordField
            label="Current password"
            name="currentPassword"
            autoComplete="current-password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.currentTarget.value)}
            error={errors.currentPassword}
          />
          <div>
            <PasswordField
              label="New password"
              name="newPassword"
              autoComplete="new-password"
              value={newPassword}
              onChange={e => setNewPassword(e.currentTarget.value)}
              error={errors.newPassword}
            />
            {!errors.newPassword && <StrengthMeter password={newPassword} />}
          </div>
          <PasswordField
            label="Confirm new password"
            name="confirmPassword"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.currentTarget.value)}
            error={errors.confirmPassword}
          />
          <Group mt="xs">
            <Button type="submit" loading={saving}>
              Change password
            </Button>
          </Group>
        </Stack>
      </form>
    </SectionCard>
  );
}

/* ---------------------------------------------------------------- account */

function AccountSection() {
  const { user, logout } = useAuth();
  const rooms = useRooms();
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
      notify("Your account has been deleted.", "info");
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.password) setError(err.fieldErrors.password);
      else setError(err instanceof Error ? err.message : "Couldn't delete your account.");
      setDeleting(false);
    }
  }

  const closeConfirm = () => {
    setConfirming(false);
    setPassword("");
    setError("");
  };

  const details: [string, string][] = [
    ["Email", user.email],
    ["Member since", formatDate(user.createdAt)],
    ["Study rooms", rooms.data ? `${rooms.data.length} (you own ${ownedRooms.length})` : "…"],
  ];

  return (
    <>
      <SectionCard title="Your account">
        <Stack component="dl" gap={0} m={0}>
          {details.map(([term, value], index) => (
            <Group
              key={term}
              justify="space-between"
              gap="md"
              py="sm"
              wrap="nowrap"
              style={index > 0 ? { borderTop: "1px solid var(--mantine-color-default-border)" } : undefined}
            >
              <Text component="dt" size="sm" c="dimmed">
                {term}
              </Text>
              <Text component="dd" size="sm" fw={500} m={0} ta="right" style={{ overflowWrap: "anywhere" }}>
                {value}
              </Text>
            </Group>
          ))}
        </Stack>
      </SectionCard>

      <SectionCard
        danger
        title="Delete account"
        description="Permanently deletes your account, your profile photo and every study room you own, including everything in them. You'll be removed from rooms other people own."
      >
        <Group justify="flex-end">
          <Button color="red" onClick={() => setConfirming(true)}>
            Delete my account
          </Button>
        </Group>
      </SectionCard>

      <FormModal opened={confirming} onClose={closeConfirm} title="Delete your account?">
        <form onSubmit={deleteAccount} noValidate>
          <Stack gap="md">
            <Text size="sm">This can't be undone.</Text>
            {ownedRooms.length > 0 && (
              <Alert color="red" variant="light" icon={<IconAlertTriangle size={18} />}>
                <Text size="sm">
                  These {ownedRooms.length === 1 ? "room" : `${ownedRooms.length} rooms`} will be deleted for everyone in them:
                </Text>
                <List size="sm" mt={6} spacing={2}>
                  {ownedRooms.map(room => (
                    <List.Item key={room.id}>
                      {room.name}
                      {room.memberCount > 1 && (
                        <Text span c="dimmed" size="sm">
                          {" "}
                          · {room.memberCount} members
                        </Text>
                      )}
                    </List.Item>
                  ))}
                </List>
              </Alert>
            )}
            {error && !error.startsWith("Incorrect") && !error.startsWith("Enter") && (
              <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
                {error}
              </Alert>
            )}
            <PasswordField
              label="Enter your password to confirm"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.currentTarget.value)}
              error={error.startsWith("Incorrect") || error.startsWith("Enter") ? error : undefined}
              data-autofocus
            />
            <Group justify="flex-end" gap="sm" mt="xs">
              <Button variant="default" onClick={() => setConfirming(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button type="submit" color="red" loading={deleting}>
                Delete account
              </Button>
            </Group>
          </Stack>
        </form>
      </FormModal>
    </>
  );
}
