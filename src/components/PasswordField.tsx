import { useState } from "react";
import { Box, Group, PasswordInput, Progress, Text, type PasswordInputProps } from "@mantine/core";
import { passwordStrength } from "../lib/passwordStrength.ts";
import { useIsMobile } from "../hooks/useIsMobile.ts";

/** Mantine PasswordInput with a keyboard-reachable, clearly labelled show/hide toggle. */
export function PasswordField(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const mobile = useIsMobile();
  return (
    <PasswordInput
      {...props}
      visible={visible}
      onVisibilityChange={setVisible}
      visibilityToggleFocusable
      visibilityToggleButtonProps={{ "aria-label": visible ? "Hide password" : "Show password" }}
      rightSectionWidth={mobile ? 40 : undefined}
      styles={mobile ? { visibilityToggle: { width: 36, height: 36, minWidth: 36, minHeight: 36 } } : undefined}
    />
  );
}

const STRENGTH_COLORS = ["gray", "red", "orange", "yellow", "teal"] as const;

/** Four-segment strength meter (Mantine's "password strength" pattern) for a new password. */
export function StrengthMeter({ password }: { password: string }) {
  const strength = passwordStrength(password);
  if (!password) return null;
  const color = STRENGTH_COLORS[strength.score];
  return (
    <Box mt={8}>
      <Group gap={5} grow aria-hidden="true">
        {[1, 2, 3, 4].map(i => (
          <Progress key={i} size={4} value={i <= strength.score ? 100 : 0} color={color} transitionDuration={150} />
        ))}
      </Group>
      <Text size="xs" c={`${color}.7`} fw={600} mt={6} aria-live="polite">
        {strength.label}
      </Text>
    </Box>
  );
}
