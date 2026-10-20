import { Link } from "react-router-dom";
import { LegalLayout, SUPPORT_EMAIL } from "../components/LegalLayout.tsx";
import { usePageTitle } from "../hooks/usePageTitle.ts";

export function PrivacyPage() {
  usePageTitle("Privacy Policy");
  return (
    <LegalLayout
      title="Privacy Policy"
      intro="SmartQuiz helps students turn their study files into quizzes, flashcards and study aids, and study together in rooms. This policy explains, in plain language, what we collect, why, who helps us run the service, and the choices you have."
    >
      <h2>The short version</h2>
      <ul>
        <li>We collect what we need to run your account and your study rooms, and nothing to sell. We don't sell your data and we don't show ads.</li>
        <li>Files you upload are read by AI providers (DeepSeek and Google Gemini) only to create your quizzes, flashcards, summaries and tutor answers.</li>
        <li>Everything in a study room is visible to the people in that room.</li>
        <li>You can delete your account at any time in Settings, and that deletes your data.</li>
      </ul>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> your name, email address, and either a password (stored only as a secure one-way hash, never in plain text) or, if
          you continue with Google, your Google account id, name, email and profile picture as shared by Google.
        </li>
        <li>
          <strong>Profile photo:</strong> if you upload one.
        </li>
        <li>
          <strong>Study content:</strong> the files you upload (such as PDFs, Word documents, slides, images and text), the text and pictures we extract from them,
          and what's created from them: quizzes, questions, flashcards, mind maps, summaries and tutor conversations.
        </li>
        <li>
          <strong>Room activity:</strong> rooms you create or join, invitations, chat messages, quiz attempts and answers, time spent per question, flashcard reviews
          and progress, so we can show scores, schedules and your study history.
        </li>
        <li>
          <strong>Calls:</strong> when you join a study call, your audio and (if you turn it on) video are streamed live to the other people in the call. We
          don't record calls.
        </li>
        <li>
          <strong>Technical data:</strong> basic logs (such as IP address, browser type, request times and errors) that keep the service secure and working. If
          error reporting is enabled, crash reports include the page, the error and your account id, but not your email or files.
        </li>
      </ul>
      <p>
        We store your login session in your browser's local storage so you stay signed in. We don't use advertising or cross-site tracking cookies.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To provide SmartQuiz: sign you in, store your files, generate study material, run rooms, quizzes, chat and calls.</li>
        <li>To send account emails you need, such as password reset links.</li>
        <li>To keep the service safe: prevent abuse, enforce fair-use limits, and fix bugs.</li>
        <li>To improve SmartQuiz in general (for example, which features are used), without building advertising profiles.</li>
      </ul>
      <p>
        We don't use your files or study content to train our own AI models, and we don't sell or rent your personal information.
      </p>

      <h2>AI providers</h2>
      <p>
        To create quizzes, flashcards, summaries, diagrams and tutor answers, we send the relevant text and images from your files, plus your instructions, to
        AI providers: <strong>DeepSeek</strong> and <strong>Google Gemini</strong>. They process this content to return a result to us. Their own terms and
        privacy policies apply to how they handle data sent through their APIs. AI-generated material can be wrong, so please check anything important against
        your sources.
      </p>
      <p>Please don't upload files containing sensitive personal information (for example, health records or other people's private data) that you don't need for studying.</p>

      <h2>Other service providers</h2>
      <p>We rely on a small number of providers who process data on our behalf, only to run SmartQuiz:</p>
      <ul>
        <li>
          <strong>Railway</strong> hosts our servers, database and stored files.
        </li>
        <li>
          <strong>Vercel</strong> hosts and delivers the web app you're using.
        </li>
        <li>
          <strong>LiveKit</strong> relays live audio and video for study calls.
        </li>
        <li>
          <strong>Google</strong> provides "Continue with Google" sign-in, if you choose it.
        </li>
        <li>An email delivery provider sends account emails such as password resets.</li>
        <li>An error-monitoring service (Sentry) may receive crash reports so we can fix problems.</li>
      </ul>
      <p>These providers may store or process data in countries other than yours. We may also disclose information if required by law, or to protect people's safety.</p>

      <h2>Who can see your content</h2>
      <p>
        Your study rooms are shared spaces. People you invite to a room can see its files, quizzes, flashcard decks, chat, members and activity such as quiz
        scores on the study board. Content marked private (such as your "My mistakes" decks and quizzes) is visible only to you. Your name and profile photo are
        shown to people in rooms you share.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your data for as long as your account exists. Files and content you delete are removed from the service. When you delete your account, we delete
        your profile, profile photo and every room you own, including everything in it, and remove you from rooms others own. Backups and logs that may contain
        your data are cleared within 30 days. Messages you sent in rooms owned by other people may remain in those rooms without your name attached.
      </p>

      <h2>Your choices and rights</h2>
      <ul>
        <li>
          <strong>Access and correct:</strong> view and update your name and photo in <Link to="/settings">Settings</Link>.
        </li>
        <li>
          <strong>Delete:</strong> delete your account and data any time in <Link to="/settings/account">Settings → Account</Link>.
        </li>
        <li>
          <strong>Export or ask questions:</strong> email us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we'll help, including requests under
          laws like the GDPR or CCPA. We'll reply within 30 days.
        </li>
      </ul>

      <h2>Security</h2>
      <p>
        We use encrypted connections (HTTPS), hash passwords, sign you out of other devices when your password changes, and limit access to data to what's needed
        to run the service. No system is perfectly secure, so please use a strong, unique password.
      </p>

      <h2>Children</h2>
      <p>
        SmartQuiz is meant for students aged 13 and over. If you're under the age required to consent to data processing where you live, please use SmartQuiz with
        a parent's or guardian's permission. If you believe a child has given us information without the right consent, contact us and we'll delete it.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we make meaningful changes, we'll update the date at the top and, for important changes, let you know in the app or by email. See also our{" "}
        <Link to="/terms">Terms of Service</Link>.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about privacy? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalLayout>
  );
}
