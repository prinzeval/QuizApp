/** Minimal typings and a lazy loader for Google Identity Services (the "Sign in with Google" button). */

interface CredentialResponse {
  credential: string;
}

interface GsiButtonOptions {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: number;
  locale?: string;
}

interface GoogleAccountsId {
  initialize(options: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    ux_mode?: "popup" | "redirect";
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: "signin" | "signup" | "use";
    itp_support?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: GsiButtonOptions): void;
  cancel(): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

export type GoogleButtonText = NonNullable<GsiButtonOptions["text"]>;

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

let loading: Promise<GoogleAccountsId> | null = null;
let initializedFor: string | null = null;
// GIS takes one callback at initialize(); route it to whichever button is mounted now.
let credentialHandler: ((credential: string) => void) | null = null;

/** Loads the GIS script once (only when a page actually shows the button). */
export function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  const ready = window.google?.accounts?.id;
  if (ready) return Promise.resolve(ready);
  loading ??= new Promise<GoogleAccountsId>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const id = window.google?.accounts?.id;
      if (id) resolve(id);
      else reject(new Error("Google sign-in didn't load"));
    };
    script.onerror = () => {
      script.remove();
      reject(new Error("Google sign-in couldn't load"));
    };
    document.head.appendChild(script);
  }).catch(error => {
    loading = null; // let a later visit try again
    throw error;
  });
  return loading;
}

/** Initializes GIS for this client id (once) and points its callback at `onCredential`. */
export function connectGoogle(id: GoogleAccountsId, clientId: string, onCredential: (credential: string) => void): () => void {
  credentialHandler = onCredential;
  if (initializedFor !== clientId) {
    id.initialize({
      client_id: clientId,
      callback: response => credentialHandler?.(response.credential),
      ux_mode: "popup",
      auto_select: false,
      cancel_on_tap_outside: true,
      itp_support: true,
    });
    initializedFor = clientId;
  }
  return () => {
    if (credentialHandler === onCredential) credentialHandler = null;
  };
}
