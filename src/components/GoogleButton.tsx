import { useEffect, useRef, useState } from "react";
import { Box, Divider, Group, Loader, Stack, Text } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { useAuth } from "../auth/AuthContext.tsx";
import { useAuthConfig } from "../auth/useAuthConfig.ts";
import { googleButtonWidth } from "../auth/authHelpers.ts";
import { connectGoogle, loadGoogleIdentity } from "../auth/googleIdentity.ts";
import { ApiError } from "../lib/api.ts";

interface GoogleSignInProps {
  /** Called once the session is stored; `created` is true for a brand-new account. */
  onSignedIn: (created: boolean) => void;
  onError: (message: string) => void;
  /** Called when the user starts a Google sign-in, to clear old errors. */
  onStart?: () => void;
}

/**
 * Google's official "Continue with Google" button followed by an "or" divider.
 * Renders nothing when the server has no Google client id, or when Google's script can't load.
 */
export function GoogleSignIn(props: GoogleSignInProps) {
  const config = useAuthConfig();
  const clientId = config.data?.googleClientId;
  if (!clientId) return null;
  return <GoogleSignInButton clientId={clientId} {...props} />;
}

function GoogleSignInButton({ clientId, onSignedIn, onError, onStart }: GoogleSignInProps & { clientId: string }) {
  const { loginWithGoogle } = useAuth();
  const { ref: containerRef, width } = useElementSize<HTMLDivElement>();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [signingIn, setSigningIn] = useState(false);

  // GIS keeps the callback it was initialized with, so read the latest props through a ref.
  const latest = useRef({ loginWithGoogle, onSignedIn, onError, onStart });
  useEffect(() => {
    latest.current = { loginWithGoogle, onSignedIn, onError, onStart };
  });

  useEffect(() => {
    let disconnect: (() => void) | undefined;
    let cancelled = false;
    loadGoogleIdentity()
      .then(id => {
        if (cancelled) return;
        disconnect = connectGoogle(id, clientId, async credential => {
          const { loginWithGoogle, onSignedIn, onError, onStart } = latest.current;
          onStart?.();
          setSigningIn(true);
          try {
            const { created } = await loginWithGoogle(credential);
            onSignedIn(created);
          } catch (error) {
            const message =
              error instanceof ApiError
                ? (error.fieldErrors.credential ?? error.message)
                : "Couldn't sign you in with Google. Please try again.";
            onError(message);
            setSigningIn(false);
          }
        });
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });
    return () => {
      cancelled = true;
      disconnect?.();
    };
  }, [clientId]);

  // (Re)draw Google's button whenever it's ready or the column width changes.
  const buttonWidth = width > 0 ? googleButtonWidth(width) : 0;
  useEffect(() => {
    const id = window.google?.accounts?.id;
    const parent = buttonRef.current;
    if (status !== "ready" || !id || !parent || !buttonWidth) return;
    parent.replaceChildren();
    id.renderButton(parent, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      logo_alignment: "center",
      width: buttonWidth,
      locale: "en", // match the app's language rather than the browser's
    });
  }, [status, buttonWidth]);

  if (status === "failed") return null;

  return (
    <Stack gap="lg">
      <Box ref={containerRef} w="100%">
        {/* Reserve the button's height so the form doesn't jump when it appears. */}
        <Group justify="center" mih={44} pos="relative">
          <div ref={buttonRef} style={{ opacity: signingIn ? 0.4 : 1, pointerEvents: signingIn ? "none" : undefined }} />
          {status === "loading" && <Loader size="sm" pos="absolute" aria-label="Loading Google sign-in" />}
        </Group>
        {signingIn && (
          <Group gap={8} justify="center" mt={8} role="status">
            <Loader size={14} />
            <Text size="sm" c="dimmed">
              Signing you in with Google…
            </Text>
          </Group>
        )}
      </Box>
      <Divider label="or" labelPosition="center" />
    </Stack>
  );
}
