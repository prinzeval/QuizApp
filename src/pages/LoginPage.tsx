import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.tsx";
import { ApiError, type FieldErrors } from "../lib/api.ts";
import { AuthLayout } from "../components/AuthLayout.tsx";
import { FormAlert, PasswordField, SubmitButton, TextField } from "../components/fields.tsx";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const local: FieldErrors = {};
    if (!email.trim()) local.email = "Enter your email";
    if (!password) local.password = "Enter your password";
    setErrors(local);
    setFormError("");
    if (Object.keys(local).length) return;

    setLoading(true);
    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.password === "Incorrect email or password") {
        // Show wrong credentials once, above the form, rather than blaming one field.
        setFormError("Incorrect email or password.");
      } else if (error instanceof ApiError && Object.keys(error.fieldErrors).length) {
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
      title="Welcome back"
      subtitle="Log in to keep quizzing."
      footer={
        <>
          New here? <Link to="/signup">Create an account</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {formError && <FormAlert>{formError}</FormAlert>}
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          error={errors.email}
          autoFocus
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          error={errors.password}
        />
        <SubmitButton loading={loading}>{loading ? "Logging in…" : "Log in"}</SubmitButton>
      </form>
    </AuthLayout>
  );
}
