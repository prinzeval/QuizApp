import { Alert, Anchor, Checkbox, Group, Input, ScrollArea, SegmentedControl, Skeleton, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconFileText, IconFileTypeDocx, IconFileTypePdf, IconFileTypePpt, IconPhoto } from "@tabler/icons-react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { Material, MaterialKind } from "../../lib/learningApi.ts";
import { plural } from "../../lib/format.ts";

const KIND_ICON: Record<MaterialKind, typeof IconFileText> = {
  pdf: IconFileTypePdf,
  docx: IconFileTypeDocx,
  pptx: IconFileTypePpt,
  image: IconPhoto,
  text: IconFileText,
};

interface MaterialPickerProps {
  materials: UseQueryResult<{ materials: Material[] }>;
  scope: "all" | "pick";
  onScopeChange: (scope: "all" | "pick") => void;
  picked: string[];
  onPickedChange: (ids: string[]) => void;
  error?: string;
  /** Shown under the label, e.g. "Questions are written only from these notes." */
  description: string;
  onGoToMaterials: () => void;
}

/** "Study from": all of the room's ready materials, or a chosen few. */
export function MaterialPicker({
  materials,
  scope,
  onScopeChange,
  picked,
  onPickedChange,
  error,
  description,
  onGoToMaterials,
}: MaterialPickerProps) {
  const all = materials.data?.materials ?? [];
  const ready = all.filter(m => m.status === "ready");
  const pending = all.filter(m => m.status === "queued" || m.status === "processing").length;
  const noneReady = materials.isSuccess && ready.length === 0;
  const setScope = onScopeChange;
  const setPicked = onPickedChange;

  return (
    <Input.Wrapper label="Study from" error={error} description={ready.length > 0 ? description : undefined}>
      {materials.isPending ? (
        <Skeleton h={36} mt={6} />
      ) : materials.isError ? (
        <Alert color="red" variant="light" mt={6}>
          Couldn't load materials.{" "}
          <Anchor component="button" type="button" size="sm" onClick={() => materials.refetch()}>
            Try again
          </Anchor>
        </Alert>
      ) : noneReady ? (
        <Alert color="clay" variant="light" mt={6} title="No materials ready yet" data-testid="no-materials">
          <Text size="sm">
            {pending > 0
              ? `${plural(pending, "file")} still processing. You can start as soon as ${pending === 1 ? "it's" : "they're"} ready.`
              : "Upload your notes first. Everything here is made from them."}
          </Text>
          <Anchor component="button" type="button" size="sm" fw={600} mt={6} onClick={onGoToMaterials}>
            Go to Materials →
          </Anchor>
        </Alert>
      ) : (
        <Stack gap="xs" mt={6}>
          <SegmentedControl
            value={scope}
            onChange={value => setScope(value as "all" | "pick")}
            data={[
              { value: "all", label: `All materials (${ready.length})` },
              { value: "pick", label: "Choose…" },
            ]}
            fullWidth
          />
          {scope === "pick" && (
            <ScrollArea.Autosize mah={220} type="auto" offsetScrollbars>
              <Checkbox.Group value={picked} onChange={setPicked} aria-label="Materials">
                <Stack gap={6}>
                  {ready.map(material => {
                    const Icon = KIND_ICON[material.kind];
                    return (
                      <Checkbox.Card key={material.id} value={material.id} radius="md" p="sm" data-testid="material-choice">
                        <Group wrap="nowrap" gap="sm">
                          <Checkbox.Indicator />
                          <ThemeIcon variant="light" color="gray" size={32} radius="md">
                            <Icon size={18} stroke={1.6} />
                          </ThemeIcon>
                          <div style={{ minWidth: 0 }}>
                            <Text size="sm" fw={500} lineClamp={1} style={{ overflowWrap: "anywhere" }}>
                              {material.title}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {material.kind.toUpperCase()}
                              {material.pageCount ? ` · ${plural(material.pageCount, "page")}` : ""}
                            </Text>
                          </div>
                        </Group>
                      </Checkbox.Card>
                    );
                  })}
                </Stack>
              </Checkbox.Group>
            </ScrollArea.Autosize>
          )}
          {pending > 0 && (
            <Text size="xs" c="dimmed">
              {plural(pending, "more file")} still processing. {pending === 1 ? "It" : "They"}'ll show up here when ready.
            </Text>
          )}
        </Stack>
      )}
    </Input.Wrapper>
  );
}
