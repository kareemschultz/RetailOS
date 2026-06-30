// React Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import { Input } from "@RetailOS/ui/components/input";
import { Label } from "@RetailOS/ui/components/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@RetailOS/ui/components/select";
// Third-party Imports
import { ImageIcon, Trash2Icon, UploadCloudIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const countries = [
  {
    value: "india",
    label: "India",
    flag: "/images/flags/india.webp",
  },
  {
    value: "china",
    label: "China",
    flag: "/images/flags/china.webp",
  },
  {
    value: "monaco",
    label: "Monaco",
    flag: "/images/flags/monaco.webp",
  },
  {
    value: "serbia",
    label: "Serbia",
    flag: "/images/flags/serbia.webp",
  },
  {
    value: "romania",
    label: "Romania",
    flag: "/images/flags/romania.webp",
  },
  {
    value: "mayotte",
    label: "Mayotte",
    flag: "/images/flags/mayotte.webp",
  },
  {
    value: "iraq",
    label: "Iraq",
    flag: "/images/flags/iraq.webp",
  },
  {
    value: "syria",
    label: "Syria",
    flag: "/images/flags/syria.webp",
  },
  {
    value: "korea",
    label: "Korea",
    flag: "/images/flags/korea.webp",
  },
  {
    value: "zimbabwe",
    label: "Zimbabwe",
    flag: "/images/flags/zimbabwe.webp",
  },
];

const PersonalInfo = () => {
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
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
      {/* Vertical Tabs List */}
      <div className="flex flex-col space-y-1">
        <h3 className="font-semibold text-base">Personal Information</h3>
        <p className="text-muted-foreground text-sm">
          Manage your personal information and role.
        </p>
      </div>

      {/* Content */}
      <div className="space-y-6 lg:col-span-2">
        <form className="mx-auto">
          <div className="mb-6 w-full space-y-2">
            <Label>Your Avatar</Label>
            <div className="flex items-center gap-4">
              <div
                aria-label="Upload your avatar"
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
                    alt="avatar preview"
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
                  type="button"
                  variant="outline"
                >
                  <UploadCloudIcon />
                  Upload avatar
                </Button>
                <Button
                  className="text-destructive!"
                  disabled={!file}
                  onClick={remove}
                  type="button"
                  variant="ghost"
                >
                  <Trash2Icon />
                </Button>
              </div>
            </div>
            <p className="text-muted-foreground text-sm">
              Pick a photo up to 1MB.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="flex flex-col items-start gap-2">
              <Label htmlFor="multi-step-personal-info-first-name">
                First Name
              </Label>
              <Input
                id="multi-step-personal-info-first-name"
                placeholder="John"
              />
            </div>
            <div className="flex flex-col items-start gap-2">
              <Label htmlFor="multi-step-personal-info-last-name">
                Last Name
              </Label>
              <Input
                id="multi-step-personal-info-last-name"
                placeholder="Doe"
              />
            </div>
            <div className="flex flex-col items-start gap-2">
              <Label htmlFor="multi-step-personal-info-mobile">Mobile</Label>
              <Input
                id="multi-step-personal-info-mobile"
                placeholder="+1 (555) 123-4567"
                type="tel"
              />
            </div>
            <div className="flex flex-col items-start gap-2">
              <Label htmlFor="country">Country</Label>
              <Select defaultValue="1" items={countries} required>
                <SelectTrigger className="w-full" id="country">
                  <SelectValue placeholder="Select Country">
                    {(value: string) => {
                      const country = countries.find((c) => c.value === value);

                      return country ? (
                        <span className="flex items-center gap-2">
                          <img
                            alt={`${country.label} flag`}
                            className="h-4 w-5 shrink-0"
                            src={country.flag}
                          />
                          <span className="truncate">{country.label}</span>
                        </span>
                      ) : (
                        <span>Select Country</span>
                      );
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-100">
                  <SelectGroup>
                    {countries.map((country) => (
                      <SelectItem key={country.value} value={country.value}>
                        <img
                          alt={`${country.label} flag`}
                          className="h-4 w-5"
                          src={country.flag}
                        />{" "}
                        <span className="truncate">{country.label}</span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select>
                <SelectTrigger className="w-full" id="gender">
                  <SelectValue placeholder="Select a gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select>
                <SelectTrigger className="w-full" id="role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </form>
        <div className="flex justify-end">
          <Button className="max-sm:w-full" type="submit">
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PersonalInfo;
