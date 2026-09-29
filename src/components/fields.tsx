import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  error?: string;
  hint?: ReactNode;
  trailing?: ReactNode;
}

export function TextField({ label, error, hint, trailing, className, ...input }: FieldProps) {
  const id = useId();
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`field ${error ? "field-invalid" : ""} ${className ?? ""}`}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="field-control">
        <input id={id} className="field-input" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
        {trailing}
      </div>
      {error ? (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function PasswordField(props: Omit<FieldProps, "type" | "trailing">) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          className="field-toggle"
          onClick={() => setVisible(v => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? "Hide" : "Show"}
        </button>
      }
    />
  );
}

export function SubmitButton({ loading, children }: { loading: boolean; children: ReactNode }) {
  return (
    <button type="submit" className="btn btn-primary btn-block" disabled={loading} aria-busy={loading}>
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div className="form-alert" role="alert">
      {children}
    </div>
  );
}
