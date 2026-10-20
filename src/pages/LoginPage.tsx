import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Alert, Anchor, Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { useAuth } from "../auth/AuthContext.tsx";
import { isGoogleOnlyError, redirectTarget } from "../auth/authHelpers.ts";
import { ApiError, type FieldErrors } from "../lib/api.ts";
import { notify } from "../notify.ts";
import { AuthLayout } from "../components/AuthLayout.tsx";
import { GoogleSignIn } from "../components/GoogleButton.tsx";
import { PasswordField } from "../components/PasswordField.tsx";
import { usePageTitle } from "../hooks/usePageTitle.ts";

export function LoginPage() {
  usePageTitle("Log in");
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = redirectTarget(location.state);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  // The email that has no account yet, to offer signing up with it.
  const [unknownEmail, setUnknownEmail] = useState("");
  const [loading, setLoading] = useState(false);

  // Keep the invite/redirect state and carry over whatever email was typed.
  const forgotState = { ...(location.state as object | null), email: email.trim() };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const local: FieldErrors = {};
    if (!email.trim()) local.email = "Enter your email";
    if (!password) local.password = "Enter your password";
    setErrors(local);
    setFormError("");
    setUnknownEmail("");
    if (Object.keys(local).length) return;

    setLoading(true);
    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.email === "No account uses this email") {
        setUnknownEmail(email.trim().toLowerCase());
      } else if (error instanceof ApiError && Object.keys(error.fieldErrors).length) {
        setErrors(error.fieldErrors);
      } else {
        setFormError(error instanceof Error ? error.message : "Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  }

  // A Google-only account tried a password: say so, with a way to set one.
  const passwordError = isGoogleOnlyError(errors.password) ? (
    <>
      {errors.password}{" "}
      <Anchor component={Link} to="/forgot-password" state={forgotState} fz="inherit" fw={600} data-testid="reset-password-link">
        Reset password
      </Anchor>
    </>
  ) : (
    errors.password
  );

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to keep quizzing."
      footer={
        <>
          New here?{" "}
          <Anchor component={Link} to="/signup" state={location.state} fw={600}>
            Create an account
          </Anchor>
        </>
      }
    >
      <GoogleSignIn
        onStart={() => {
          setFormError("");
          setUnknownEmail("");
        }}
        onSignedIn={created => {
          if (created) notify("Welcome to SmartQuiz!");
          navigate(from, { replace: true });
        }}
        onError={setFormError}
      />
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="md">
          {unknownEmail && (
            <Alert color="clay" variant="light" icon={<IconAlertCircle size={18} />} role="alert" data-testid="no-account">
              There's no account for <strong>{unknownEmail}</strong> yet.{" "}
              <Anchor component={Link} to="/signup" state={{ ...(location.state as object | null), email: unknownEmail }} fw={600} inherit>
                Create one
              </Anchor>
              , or check the spelling.
            </Alert>
          )}
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
            error={errors.email}
            autoFocus
          />
          <div>
            <Group justify="space-between" align="baseline" gap="xs" mb={5} wrap="nowrap">
              <Text component="label" htmlFor="login-password" size="sm" fw={500}>
                Password
              </Text>
              <Anchor component={Link} to="/forgot-password" state={forgotState} size="sm" fw={500}>
                Forgot password?
              </Anchor>
            </Group>
            <PasswordField
              id="login-password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.currentTarget.value)}
              error={passwordError}
            />
          </div>
          <Button type="submit" fullWidth loading={loading} mt="xs">
            Log in
          </Button>
        </Stack>
      </form>
    </AuthLayout>
  );
}
