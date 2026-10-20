import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { Alert, Anchor, Button, Stack, Text, TextInput, ThemeIcon } from "@mantine/core";
import { IconAlertCircle, IconMailCheck } from "@tabler/icons-react";
import { isValidEmail, normalizeEmail, resendSecondsLeft } from "../auth/authHelpers.ts";
import { useAuthConfig } from "../auth/useAuthConfig.ts";
import { api, ApiError } from "../lib/api.ts";
import { notify } from "../notify.ts";
import { AuthLayout } from "../components/AuthLayout.tsx";
import { usePageTitle } from "../hooks/usePageTitle.ts";

export function ForgotPasswordPage() {
  usePageTitle("Reset your password");
  const location = useLocation();
  // The login page passes along what was typed (and any invite redirect, so "Back to log in" keeps it).
  const [email, setEmail] = useState(() => (location.state as { email?: string } | null)?.email ?? "");
  const [emailError, setEmailError] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const config = useAuthConfig();

  const secondsLeft = sentTo ? resendSecondsLeft(sentAt, now) : 0;

  // Tick the resend countdown once a second until it's done.
  useEffect(() => {
    if (!sentTo || secondsLeft === 0) return;
    const timer = window.setTimeout(() => setNow(Date.now()), 1000);
    return () => window.clearTimeout(timer);
  }, [sentTo, secondsLeft, now]);

  async function send(address: string): Promise<boolean> {
    setLoading(true);
    setFormError("");
    try {
      await api.forgotPassword(address);
      const at = Date.now();
      setSentTo(address);
      setSentAt(at);
      setNow(at);
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.email) setEmailError(error.fieldErrors.email);
      else setFormError(error instanceof Error ? error.message : "Couldn't send the email. Please try again.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isValidEmail(email)) {
      setEmailError("Enter a valid email address");
      return;
    }
    setEmailError("");
    await send(normalizeEmail(email));
  }

  async function resend() {
    if (await send(sentTo)) notify("Sent another link");
  }

  const backToLogin = (
    <>
      Remembered it?{" "}
      <Anchor component={Link} to="/login" state={location.state} fw={600}>
        Back to log in
      </Anchor>
    </>
  );

  if (sentTo) {
    return (
      <AuthLayout title="Check your email" subtitle="We've sent you a link to choose a new password." footer={backToLogin}>
        <Stack gap="md">
          <ThemeIcon size={52} radius="xl" variant="light" color="teal">
            <IconMailCheck size={28} stroke={1.7} />
          </ThemeIcon>
          <Text role="status" data-testid="reset-sent">
            If an account exists for <strong style={{ overflowWrap: "anywhere" }}>{sentTo}</strong>, we've sent a reset link. Check your
            inbox (and spam).
          </Text>
          <Text size="sm" c="dimmed">
            The link works once and expires in 60 minutes.
          </Text>
          {config.data && !config.data.emailEnabled && import.meta.env.DEV && (
            <Alert color="yellow" variant="light" icon={<IconAlertCircle size={18} />}>
              Email isn't set up on this server, so the reset link was written to the backend log instead.
            </Alert>
          )}
          {formError && (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
              {formError}
            </Alert>
          )}
          <Button variant="default" fullWidth onClick={resend} loading={loading} disabled={secondsLeft > 0}>
            {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend email"}
          </Button>
          <Button
            variant="subtle"
            fullWidth
            onClick={() => {
              setEmail(sentTo);
              setSentTo("");
              setFormError("");
            }}
          >
            Use a different email
          </Button>
        </Stack>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Forgot your password?" subtitle="Enter your email and we'll send you a link to reset it." footer={backToLogin}>
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="md">
          {formError && (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
              {formError}
            </Alert>
          )}
          <TextInput
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={e => setEmail(e.currentTarget.value)}
            error={emailError}
            autoFocus
          />
          <Button type="submit" fullWidth loading={loading} mt="xs">
            Send reset link
          </Button>
        </Stack>
      </form>
    </AuthLayout>
  );
}
