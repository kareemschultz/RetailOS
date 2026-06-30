// Type Imports
import type { MessageType, PendingAttachment } from "@/features/chat/types";

const HTTP_PROTOCOL_REGEX = /^https?:\/\//i;

export const formatFileSize = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const buildAttachmentFromFile = (file: File): PendingAttachment => {
  const type: PendingAttachment["type"] = file.type.startsWith("image/")
    ? "image"
    : "file";

  return {
    id: `${Date.now()}-${file.name}`,
    file,
    previewUrl: URL.createObjectURL(file),
    type,
  };
};

export const getMessageTypeFromAttachments = (
  attachments: PendingAttachment[]
): MessageType => {
  if (attachments.length === 0) {
    return "text";
  }

  if (attachments.every((attachment) => attachment.type === "image")) {
    return "image";
  }

  return "file";
};

export const normalizeUrl = (url: string) => {
  const trimmed = url.trim();

  if (HTTP_PROTOCOL_REGEX.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
};

export const revokeAttachmentUrls = (attachments: PendingAttachment[]) => {
  attachments.forEach((attachment) =>
    URL.revokeObjectURL(attachment.previewUrl)
  );
};

export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);

        return;
      }

      reject(new Error("Failed to read file"));
    };

    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

interface TextareaSelection {
  inputValue: string;
  setInputValue: (value: string) => void;
  textarea: HTMLTextAreaElement;
}

export const insertAtCursor = (selection: TextareaSelection, value: string) => {
  const { textarea, inputValue, setInputValue } = selection;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const nextValue = `${inputValue.slice(0, start)}${value}${inputValue.slice(end)}`;

  setInputValue(nextValue);

  requestAnimationFrame(() => {
    textarea.focus();
    const cursor = start + value.length;

    textarea.setSelectionRange(cursor, cursor);
  });
};

export const applyBoldFormat = (selection: TextareaSelection) => {
  const { textarea, inputValue, setInputValue } = selection;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = inputValue.slice(start, end);

  if (!selected) {
    return false;
  }

  const isAlreadyBold =
    selected.startsWith("**") && selected.endsWith("**") && selected.length > 4;
  const nextSelected = isAlreadyBold
    ? selected.slice(2, -2)
    : `**${selected}**`;
  const nextValue = `${inputValue.slice(0, start)}${nextSelected}${inputValue.slice(end)}`;

  setInputValue(nextValue);

  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(start, start + nextSelected.length);
  });

  return true;
};

export const applyLinkFormat = (
  selection: TextareaSelection,
  urlInput: string
) => {
  const { textarea, inputValue, setInputValue } = selection;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = inputValue.slice(start, end);
  const url = normalizeUrl(urlInput);

  if (selected) {
    const linkMarkdown = `[${selected}](${url})`;
    const nextValue = `${inputValue.slice(0, start)}${linkMarkdown}${inputValue.slice(end)}`;

    setInputValue(nextValue);

    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + linkMarkdown.length;

      textarea.setSelectionRange(cursor, cursor);
    });

    return;
  }

  insertAtCursor(selection, `[${url}](${url})`);
};
