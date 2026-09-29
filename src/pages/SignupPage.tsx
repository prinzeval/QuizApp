import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Alert, Anchor, Button, Stack, TextInput } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { useAuth } from "../auth/AuthContext.tsx";
import { ApiError, type FieldErrors } from "../lib/api.ts";
import { AuthLayout } from "../components/AuthLayout.tsx";
import { PasswordField, StrengthMeter } from "../components/PasswordField.tsx";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // e.g. an invite link that sent the user here to create an account first
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // Quick checks here for instant feedback; the server has the final say.
    const local: FieldErrors = {};
    if (!name.trim()) local.name = "Enter your name";
    if (!EMAIL_RE.test(email.trim())) local.email = "Enter a valid email address";
    if (password.length < 8) local.password = "Password must be at least 8 characters";
    setErrors(local);
    setFormError("");
    if (Object.keys(local).length) return;

    setLoading(true);
    try {
      await signup({ name, email, password });
      navigate(from, { replace: true });
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) {
        setErrors(error.fieldErrors);
      } else {
        setFormError(error instanceof Error ? error.message : "Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="It takes less than a minute."
      footer={
        <>
          Already have an account?{" "}
          <Anchor component={Link} to="/login" state={location.state} fw={600}>
            Log in
          </Anchor>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="md">
          {formError && (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
              {formError}
            </Alert>
          )}
          <TextInput
            label="Name"
            name="name"
            autoComplete="name"
            value={name}
            onChange={e => setName(e.currentTarget.value)}
            error={errors.name}
            autoFocus
          />
          <TextInput
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={e => setEmail(e.currentTarget.value)}
            error={errors.email}
          />
          <div>
            <PasswordField
              label="Password"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.currentTarget.value)}
              error={errors.password}
              description="At least 8 characters."
              inputWrapperOrder={["label", "input", "description", "error"]}
            />
            {!errors.password && <StrengthMeter password={password} />}
          </div>
          <Button type="submit" fullWidth loading={loading} mt="xs">
            Create account
          </Button>
        </Stack>
      </form>
    </AuthLayout>
  );
}
