import type { RefObject } from "react";
import { useEffect, useId, useRef } from "react";

let activeModalCount = 0;
const modalStack: string[] = [];

export function useModalA11y(
  open: boolean,
  dialogRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  modalId?: string,
): void {
  const fallbackId = useId();
  const resolvedModalId = modalId ?? fallbackId;
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return undefined;
    const appRoot = document.getElementById("root");
    activeModalCount += 1;
    modalStack.push(resolvedModalId);
    if (appRoot) {
      appRoot.setAttribute("aria-hidden", "true");
      appRoot.setAttribute("inert", "");
    }
    window.setTimeout(() => focusFirstDialogControl(dialogRef.current), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== resolvedModalId) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key === "Tab") trapFocus(event, dialogRef.current);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const index = modalStack.lastIndexOf(resolvedModalId);
      if (index >= 0) modalStack.splice(index, 1);
      activeModalCount = Math.max(0, activeModalCount - 1);
      if (activeModalCount === 0 && appRoot) {
        appRoot.removeAttribute("aria-hidden");
        appRoot.removeAttribute("inert");
      }
    };
  }, [dialogRef, open, resolvedModalId]);
}

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true");
}

function focusFirstDialogControl(container: HTMLElement | null): void {
  if (!container) return;
  const first = focusableElements(container)[0] ?? container;
  first.focus();
}

function trapFocus(event: KeyboardEvent, container: HTMLElement | null): void {
  if (!container) return;
  const focusable = focusableElements(container);
  if (!focusable.length) {
    event.preventDefault();
    container.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
    return;
  }
  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
