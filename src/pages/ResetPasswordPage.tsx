import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Alert, Anchor, Button, Center, Loader, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconAlertCircle, IconLinkOff } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext.tsx";
import { readResetToken, validateNewPassword } from "../auth/authHelpers.ts";
import { api, ApiError, type FieldErrors } from "../lib/api.ts";
import { notify } from "../notify.ts";
import { AuthLayout } from "../components/AuthLayout.tsx";
import { PasswordField, StrengthMeter } from "../components/PasswordField.tsx";
import { usePageTitle } from "../hooks/usePageTitle.ts";

export function ResetPasswordPage() {
  usePageTitle("Choose a new password");
  const { search } = useLocation();
  const token = useMemo(() => readResetToken(search), [search]);
  // Set when the server rejects the token on submit (used or expired since the page opened).
  const [expired, setExpired] = useState(false);

  const check = useQuery({
    queryKey: ["auth", "reset-token", token],
    queryFn: () => api.checkResetToken(token!),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
  });

  const loginLink = (
    <>
      Remembered it?{" "}
      <Anchor component={Link} to="/login" fw={600}>
        Back to log in
      </Anchor>
    </>
  );

  if (token && check.isPending) {
    return (
      <AuthLayout title="Choose a new password" subtitle="Checking your link…" footer={loginLink}>
        <Center py="xl">
          <Loader aria-label="Checking your reset link" />
        </Center>
      </AuthLayout>
    );
  }

  // Couldn't reach the server: that says nothing about the link, so offer a retry.
  if (token && check.isError && !(check.error instanceof ApiError && check.error.status >= 400 && check.error.status < 500)) {
    return (
      <AuthLayout title="Choose a new password" subtitle="We couldn't check your reset link." footer={loginLink}>
        <Stack gap="md">
          <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
            {check.error.message}
          </Alert>
          <Button fullWidth onClick={() => check.refetch()} loading={check.isFetching}>
            Try again
          </Button>
        </Stack>
      </AuthLayout>
    );
  }

  if (!token || expired || !check.data?.valid) return <InvalidLink />;

  return <ResetForm token={token} maskedEmail={check.data.email} onExpired={() => setExpired(true)} footer={loginLink} />;
}

function InvalidLink() {
  return (
    <AuthLayout
      title="This link has expired"
      subtitle="Reset links work once and only for 60 minutes."
      footer={
        <Anchor component={Link} to="/login" fw={600}>
          Back to log in
        </Anchor>
      }
    >
      <Stack gap="md" data-testid="reset-invalid">
        <ThemeIcon size={52} radius="xl" variant="light" color="clay">
          <IconLinkOff size={28} stroke={1.7} />
        </ThemeIcon>
        <Text>
          This password reset link is invalid, has already been used, or has expired. No worries: request a new one and use the
          latest email we send you.
        </Text>
        <Button component={Link} to="/forgot-password" fullWidth>
          Request a new link
        </Button>
      </Stack>
    </AuthLayout>
  );
}

function ResetForm({ token, maskedEmail, onExpired, footer }: { token: string; maskedEmail: string | null; onExpired: () => void; footer: ReactNode }) {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const local = validateNewPassword(password, confirmPassword);
    setErrors(local);
    setFormError("");
    if (Object.keys(local).length) return;

    setSaving(true);
    try {
      await resetPassword({ token, password });
      notify("Password updated");
      navigate("/", { replace: true });
    } catch (error) {
      setSaving(false);
      if (error instanceof ApiError && error.fieldErrors.token) onExpired();
      else if (error instanceof ApiError && Object.keys(error.fieldErrors).length) setErrors(error.fieldErrors);
      else setFormError(error instanceof Error ? error.message : "Couldn't update your password.");
    }
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle={
        maskedEmail ? (
          <>
            For <strong>{maskedEmail}</strong>. You'll be logged out on every other device.
          </>
        ) : (
          "You'll be logged out on every other device."
        )
      }
      footer={footer}
    >
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="md">
          {formError && (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
              {formError}
            </Alert>
          )}
          <div>
            <PasswordField
              label="New password"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={e => {
                setPassword(e.currentTarget.value);
                setErrors(({ password: _, ...rest }) => rest);
              }}
              error={errors.password}
              description="At least 8 characters."
              inputWrapperOrder={["label", "input", "description", "error"]}
              autoFocus
            />
            {!errors.password && <StrengthMeter password={password} />}
          </div>
          <PasswordField
            label="Confirm new password"
            name="confirmPassword"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={e => {
              setConfirmPassword(e.currentTarget.value);
              setErrors(({ confirmPassword: _, ...rest }) => rest);
            }}
            error={errors.confirmPassword}
          />
          <Button type="submit" fullWidth loading={saving} mt="xs">
            Update password
          </Button>
        </Stack>
      </form>
    </AuthLayout>
  );
}
