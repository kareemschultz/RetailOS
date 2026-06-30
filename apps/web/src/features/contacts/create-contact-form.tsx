// Third-party imports

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@RetailOS/ui/components/avatar";
import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import { Input } from "@RetailOS/ui/components/input";
import { Label } from "@RetailOS/ui/components/label";
import { ScrollArea } from "@RetailOS/ui/components/scroll-area";
import { Separator } from "@RetailOS/ui/components/separator";
import { Textarea } from "@RetailOS/ui/components/textarea";
// Hook imports
import { useFileUpload } from "@RetailOS/ui/hooks/use-file-upload";
import { cn } from "@RetailOS/ui/lib/utils";
import {
  CalendarIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  UserRoundPlusIcon,
  XIcon,
} from "lucide-react";
// React imports
import { useEffect, useState } from "react";

// Store imports
import { useContactStore } from "@/features/contacts/store";
// Type imports
import type {
  Label as ContactLabel,
  CreateContactInput,
} from "@/features/contacts/types";
// Utils imports
import {
  fileToDataUrl,
  sanitizePhoneInput,
  validateEmail,
  validatePhoneNumber,
} from "@/features/contacts/utils";

const labelOptions: ContactLabel[] = [
  "lead",
  "partner",
  "customer",
  "vip",
  "wholesale",
  "supplier",
];

const emptyForm: CreateContactInput = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  city: "",
  notes: "",
  labels: [],
};

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const CreateContactForm = () => {
  const closeCreateContact = useContactStore(
    (state) => state.closeCreateContact
  );
  const addContact = useContactStore((state) => state.addContact);

  const [form, setForm] = useState<CreateContactInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [
    { files, errors: uploadErrors, isDragging },
    { openFileDialog, getInputProps, clearFiles },
  ] = useFileUpload({
    accept: "image/*",
    maxSize: MAX_AVATAR_BYTES,
    multiple: false,
    maxFiles: 1,
  });

  const uploadedAvatar = files[0]?.preview;
  const hasImage = !!uploadedAvatar;

  const handleRemoveImage = () => {
    clearFiles();
  };

  useEffect(() => () => clearFiles(), [clearFiles]);

  const updateField = <K extends keyof CreateContactInput>(
    key: K,
    value: CreateContactInput[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);

    if (key === "phone") {
      setPhoneError(null);
    }

    if (key === "email") {
      setEmailError(null);
    }
  };

  const updatePhone = (value: string) => {
    updateField("phone", sanitizePhoneInput(value));
  };

  const toggleLabel = (label: ContactLabel) => {
    setForm((current) => ({
      ...current,
      labels: current.labels.includes(label)
        ? current.labels.filter((item) => item !== label)
        : [...current.labels, label],
    }));
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    setError(null);
    setPhoneError(null);
    setEmailError(null);

    const phoneValidationError = validatePhoneNumber(form.phone);
    const emailValidationError = validateEmail(form.email);

    if (phoneValidationError) {
      setPhoneError(phoneValidationError);
      setIsSaving(false);

      return;
    }

    if (emailValidationError) {
      setEmailError(emailValidationError);
      setIsSaving(false);

      return;
    }

    if (!(form.firstName.trim() && form.lastName.trim())) {
      setError("First name and last name are required.");
      setIsSaving(false);

      return;
    }

    try {
      const uploadedFile = files[0]?.file;
      let image: string | undefined;

      if (uploadedFile instanceof File) {
        image = await fileToDataUrl(uploadedFile);
      }

      const result = addContact({
        ...form,
        image,
      });

      if (!result) {
        setError("This phone number is already in use.");

        return;
      }

      clearFiles();
      setForm(emptyForm);
    } catch {
      setError("Failed to read the uploaded image.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="relative flex h-60 shrink-0 items-center justify-center gap-2 p-4">
        <img
          alt="Contact Details Background"
          className="absolute top-0 left-0 h-full w-full object-cover dark:invert"
          src="/images/contacts/contact-details-bg.webp"
        />
        <Button
          className="absolute top-4 left-4 z-1 rounded-full"
          onClick={closeCreateContact}
          size="icon-xs"
          variant="outline"
        >
          <XIcon />
        </Button>
        <div className="flex items-center gap-2">
          <div className="relative shrink-0">
            <button
              aria-label="Upload contact avatar"
              className={cn(
                "group relative shrink-0 overflow-hidden rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isDragging && "ring-2 ring-primary ring-offset-2"
              )}
              onClick={openFileDialog}
              type="button"
            >
              <Avatar className="size-25 rounded-full after:border-primary/20">
                {uploadedAvatar && (
                  <AvatarImage alt="New contact avatar" src={uploadedAvatar} />
                )}
                <AvatarFallback className="bg-muted">
                  <UserRoundPlusIcon className="size-8 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              <span className="absolute right-0 bottom-0 left-0 rounded-b-full bg-black/40 py-0.75 text-center font-medium text-white text-xs">
                {hasImage ? "Edit" : "Add"}
              </span>
            </button>
            {hasImage && (
              <Button
                aria-label="Remove avatar"
                className="absolute top-1 right-1 z-1 size-5 rounded-full bg-black/60 text-white hover:bg-black"
                onClick={handleRemoveImage}
                size="icon-xs"
                type="button"
              >
                <XIcon className="text-white" />
              </Button>
            )}
          </div>
          <input
            {...getInputProps({ className: "sr-only", "aria-hidden": true })}
          />
          <div className="z-1 flex w-full max-w-56 flex-col gap-2">
            <Input
              className="bg-background/90"
              onChange={(event) => updateField("firstName", event.target.value)}
              placeholder="First name"
              value={form.firstName}
            />
            <Input
              className="bg-background/90"
              onChange={(event) => updateField("lastName", event.target.value)}
              placeholder="Last name"
              value={form.lastName}
            />
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex h-full flex-col justify-between gap-4 px-4">
          <div className="flex flex-col gap-4">
            {error && <p className="text-destructive text-sm">{error}</p>}
            {uploadErrors.map((uploadError) => (
              <p className="text-destructive text-sm" key={uploadError}>
                {uploadError}
              </p>
            ))}

            <div className="flex flex-col gap-3">
              <h3 className="font-semibold">Contact Info</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label
                    className="text-muted-foreground text-xs"
                    htmlFor="contact-phone"
                  >
                    Phone
                  </Label>
                  <div className="flex items-center gap-2 rounded-md bg-muted px-2 py-1.5">
                    <PhoneIcon className="size-4 shrink-0 text-muted-foreground" />
                    <Input
                      aria-invalid={!!phoneError}
                      className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
                      id="contact-phone"
                      inputMode="numeric"
                      maxLength={10}
                      onChange={(event) => updatePhone(event.target.value)}
                      placeholder="Phone number"
                      value={form.phone}
                    />
                  </div>
                  {phoneError && (
                    <p className="text-destructive text-xs">{phoneError}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label
                    className="text-muted-foreground text-xs"
                    htmlFor="contact-email"
                  >
                    Email
                  </Label>
                  <div className="flex items-center gap-2 rounded-md bg-muted px-2 py-1.5">
                    <MailIcon className="size-4 shrink-0 text-muted-foreground" />
                    <Input
                      aria-invalid={!!emailError}
                      className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
                      id="contact-email"
                      onChange={(event) =>
                        updateField("email", event.target.value)
                      }
                      placeholder="Email address"
                      type="email"
                      value={form.email}
                    />
                  </div>
                  {emailError && (
                    <p className="text-destructive text-xs">{emailError}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label
                    className="text-muted-foreground text-xs"
                    htmlFor="contact-city"
                  >
                    City
                  </Label>
                  <div className="flex items-center gap-2 rounded-md bg-muted px-2 py-1.5">
                    <MapPinIcon className="size-4 shrink-0 text-muted-foreground" />
                    <Input
                      className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
                      id="contact-city"
                      onChange={(event) =>
                        updateField("city", event.target.value)
                      }
                      placeholder="City"
                      value={form.city}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-muted-foreground text-xs">
                    Added on
                  </Label>
                  <div className="flex items-center gap-2 rounded-md bg-muted px-2 py-3 text-muted-foreground text-sm">
                    <CalendarIcon className="size-4" />
                    <span>
                      {new Date().toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-3">
              <h3 className="font-semibold">Note</h3>
              <Textarea
                className="min-h-24 resize-none bg-muted"
                onChange={(event) => updateField("notes", event.target.value)}
                placeholder="Add a note"
                value={form.notes}
              />
            </div>

            <Separator />

            <div className="flex flex-col gap-3">
              <h3 className="font-semibold">Labels</h3>
              <div className="flex flex-wrap gap-2">
                {labelOptions.map((label) => (
                  <Badge
                    className={cn(
                      "cursor-pointer capitalize",
                      form.labels.includes(label) &&
                        "border-primary bg-primary/10 text-primary"
                    )}
                    key={label}
                    onClick={() => toggleLabel(label)}
                    variant="outline"
                  >
                    {label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pb-4">
            <Button
              className="w-fit"
              disabled={isSaving}
              onClick={closeCreateContact}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              className="w-fit"
              disabled={isSaving}
              onClick={handleSubmit}
            >
              {isSaving ? "Saving..." : "Save Contact"}
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default CreateContactForm;
