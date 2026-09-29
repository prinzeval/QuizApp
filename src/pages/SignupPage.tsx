import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.tsx";
import { ApiError, type FieldErrors } from "../lib/api.ts";
import { AuthLayout } from "../components/AuthLayout.tsx";
import { FormAlert, PasswordField, SubmitButton, TextField } from "../components/fields.tsx";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();

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
      navigate("/", { replace: true });
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
          Already have an account? <Link to="/login">Log in</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {formError && <FormAlert>{formError}</FormAlert>}
        <TextField
          label="Name"
          name="name"
          autoComplete="name"
          value={name}
          onChange={e => setName(e.target.value)}
          error={errors.name}
          autoFocus
        />
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          error={errors.email}
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          error={errors.password}
          hint="At least 8 characters."
        />
        <SubmitButton loading={loading}>{loading ? "Creating account…" : "Create account"}</SubmitButton>
      </form>
    </AuthLayout>
  );
}
