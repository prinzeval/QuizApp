import { Modal, type ModalProps } from "@mantine/core";
import { useIsMobile } from "../hooks/useIsMobile.ts";

/** A Modal that holds a form: full screen on phones so the keyboard never covers the fields. */
export function FormModal(props: ModalProps) {
  const mobile = useIsMobile();
  return <Modal fullScreen={mobile} radius={mobile ? 0 : "lg"} transitionProps={mobile ? { transition: "slide-up", duration: 200 } : undefined} {...props} />;
}
