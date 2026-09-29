import { useState, type Ref } from "react";
import { Alert, Anchor, Button, SimpleGrid, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconArrowsDiff, IconBulb, IconListCheck, IconMoodSmile, IconSparkles, type Icon } from "@tabler/icons-react";
import { useSearchParams } from "react-router-dom";
import { useMaterials } from "../../hooks/learning.ts";
import { ChatFrame } from "./ChatSession.tsx";
import { Composer } from "./Composer.tsx";

const SUGGESTIONS: { icon: Icon; label: string; prompt: string }[] = [
  { icon: IconBulb, label: "Explain the main ideas of my notes", prompt: "Explain the main ideas of my notes" },
  { icon: IconListCheck, label: "Quiz me on the key concepts", prompt: "Quiz me on the key concepts in my notes, one question at a time" },
  {
    icon: IconArrowsDiff,
    label: "What's the difference between…?",
    prompt: "What's the difference between the concepts in my notes that are easiest to mix up?",
  },
  { icon: IconMoodSmile, label: "Explain it like I'm a beginner", prompt: "Explain the hardest topic in my notes like I'm a beginner" },
];

interface WelcomeProps {
  roomId: string;
  roomName: string;
  /** Creates a conversation and sends the first message. */
  onStart: (text: string) => Promise<void>;
  starting: boolean;
  composerRef?: Ref<HTMLTextAreaElement>;
}

/** A fresh chat: greeting, suggested prompts and the composer. Nothing is created until the first message. */
export function Welcome({ roomId, roomName, onStart, starting, composerRef }: WelcomeProps) {
  const [input, setInput] = useState("");
  const [, setSearchParams] = useSearchParams();
  const materials = useMaterials(roomId);
  const noMaterials = materials.isSuccess && !materials.data.materials.some(m => m.status === "ready");

  const start = async (text: string) => {
    try {
      await onStart(text);
      setInput("");
    } catch {
      /* the caller reports it */
    }
  };

  return (
    <ChatFrame
      follow={false}
      composer={
        <Composer
          ref={composerRef}
          value={input}
          onChange={setInput}
          busy={false}
          pending={starting}
          onSubmit={() => {
            const text = input.trim();
            if (text) void start(text);
          }}
        />
      }
    >
      <Stack align="center" gap="lg" pt={{ base: "md", sm: 40 }} pb="md">
        <ThemeIcon size={52} radius="xl" variant="light" aria-hidden="true">
          <IconSparkles size={26} stroke={1.6} />
        </ThemeIcon>
        <Stack gap={6} align="center" maw={480}>
          <Title order={2} ta="center" fz={{ base: 22, sm: 26 }}>
            What would you like to learn?
          </Title>
          <Text c="dimmed" ta="center" size="sm">
            Ask anything about the materials in <strong>{roomName}</strong>. Every answer points back to the page it came from.
          </Text>
        </Stack>

        {noMaterials && (
          <Alert variant="light" color="yellow" radius="md" w="100%" maw={560} title="No materials to learn from yet">
            The tutor answers from this room's materials.{" "}
            <Anchor component="button" type="button" fz="sm" onClick={() => setSearchParams({ tab: "materials" }, { replace: true })}>
              Upload your notes
            </Anchor>{" "}
            first for grounded answers.
          </Alert>
        )}

        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm" w="100%" maw={600}>
          {SUGGESTIONS.map(({ icon: SuggestionIcon, label, prompt }) => (
            <Button
              key={label}
              variant="default"
              radius="md"
              h="auto"
              mih={52}
              py="sm"
              fw={500}
              justify="flex-start"
              onClick={() => void start(prompt)}
              disabled={starting}
              data-testid="tutor-suggestion"
              title={prompt}
              leftSection={<SuggestionIcon size={18} stroke={1.7} color="var(--mantine-primary-color-filled)" aria-hidden="true" />}
              styles={{ label: { whiteSpace: "normal", textAlign: "left", lineHeight: 1.35 } }}
            >
              {label}
            </Button>
          ))}
        </SimpleGrid>
      </Stack>
    </ChatFrame>
  );
}
