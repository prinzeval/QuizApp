import { useEffect, useState } from "react";
import { Markdown } from "../../tutor/Markdown.tsx";
import { Paper, Skeleton, Stack, Text } from "@mantine/core";


/** Notes as text: Markdown rendered properly, plain text kept as written. */
export function TextPreview({ blob, markdown }: { blob: Blob; markdown: boolean }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void blob.text().then(value => !cancelled && setText(value));
    return () => {
      cancelled = true;
    };
  }, [blob]);

  const loading = (
    <Stack gap="xs" aria-busy="true" aria-label="Loading text">
      <Skeleton h={22} w="50%" />
      <Skeleton h={14} />
      <Skeleton h={14} />
      <Skeleton h={14} w="80%" />
    </Stack>
  );

  return (
    <Paper withBorder radius="lg" p={{ base: "md", sm: "xl" }} maw={820} mx="auto" data-testid="text-preview">
      {text === null ? (
        loading
      ) : markdown ? (
        <Markdown text={text} />
      ) : (
        <Text fz={{ base: 15, sm: 16 }} lh={1.7} style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {text}
        </Text>
      )}
    </Paper>
  );
}
