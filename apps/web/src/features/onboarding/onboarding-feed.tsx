import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@RetailOS/ui/components/accordion";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@RetailOS/ui/components/avatar";
import { Button } from "@RetailOS/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@RetailOS/ui/components/card";
import { Checkbox } from "@RetailOS/ui/components/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@RetailOS/ui/components/dialog";
import { Input } from "@RetailOS/ui/components/input";
import { Label } from "@RetailOS/ui/components/label";
import { Progress } from "@RetailOS/ui/components/progress";
import {
  type FileWithPreview,
  formatBytes,
  useFileUpload,
} from "@RetailOS/ui/hooks/use-file-upload";
import { Link } from "@tanstack/react-router";
import {
  AlertCircleIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  DollarSignIcon,
  FileTextIcon,
  HandCoinsIcon,
  HandshakeIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";

interface UploadProgress {
  completed: boolean;
  fileId: string;
  progress: number;
}

// Simulates file upload with realistic progress reporting and variable timing
const simulateUpload = (
  totalBytes: number,
  onProgress: (progress: number) => void,
  onComplete: () => void
) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  let uploadedBytes = 0;
  let lastProgressReport = 0;

  const simulateChunk = () => {
    const chunkSize = Math.floor(Math.random() * 300_000) + 2000;

    uploadedBytes = Math.min(totalBytes, uploadedBytes + chunkSize);

    const progressPercent = Math.floor((uploadedBytes / totalBytes) * 100);

    if (progressPercent > lastProgressReport) {
      lastProgressReport = progressPercent;
      onProgress(progressPercent);
    }

    if (uploadedBytes < totalBytes) {
      const delay = Math.floor(Math.random() * 450) + 50;

      const extraDelay = Math.random() < 0.05 ? 500 : 0;

      timeoutId = setTimeout(simulateChunk, delay + extraDelay);
    } else {
      onComplete();
    }
  };

  timeoutId = setTimeout(simulateChunk, 100);

  return () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };
};

// Returns a file icon component for non-image files, or false for image files
const getFileIcon = (file: { file: File | { type: string; name: string } }) => {
  const fileName = file.file.name;
  const fileType = file.file.type;
  const extension = fileName.split(".").pop()?.toLowerCase();

  const isImage =
    fileType?.startsWith("image/") ||
    ["jpg", "jpeg", "png", "svg"].includes(extension || "");

  return isImage ? false : <FileTextIcon className="size-5" />;
};

const avatars = [
  {
    src: "/images/avatars/avatar-3.webp",
    fallback: "OS",
    name: "Olivia Sparks",
  },
  {
    src: "/images/avatars/avatar-6.webp",
    fallback: "HL",
    name: "Howard Lloyd",
  },
  {
    src: "/images/avatars/avatar-5.webp",
    fallback: "HR",
    name: "Hallie Richards",
  },
];

const TOTAL_STEPS = 4;

function OnboardingFeed() {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);

  const handleFilesAdded = (addedFiles: FileWithPreview[]) => {
    const newProgressItems = addedFiles.map((file) => ({
      fileId: file.id,
      progress: 0,
      completed: false,
    }));

    setUploadProgress((prev) => [...prev, ...newProgressItems]);

    const cleanupFunctions: Array<() => void> = [];

    for (const file of addedFiles) {
      const fileSize = file.file.size;

      const cleanup = simulateUpload(
        fileSize,

        (progressValue) => {
          setUploadProgress((prev) =>
            prev.map((item) =>
              item.fileId === file.id
                ? { ...item, progress: progressValue }
                : item
            )
          );
        },

        () => {
          setUploadProgress((prev) =>
            prev.map((item) =>
              item.fileId === file.id ? { ...item, completed: true } : item
            )
          );
        }
      );

      cleanupFunctions.push(cleanup);
    }

    return () => {
      for (const cleanup of cleanupFunctions) {
        cleanup();
      }
    };
  };

  const handleFileRemoved = (fileId: string) => {
    setUploadProgress((prev) => prev.filter((item) => item.fileId !== fileId));
  };

  const maxSizeMB = 5;
  const maxSize = maxSizeMB * 1024 * 1024;
  const maxFiles = 6;

  const [
    { files, isDragging, errors },
    {
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      removeFile,
      getInputProps,
    },
  ] = useFileUpload({
    maxSize,
    multiple: true,
    maxFiles,
    onFilesAdded: handleFilesAdded,
  });

  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [openItem, setOpenItem] = useState<string[]>(["item-1"]);

  const handleComplete = (index: number) => {
    setCompleted((prev) => {
      const next = new Set(prev);

      next.add(index);

      return next;
    });

    // close current and open next accordion item (if any)
    const nextIndex = index + 1;

    if (nextIndex < TOTAL_STEPS) {
      setOpenItem([`item-${nextIndex + 1}`]);
    } else {
      // last item completed — close all
      setOpenItem([]);
    }
  };

  const progress = Math.round((completed.size / TOTAL_STEPS) * 100);

  return (
    <div className="space-y-6">
      <Card className="w-full max-w-sm sm:max-w-lg">
        <CardHeader>
          <CardTitle className="font-semibold leading-none">
            Getting started
          </CardTitle>
          <CardDescription>
            Follow the steps to set up your workspace. This allows you to create
            your first dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm">
              Step: {completed.size}/{TOTAL_STEPS}
            </p>
            <Progress className="w-full" value={progress} />
          </div>
          <Accordion
            className='w-full min-w-2xs space-y-3 overflow-visible border-0 [&>*>[data-slot="accordion-content"]]:px-0'
            onValueChange={setOpenItem}
            value={openItem}
          >
            {/* Import your data */}
            <AccordionItem
              className="border! rounded-md bg-transparent sm:min-w-md"
              value="item-1"
            >
              <AccordionTrigger className="items-center px-5">
                <span className="flex items-center gap-2">
                  {completed.has(0) ? (
                    <CircleCheckIcon className="size-4 shrink-0" />
                  ) : (
                    <CircleDashedIcon className="size-4 shrink-0" />
                  )}
                  <span>Import your data</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-5">
                <div className="flex flex-col gap-4">
                  <button
                    className="flex min-h-50 flex-col items-center justify-center gap-4 overflow-hidden rounded-sm border border-input border-dashed p-6 text-center has-[input:focus]:border-ring has-[input:focus]:ring-[3px] has-[input:focus]:ring-ring/50 data-[dragging=true]:bg-accent/50"
                    data-dragging={isDragging || undefined}
                    data-files={files.length > 0 || undefined}
                    onClick={openFileDialog}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    type="button"
                  >
                    <input
                      {...getInputProps()}
                      aria-label="Upload image file"
                      className="sr-only"
                    />
                    <UploadIcon className="size-10 stroke-1" />
                    <p className="font-medium">
                      Drag & Drop or Choose file to upload
                    </p>
                    <p className="text-muted-foreground text-sm">
                      Max {maxFiles} files ∙ Up to {maxSizeMB}MB
                    </p>
                  </button>

                  {files.length > 0 && (
                    <div className="flex w-full flex-col gap-3">
                      <div className="w-full space-y-2">
                        {files.map((file) => {
                          const fileProgress = uploadProgress.find(
                            (p) => p.fileId === file.id
                          );

                          const isUploading =
                            fileProgress && !fileProgress.completed;

                          return (
                            <div
                              className="flex flex-col gap-1 rounded-lg bg-muted p-3 transition-opacity duration-300"
                              data-uploading={isUploading || undefined}
                              key={file.id}
                            >
                              <div className="flex justify-between gap-2">
                                <div className="flex items-center gap-3 overflow-hidden in-data-[uploading=true]:opacity-50">
                                  <div className="aspect-square shrink-0 rounded bg-accent">
                                    {getFileIcon(file) || (
                                      <img
                                        alt={file.file.name}
                                        className="size-10 rounded-[inherit] object-cover"
                                        height={40}
                                        src={file.preview}
                                        width={40}
                                      />
                                    )}
                                  </div>
                                  <div className="flex min-w-0 flex-col gap-0.5 max-sm:max-w-50">
                                    <p className="truncate font-medium">
                                      {file.file.name}
                                    </p>
                                    <p className="text-muted-foreground text-sm">
                                      {formatBytes(file.file.size)}
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  aria-label="Remove file"
                                  className="size-6 hover:bg-transparent"
                                  onClick={() => {
                                    handleFileRemoved(file.id);
                                    removeFile(file.id);
                                  }}
                                  variant="ghost"
                                >
                                  <XIcon aria-hidden="true" />
                                </Button>
                              </div>

                              {fileProgress &&
                                (() => {
                                  const fileProgressValue =
                                    fileProgress.progress || 0;
                                  const fileCompleted = fileProgress.completed;

                                  if (fileCompleted) {
                                    return null;
                                  }

                                  return (
                                    <div className="mt-1 flex flex-col gap-2">
                                      <span className="self-end text-muted-foreground text-sm">
                                        {fileProgressValue}%
                                      </span>
                                      <div className="h-2 w-full overflow-hidden rounded-full bg-primary/10">
                                        <div
                                          className="h-full bg-primary transition-all duration-300 ease-out"
                                          style={{
                                            width: `${fileProgressValue}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })()}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {errors.length > 0 && (
                    <div
                      className="flex items-center gap-1 text-destructive text-xs"
                      role="alert"
                    >
                      <AlertCircleIcon className="size-3 shrink-0" />
                      <span>{errors[0]}</span>
                    </div>
                  )}
                  <Button onClick={() => handleComplete(0)}>Submit</Button>
                </div>
              </AccordionContent>
            </AccordionItem>
            {/* Subscribe */}
            <AccordionItem
              className="border! rounded-md bg-transparent sm:min-w-md"
              value="item-2"
            >
              <AccordionTrigger className="items-center px-5">
                <span className="flex items-center gap-2">
                  {completed.has(1) ? (
                    <CircleCheckIcon className="size-4 shrink-0" />
                  ) : (
                    <CircleDashedIcon className="size-4 shrink-0" />
                  )}
                  <span>Subscribe</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-5">
                <div className="flex flex-col items-center justify-center gap-2 rounded-md bg-muted px-5 py-4">
                  <DollarSignIcon className="size-6 shrink-0" />
                  <p className="font-medium text-base">Subscribe</p>
                  <p className="max-w-xs text-center text-muted-foreground text-sm">
                    To get started, subscribe with your organization account
                    from your company.
                  </p>
                  <Dialog>
                    <DialogTrigger
                      render={
                        <Button
                          className="mt-5"
                          disabled={!completed.has(0)}
                          size="sm"
                        />
                      }
                    >
                      Subscribe
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader className="text-center">
                        <DialogTitle className="text-xl">
                          Subscribe to RetailOS for latest updates
                        </DialogTitle>
                        <DialogDescription className="text-base">
                          Subscribe to our blog to stay updated with the latest
                          posts and news. Simply enter your email address and
                          click &apos;Subscribe&apos; to receive notifications.
                        </DialogDescription>
                      </DialogHeader>
                      <form
                        className="flex gap-4"
                        onSubmit={(e) => e.preventDefault()}
                      >
                        <div className="grid grow gap-3">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            name="email"
                            placeholder="example@gmail.com"
                            required
                            type="email"
                          />
                        </div>
                        <DialogClose
                          render={
                            <Button
                              className="self-end"
                              onClick={() => handleComplete(1)}
                              type="button"
                            />
                          }
                        >
                          Subscribe
                        </DialogClose>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </AccordionContent>
            </AccordionItem>
            {/* Refer & Earn */}
            <AccordionItem
              className="border! rounded-md bg-transparent sm:min-w-md"
              value="item-3"
            >
              <AccordionTrigger className="items-center px-5">
                <span className="flex items-center gap-2">
                  {completed.has(2) ? (
                    <CircleCheckIcon className="size-4 shrink-0" />
                  ) : (
                    <CircleDashedIcon className="size-4 shrink-0" />
                  )}
                  <span>Refer & Earn</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-5">
                <div className="flex flex-col items-center justify-center gap-2 rounded-md bg-muted px-5 py-4">
                  <HandCoinsIcon className="size-6 shrink-0" />
                  <p className="font-medium text-base">Refer & Earn</p>
                  <p className="max-w-xs text-center text-muted-foreground text-sm">
                    To get started, refer your colleagues and earn AI credits.
                  </p>
                  <Dialog>
                    <DialogTrigger
                      render={
                        <Button
                          className="mt-5"
                          disabled={!completed.has(1)}
                          size="sm"
                        />
                      }
                    >
                      Refer
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-xl">
                      <DialogHeader>
                        <DialogTitle className="text-xl">
                          Refer & Earn AI Credits
                        </DialogTitle>
                        <DialogDescription className="text-base">
                          Get 5 AI credits per successful referral sign up. Use
                          AI credits to get insights, custom meeting notes,
                          automated soundbites etc.
                        </DialogDescription>
                      </DialogHeader>
                      <form className="flex flex-col gap-4 pt-4">
                        <div className="grid grow gap-3">
                          <Label htmlFor="refer-email">Refer by email</Label>
                          <Input
                            id="refer-email"
                            name="refer-email"
                            placeholder="Emails, separated by commas or tab"
                            required
                            type="text"
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <Checkbox id="terms" />
                          <Label htmlFor="terms">
                            Refer 13 people from acme.com
                          </Label>
                        </div>
                        <AvatarGroup>
                          {avatars.map((avatar) => (
                            <Avatar key={avatar.name}>
                              <AvatarImage alt={avatar.name} src={avatar.src} />
                              <AvatarFallback className="text-xs">
                                {avatar.fallback}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          <AvatarGroupCount className="text-xs">
                            +10
                          </AvatarGroupCount>
                        </AvatarGroup>
                        <div className="flex justify-end gap-2">
                          <DialogClose render={<Button variant="outline" />}>
                            Cancel
                          </DialogClose>
                          <DialogClose
                            render={
                              <Button
                                onClick={() => handleComplete(2)}
                                type="button"
                              />
                            }
                          >
                            Refer
                          </DialogClose>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </AccordionContent>
            </AccordionItem>
            {/* Terms & Conditions */}
            <AccordionItem
              className="border! rounded-md bg-transparent sm:min-w-md"
              value="item-4"
            >
              <AccordionTrigger className="items-center px-5">
                <span className="flex items-center gap-2">
                  {completed.has(3) ? (
                    <CircleCheckIcon className="size-4 shrink-0" />
                  ) : (
                    <CircleDashedIcon className="size-4 shrink-0" />
                  )}
                  <span>Terms & Conditions</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-5">
                <div className="flex flex-col items-center justify-center gap-2 rounded-md bg-muted px-5 py-4">
                  <HandshakeIcon className="size-6 shrink-0" />
                  <p className="font-medium text-base">Terms & Conditions</p>
                  <p className="max-w-xs text-center text-muted-foreground text-sm">
                    Please read and accept our terms and conditions to continue.
                  </p>
                  <Dialog>
                    <DialogTrigger
                      render={
                        <Button
                          className="mt-5"
                          disabled={!completed.has(2)}
                          size="sm"
                        />
                      }
                    >
                      Terms & Conditions
                    </DialogTrigger>
                    <DialogContent className="gap-0 p-0 sm:max-h-[min(600px,80vh)] sm:max-w-md">
                      <DialogHeader className="contents space-y-0 text-left">
                        <DialogTitle className="border-b px-6 py-4">
                          Terms and Conditions
                        </DialogTitle>
                      </DialogHeader>
                      <div className="px-6 py-4 text-muted-foreground text-sm">
                        <ol className="flex list-decimal flex-col gap-2 pl-4">
                          <li>
                            <strong className="text-primary">
                              Eligibility:
                            </strong>{" "}
                            You must be at least 18 years old to use this
                            service.
                          </li>
                          <li>
                            <strong className="text-primary">
                              Account Responsibility:
                            </strong>
                            You are responsible for maintaining the
                            confidentiality of your account and password.
                          </li>
                          <li>
                            <strong className="text-primary">Usage:</strong>Do
                            not misuse or attempt to disrupt the service.
                          </li>
                          <li>
                            <strong className="text-primary">
                              Data Collection:
                            </strong>
                            We collect and use your data as described in our
                            Privacy Policy.
                          </li>
                          <li>
                            <strong className="text-primary">
                              Modifications:
                            </strong>
                            We reserve the right to update or modify these terms
                            at any time.
                          </li>
                          <li>
                            <strong className="text-primary">
                              Termination:
                            </strong>
                            We may suspend or terminate your access if you
                            violate these terms.
                          </li>
                        </ol>
                        <p className="mt-3">
                          For full details, please read our complete{" "}
                          <button
                            className="text-sky-600 hover:underline dark:text-sky-400"
                            type="button"
                          >
                            Terms & Conditions
                          </button>
                        </p>
                      </div>
                      <div className="flex justify-end gap-2 px-6 pb-4">
                        <DialogClose render={<Button variant="outline" />}>
                          Cancel
                        </DialogClose>
                        <DialogClose
                          render={
                            <Button
                              onClick={() => handleComplete(3)}
                              type="button"
                            />
                          }
                        >
                          I Agree
                        </DialogClose>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          <div className="flex justify-end gap-2">
            <Button variant="outline">Cancel</Button>
            {completed.size === TOTAL_STEPS ? (
              <Link className="max-sm:w-full" to="/">
                <Button type="submit">Continue</Button>
              </Link>
            ) : (
              <Button
                aria-disabled={completed.size !== TOTAL_STEPS}
                disabled={completed.size !== TOTAL_STEPS}
                type="submit"
              >
                <span className="opacity-60">Continue</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted shadow-none">
        <CardHeader>
          <CardTitle>Need help?</CardTitle>
          <CardDescription>
            Connect with a member of our team at{" "}
            <a
              className="text-primary hover:underline"
              href="mailto:support@company.com"
            >
              support@company.com
            </a>
            .
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

export default OnboardingFeed;
