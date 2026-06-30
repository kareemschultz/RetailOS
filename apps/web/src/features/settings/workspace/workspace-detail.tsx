// React Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import { Input } from "@RetailOS/ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@RetailOS/ui/components/input-group";
import { Label } from "@RetailOS/ui/components/label";
import { Textarea } from "@RetailOS/ui/components/textarea";
// Third-party Imports
import { ImageIcon, TrashIcon, UploadCloudIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const WorkspaceDetail = () => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      const t = window.setTimeout(() => setPreview(null), 0);

      return () => clearTimeout(t);
    }

    const url = URL.createObjectURL(file);

    const t = window.setTimeout(() => setPreview(url), 0);

    return () => {
      clearTimeout(t);
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];

    if (!f) {
      return;
    }

    if (!f.type.startsWith("image/")) {
      window.alert("Please select an image file");
      e.currentTarget.value = "";

      return;
    }

    if (f.size > 1024 * 1024) {
      window.alert("File must be smaller than 1MB");
      e.currentTarget.value = "";

      return;
    }

    setFile(f);
  };

  const openPicker = () => inputRef.current?.click();

  const remove = () => {
    setFile(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
        {/* Workspace Detail */}
        <div className="flex flex-col space-y-1">
          <h3 className="font-semibold text-base">Workspace Detail</h3>
          <p className="text-muted-foreground text-sm">
            Manage your workspace details and settings.
          </p>
        </div>
        {/* Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Workspace logo */}
          <div className="w-full space-y-2">
            <Label>Workspace Logo</Label>
            <div className="flex items-center gap-4">
              <div
                aria-label="Upload workspace logo"
                className="flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed hover:opacity-95"
                onClick={openPicker}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openPicker();
                  }
                }}
                role="button"
                tabIndex={0}
              >
                {preview ? (
                  <img
                    alt="logo preview"
                    className="h-full w-full object-cover"
                    src={preview}
                  />
                ) : (
                  <ImageIcon />
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  accept="image/*"
                  className="hidden"
                  onChange={onSelect}
                  ref={inputRef}
                  type="file"
                />
                <Button
                  className="flex items-center gap-2"
                  onClick={openPicker}
                  variant="outline"
                >
                  <UploadCloudIcon />
                  Upload logo
                </Button>
                <Button
                  className="text-destructive"
                  disabled={!file}
                  onClick={remove}
                  variant="ghost"
                >
                  <TrashIcon />
                </Button>
              </div>
            </div>
            <p className="text-muted-foreground text-sm">
              Pick a photo up to 1MB.
            </p>
          </div>
          {/* Workspace URl */}
          <div className="w-full space-y-2">
            <Label htmlFor="workspace-url">Workspace URL</Label>
            <InputGroup>
              <InputGroupAddon className="font-normal text-foreground">
                https://example.com/
              </InputGroupAddon>
              <InputGroupInput id="workspace-url" placeholder="shadcnstudio" />
              <InputGroupAddon
                align="inline-end"
                className="font-normal text-foreground"
              >
                .com
              </InputGroupAddon>
            </InputGroup>
          </div>
          {/* Workspace slug */}
          <div className="w-full space-y-2">
            <Label htmlFor="workspace-slug">Workspace Slug</Label>
            <Input
              id="workspace-slug"
              placeholder="shadcn-studio"
              type="text"
            />
            <p className="text-muted-foreground text-xs">
              Only lowercase letters, numbers, and hyphens. Max 48 Characters
            </p>
          </div>
          {/* Workspace Description */}
          <div className="w-full space-y-2">
            <Label htmlFor="workspace-description">Workspace Description</Label>
            <Textarea
              id="workspace-description"
              placeholder="Type your feedback here"
            />
          </div>
          <div className="flex justify-end">
            <Button className="max-sm:w-full" type="submit">
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceDetail;
