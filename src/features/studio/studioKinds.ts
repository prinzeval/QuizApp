import { IconHierarchy2, IconListCheck, IconPhoto } from "@tabler/icons-react";
import type { StudioKind } from "../../lib/learningApi.ts";

/** What each Studio tool is called and how it looks. The quiz tile opens the quiz form. */
export const STUDIO_TOOLS = {
  image_cards: {
    label: "Image cards",
    description: "Flip cards made from the real diagrams and photos in your files.",
    icon: IconPhoto,
    color: "teal",
    action: "Make image cards",
    note: "The AI looks through each file's pages for pictures and their labels, so this can take a minute or two. Files it has already looked through are instant.",
  },
  mind_map: {
    label: "Mind map",
    description: "A map of the topics, with pictures attached, that you can drag around.",
    icon: IconHierarchy2,
    color: "violet",
    action: "Make mind map",
    note: "Built from the text of your files. Pictures found for image cards or picture quizzes are attached to their topics.",
  },
} as const satisfies Record<StudioKind, object>;

export const QUIZ_TOOL = {
  label: "Quiz",
  description: "Questions from your notes, including ones on their pictures.",
  icon: IconListCheck,
  color: "clay",
};
