import type { ReactNode } from "react";
import { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Button, IconButton } from "./primitives";
import { useModalA11y } from "../hooks/use-modal-a11y";

export function Dialog({
  open,
  title,
  children,
  footer,
  onClose,
  large,
  showClose = true,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  large?: boolean;
  showClose?: boolean;
}) {
  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const dialogRef = useRef<HTMLElement>(null);
  useModalA11y(open, dialogRef, onClose, dialogId);
  if (!open) return null;
  return createPortal(
    <div className="dialog-scrim" role="presentation">
      <section ref={dialogRef} className={`dialog ${large ? "large" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header className="dialog-header">
          <h2 id={titleId} className="dialog-title">{title}</h2>
          {showClose ? <IconButton icon="x" size="lg" label="关闭弹窗" onClick={onClose} /> : null}
        </header>
        <div className="dialog-body">{children}</div>
        {footer ? <footer className="dialog-footer">{footer}</footer> : null}
      </section>
    </div>,
    document.body,
  );
}

export function NoticeDialog({
  open,
  title,
  description,
  confirmText = "确认",
  cancelText = "取消",
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="dialog" onClick={onClose}>{cancelText}</Button>
          <Button variant={danger ? "danger" : "primary"} size="dialog" onClick={onConfirm}>{confirmText}</Button>
        </>
      }
    >
      <p style={{ margin: 0, color: "var(--foreground-secondary)", lineHeight: 1.6, whiteSpace: "pre-line" }}>{description}</p>
    </Dialog>
  );
}
