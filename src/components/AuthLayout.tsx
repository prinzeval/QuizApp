import type { ReactNode } from "react";

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-brand" aria-hidden="true">
        <div className="auth-brand-inner">
          <div className="logo">
            <img src="/favicon.jpg" alt="" className="logo-mark" />
            <span>SmartQuiz</span>
          </div>
          <p className="auth-pitch">
            Turn your notes into{" "}
            <span className="scribble">
              quizzes
              <svg viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true">
                <path d="M3 13c35-7 75-9 115-6 27 2 53 3 79-2" />
              </svg>
            </span>{" "}
            and actually remember what you read.
          </p>
          <p className="auth-note">made with love for Nana ♥</p>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <div className="logo logo-mobile">
            <img src="/favicon.jpg" alt="" className="logo-mark" />
            <span>SmartQuiz</span>
          </div>
          <h1 className="auth-title">{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>
          {children}
          <p className="auth-switch">{footer}</p>
        </div>
      </main>
    </div>
  );
}
