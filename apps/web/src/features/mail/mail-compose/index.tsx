// React Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@RetailOS/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@RetailOS/ui/components/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@RetailOS/ui/components/tooltip";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
// Third-party Imports
import {
  BoldIcon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  MoreVerticalIcon,
  PaperclipIcon,
  SendIcon,
  Trash2Icon,
  UnderlineIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// Config Imports
import { deriveRecipientEmailAddress } from "@/features/mail/mail-config";
// Type Imports
import type { ComposeEmailPayload } from "@/features/mail/types";
import { ComposeFieldRow } from "./compose-field-row";
import { FormatButton } from "./format-button";

export interface MailComposeProps {
  onOpenChange: (open: boolean) => void;
  onSaveDraft: (payload: ComposeEmailPayload) => void;
  onSend: (payload: ComposeEmailPayload) => void;
  open: boolean;
}

export interface ComposeFormState {
  bcc: string;
  body: string;
  cc: string;
  subject: string;
  to: string;
}

export const INITIAL_COMPOSE_FORM_STATE: ComposeFormState = {
  to: "",
  cc: "",
  bcc: "",
  subject: "",
  body: "",
};

export const MailCompose = ({
  open,
  onOpenChange,
  onSend,
  onSaveDraft,
}: MailComposeProps) => {
  // States
  const [composeForm, setComposeForm] = useState<ComposeFormState>(
    INITIAL_COMPOSE_FORM_STATE
  );
  const [isCcVisible, setIsCcVisible] = useState(false);
  const [isBccVisible, setIsBccVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);

  // Vars
  const hasComposeContent =
    composeForm.to.trim().length > 0 ||
    composeForm.cc.trim().length > 0 ||
    composeForm.bcc.trim().length > 0 ||
    composeForm.subject.trim().length > 0 ||
    composeForm.body.trim().length > 0 ||
    attachmentFiles.length > 0;

  const isSendEnabled =
    composeForm.to.trim().length > 0 &&
    composeForm.subject.trim().length > 0 &&
    composeForm.body.trim().length > 0;

  const minimizedWindowLabel =
    composeForm.subject.trim() || composeForm.to.trim() || "New Message";

  // Refs
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wasMinimizedRef = useRef(false);

  // Hooks
  const resetComposeForm = useCallback(() => {
    setComposeForm(INITIAL_COMPOSE_FORM_STATE);
    setIsCcVisible(false);
    setIsBccVisible(false);
    setIsMinimized(false);
    setAttachmentFiles([]);

    if (editorRef.current) {
      editorRef.current.innerHTML = "";
    }
  }, []);

  const syncComposeBodyFromEditor = useCallback(() => {
    const messageBody = editorRef.current?.innerText ?? "";

    setComposeForm((currentForm) => ({ ...currentForm, body: messageBody }));
  }, []);

  const handleClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetComposeForm();
      }

      onOpenChange(nextOpen);
    },
    [onOpenChange, resetComposeForm]
  );

  const buildComposePayload = useCallback((): ComposeEmailPayload => {
    syncComposeBodyFromEditor();

    return {
      to: composeForm.to.trim(),
      toEmail: deriveRecipientEmailAddress(composeForm.to.trim()),
      cc: composeForm.cc.trim() || undefined,
      bcc: composeForm.bcc.trim() || undefined,
      subject: composeForm.subject.trim(),
      body: editorRef.current?.innerText.trim() ?? composeForm.body.trim(),
    };
  }, [composeForm, syncComposeBodyFromEditor]);

  const handleSend = () => {
    const composePayload = buildComposePayload();

    if (!(composePayload.to && composePayload.subject && composePayload.body)) {
      return;
    }

    onSend(composePayload);
    resetComposeForm();
  };

  const handleSaveDraft = () => {
    const composePayload = buildComposePayload();

    onSaveDraft(composePayload);
    resetComposeForm();
  };

  const handleDiscard = () => {
    handleClose(false);
  };

  const handleMinimize = () => {
    syncComposeBodyFromEditor();
    setIsMinimized(true);
  };

  const handleRestore = () => {
    setIsMinimized(false);
  };

  const applyFormat = (command: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false);
    syncComposeBodyFromEditor();
  };

  const handleAttachmentChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFiles = Array.from(event.target.files ?? []);

    if (selectedFiles.length > 0) {
      setAttachmentFiles((currentFiles) => [...currentFiles, ...selectedFiles]);
    }

    event.target.value = "";
  };

  const toggleRecipientFieldVisibility = (field: "cc" | "bcc") => {
    if (field === "cc") {
      setIsCcVisible((currentValue) => !currentValue);

      return;
    }

    setIsBccVisible((currentValue) => !currentValue);
  };

  useEffect(() => {
    if (wasMinimizedRef.current && !isMinimized && editorRef.current) {
      editorRef.current.innerText = composeForm.body;
    }

    wasMinimizedRef.current = isMinimized;
  }, [composeForm.body, isMinimized]);

  return (
    <>
      <Dialog onOpenChange={handleClose} open={open && !isMinimized}>
        <DialogContent
          className="gap-0 overflow-hidden rounded-lg p-0 shadow-xl ring-1 sm:top-auto sm:right-6 sm:bottom-6 sm:left-auto sm:max-w-xl sm:translate-x-0 sm:translate-y-0 lg:max-w-3xl"
          showCloseButton={false}
        >
          <div className="flex items-center justify-between border-border border-b bg-muted/40 px-5 py-3.5">
            <DialogTitle className="font-medium text-base">
              Compose Message
            </DialogTitle>
            <div className="flex items-center gap-0.5">
              <Button
                className="text-muted-foreground hover:text-foreground"
                onClick={handleMinimize}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <MinusIcon className="size-4" />
                <span className="sr-only">Minimize</span>
              </Button>
              <Button
                className="text-muted-foreground hover:text-foreground"
                onClick={handleDiscard}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <XIcon className="size-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>

          <div className="flex flex-col bg-background">
            <ComposeFieldRow
              id="compose-to"
              label="To:"
              onChange={(value) =>
                setComposeForm((currentForm) => ({ ...currentForm, to: value }))
              }
              placeholder="Recipients"
              trailing={
                <div className="flex shrink-0 items-center gap-1 text-muted-foreground text-sm">
                  <button
                    className={cn(
                      "transition-colors hover:text-foreground",
                      isCcVisible && "font-medium text-foreground"
                    )}
                    onClick={() => toggleRecipientFieldVisibility("cc")}
                    type="button"
                  >
                    Cc
                  </button>
                  <span>|</span>
                  <button
                    className={cn(
                      "transition-colors hover:text-foreground",
                      isBccVisible && "font-medium text-foreground"
                    )}
                    onClick={() => toggleRecipientFieldVisibility("bcc")}
                    type="button"
                  >
                    Bcc
                  </button>
                </div>
              }
              value={composeForm.to}
            />

            {isCcVisible && (
              <ComposeFieldRow
                id="compose-cc"
                label="Cc:"
                onChange={(value) =>
                  setComposeForm((currentForm) => ({
                    ...currentForm,
                    cc: value,
                  }))
                }
                placeholder="Carbon copy recipients"
                value={composeForm.cc}
              />
            )}

            {isBccVisible && (
              <ComposeFieldRow
                id="compose-bcc"
                label="Bcc:"
                onChange={(value) =>
                  setComposeForm((currentForm) => ({
                    ...currentForm,
                    bcc: value,
                  }))
                }
                placeholder="Blind carbon copy recipients"
                value={composeForm.bcc}
              />
            )}

            <ComposeFieldRow
              id="compose-subject"
              label="Subject:"
              onChange={(value) =>
                setComposeForm((currentForm) => ({
                  ...currentForm,
                  subject: value,
                }))
              }
              placeholder="Message subject"
              value={composeForm.subject}
            />

            <div className="flex items-center gap-0.5 border-border border-b px-3 py-1.5">
              <FormatButton label="Bold" onClick={() => applyFormat("bold")}>
                <BoldIcon className="size-4" />
              </FormatButton>
              <FormatButton
                label="Italic"
                onClick={() => applyFormat("italic")}
              >
                <ItalicIcon className="size-4" />
              </FormatButton>
              <FormatButton
                label="Underline"
                onClick={() => applyFormat("underline")}
              >
                <UnderlineIcon className="size-4" />
              </FormatButton>
              <div className="mx-1 h-5 w-px bg-border" />
              <FormatButton
                label="Numbered list"
                onClick={() => applyFormat("insertOrderedList")}
              >
                <ListOrderedIcon className="size-4" />
              </FormatButton>
              <FormatButton
                label="Bulleted list"
                onClick={() => applyFormat("insertUnorderedList")}
              >
                <ListIcon className="size-4" />
              </FormatButton>
              <div className="mx-1 h-5 w-px bg-border" />
              <FormatButton
                label="Insert link"
                onClick={() => applyFormat("createLink")}
              >
                <LinkIcon className="size-4" />
              </FormatButton>
              <FormatButton
                label="Insert image"
                onClick={() => applyFormat("insertImage")}
              >
                <ImageIcon className="size-4" />
              </FormatButton>
            </div>

            <div
              aria-label="Message body"
              aria-multiline="true"
              className="min-h-72 px-5 py-4 text-sm leading-relaxed outline-none empty:before:text-muted-foreground empty:before:italic empty:before:content-[attr(data-placeholder)]"
              contentEditable
              data-placeholder="Write your message..."
              onBlur={syncComposeBodyFromEditor}
              onInput={syncComposeBodyFromEditor}
              ref={editorRef}
              role="textbox"
              tabIndex={0}
            />

            {attachmentFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 border-border border-t px-5 py-3">
                {attachmentFiles.map((attachmentFile, attachmentIndex) => (
                  <div
                    className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-muted-foreground text-xs"
                    key={`${attachmentFile.name}-${attachmentIndex}`}
                  >
                    <PaperclipIcon className="size-3" />
                    <span className="max-w-40 truncate">
                      {attachmentFile.name}
                    </span>
                    <button
                      className="hover:text-foreground"
                      onClick={() =>
                        setAttachmentFiles((currentFiles) =>
                          currentFiles.filter(
                            (_, fileIndex) => fileIndex !== attachmentIndex
                          )
                        )
                      }
                      type="button"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-border border-t px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Button
                className="gap-2 rounded-lg px-5"
                disabled={!isSendEnabled}
                onClick={handleSend}
                type="button"
              >
                Send
                <SendIcon className="size-4" />
              </Button>
              <input
                className="hidden"
                multiple
                onChange={handleAttachmentChange}
                ref={fileInputRef}
                type="file"
              />
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      className="relative text-muted-foreground hover:text-foreground"
                      onClick={() => fileInputRef.current?.click()}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    />
                  }
                >
                  <PaperclipIcon className="size-4" />
                  <span className="sr-only">Attach files</span>
                  {attachmentFiles.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                      {attachmentFiles.length}
                    </span>
                  )}
                </TooltipTrigger>
                <TooltipContent>Attach files</TooltipContent>
              </Tooltip>
            </div>

            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      className="text-muted-foreground hover:text-foreground"
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    />
                  }
                >
                  <MoreVerticalIcon className="size-4" />
                  <span className="sr-only">More options</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={!hasComposeContent}
                    onClick={handleSaveDraft}
                  >
                    Save draft
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleMinimize}>
                    Minimize
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleDiscard}
                    variant="destructive"
                  >
                    Discard
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      className="text-muted-foreground hover:text-foreground"
                      onClick={handleDiscard}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    />
                  }
                >
                  <Trash2Icon className="size-4" />
                  <span className="sr-only">Discard</span>
                </TooltipTrigger>
                <TooltipContent>Discard</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {open && isMinimized && (
        <div className="fixed right-6 bottom-6 z-50 flex w-80 items-center justify-between rounded-lg border border-border bg-background px-4 py-3 shadow-lg">
          <button
            className="flex-1 truncate text-left font-medium text-sm"
            onClick={handleRestore}
            type="button"
          >
            Compose Message — {minimizedWindowLabel}
          </button>
          <div className="flex items-center gap-0.5">
            <Button
              onClick={handleRestore}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <MinusIcon className="size-4 rotate-180" />
              <span className="sr-only">Restore</span>
            </Button>
            <Button
              onClick={handleDiscard}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default MailCompose;
