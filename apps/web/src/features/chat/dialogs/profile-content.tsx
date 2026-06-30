// React Imports

// Component Imports
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@RetailOS/ui/components/avatar";
import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import { Input } from "@RetailOS/ui/components/input";
import { Label } from "@RetailOS/ui/components/label";
import { Separator } from "@RetailOS/ui/components/separator";
import { Textarea } from "@RetailOS/ui/components/textarea";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
// Third-party Imports
import {
  Building2Icon,
  GlobeIcon,
  LinkIcon,
  MailIcon,
  MapPinIcon,
  MonitorIcon,
  PhoneIcon,
  TagIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
// Type Imports
import type {
  ChatUser,
  ChatUserStatus,
  Conversation,
  OwnProfileFormState,
  OwnProfileUpdate,
} from "@/features/chat/types";
// Config Imports
import { getInitialsFromName } from "@/features/chat/utils";

export interface ProfileContentProps {
  contactConversation: Conversation | null;
  isOwnProfile: boolean;
  onBlockContact: (contactId: string) => void;
  onClearChat: (conversationId: string) => void;
  onClose: () => void;
  onDeleteContact: (contactId: string) => void;
  onFavouriteConversation: (id: string) => void;
  onMuteConversation: (id: string) => void;
  onPinConversation: (id: string) => void;
  onUpdateOwnProfile: (updates: OwnProfileUpdate) => void;
  user: ChatUser;
}

const STATUS_DOT_CLASSES: Record<ChatUserStatus, string> = {
  online: "bg-green-500",
  away: "bg-yellow-500",
  busy: "bg-red-500",
  offline: "bg-muted-foreground",
};

const STATUS_OPTIONS: ChatUserStatus[] = ["online", "away", "busy", "offline"];

const buildOwnProfileForm = (user: ChatUser): OwnProfileFormState => ({
  name: user.name,
  role: user.role ?? "",
  avatar: user.avatar ?? "",
  status: user.status,
  about: user.about ?? "",
  email: user.email ?? "",
  phone: user.phone ?? "",
  company: user.company ?? "",
  country: user.country ?? "",
  website: user.website ?? "",
  timezone: user.timezone ?? "",
  location: user.location ?? "",
  availability: user.availability ?? "",
});

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const DetailRow = (props: DetailRowProps) => {
  // Props
  const { icon, label, value } = props;

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="shrink-0 text-muted-foreground text-sm">{label}</span>
      <span className="ml-auto truncate text-sm">{value}</span>
    </div>
  );
};

interface FieldEditorProps {
  label: string;
  multiline?: boolean;
  onChange: (value: string) => void;
  value: string;
}

const FieldEditor = (props: FieldEditorProps) => {
  // Props
  const { label, value, multiline, onChange } = props;

  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      {multiline ? (
        <Textarea
          className="resize-none text-sm"
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          value={value}
        />
      ) : (
        <Input
          className="text-sm"
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      )}
    </div>
  );
};

const ProfileContent = (props: ProfileContentProps) => {
  // Props
  const {
    user,
    onClose,
    isOwnProfile,
    contactConversation,
    onMuteConversation,
    onPinConversation,
    onFavouriteConversation,
    onClearChat,
    onBlockContact,
    onDeleteContact,
    onUpdateOwnProfile,
  } = props;

  // States
  const [form, setForm] = useState<OwnProfileFormState>(() =>
    buildOwnProfileForm(user)
  );

  useEffect(() => {
    setTimeout(() => {
      setForm(buildOwnProfileForm(user));
    }, 0);
  }, [user]);

  const handleSaveOwnProfile = () => {
    const updates: OwnProfileUpdate = {
      name: form.name.trim(),
      role: form.role.trim() || undefined,
      avatar: form.avatar.trim() || undefined,
      status: form.status,
      about: form.about.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      company: form.company.trim() || undefined,
      country: form.country.trim() || undefined,
      website: form.website.trim() || undefined,
      timezone: form.timezone.trim() || undefined,
      location: form.location.trim() || undefined,
      availability: form.availability.trim() || undefined,
    };

    onUpdateOwnProfile(updates);
    toast.success("Profile updated.");
  };

  const updateField = <K extends keyof OwnProfileFormState>(
    key: K,
    value: OwnProfileFormState[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  // Vars
  const displayUser = isOwnProfile
    ? { ...user, ...form, avatar: form.avatar || user.avatar }
    : user;

  return (
    <div className="relative h-full min-h-0 overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-start gap-3 bg-background px-4 py-4">
        <div className="relative shrink-0">
          <Avatar size="lg">
            <AvatarImage alt={displayUser.name} src={displayUser.avatar} />
            <AvatarFallback>
              {getInitialsFromName(displayUser.name)}
            </AvatarFallback>
          </Avatar>
          <span
            className={cn(
              "absolute right-0 bottom-0 size-2.5 rounded-full ring-2 ring-background",
              STATUS_DOT_CLASSES[isOwnProfile ? form.status : user.status]
            )}
          />
        </div>

        <div className="min-w-0 flex-1">
          {isOwnProfile ? (
            <>
              <Input
                className="h-auto truncate rounded-none border-none p-0 font-medium leading-5 shadow-none ring-0 focus-visible:ring-0"
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Name"
                value={form.name}
              />
              <p className="truncate text-muted-foreground text-xs">Admin</p>
            </>
          ) : (
            <>
              <p className="truncate font-medium leading-5">{user.name}</p>
              <p className="truncate text-muted-foreground text-xs">
                {user.role ?? "Contact"}
              </p>
            </>
          )}
        </div>

        <Button
          aria-label="Close profile"
          onClick={onClose}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <XIcon className="size-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-4 px-4 pb-4">
        {!isOwnProfile && (user.email || user.phone || user.website) && (
          <div className="flex gap-2">
            {user.email && (
              <Button
                aria-label="Email"
                nativeButton={false}
                render={<a href={`mailto:${user.email}`} />}
                size="icon-sm"
                variant="ghost"
              >
                <MailIcon className="size-3.5" />
              </Button>
            )}
            {user.phone && (
              <Button
                aria-label="Call"
                nativeButton={false}
                render={<a href={`tel:${user.phone.replace(/\s/g, "")}`} />}
                size="icon-sm"
                variant="ghost"
              >
                <PhoneIcon className="size-3.5" />
              </Button>
            )}
            {user.website && (
              <Button
                aria-label="Website"
                nativeButton={false}
                render={
                  <a
                    href={user.website}
                    rel="noopener noreferrer"
                    target="_blank"
                  />
                }
                size="icon-sm"
              >
                <LinkIcon className="size-3.5" />
              </Button>
            )}
          </div>
        )}
        {user.about && !isOwnProfile && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {user.about}
          </p>
        )}
        {isOwnProfile ? (
          <div className="space-y-3">
            <FieldEditor
              label="Avatar URL"
              onChange={(value) => updateField("avatar", value)}
              value={form.avatar}
            />
            <FieldEditor
              label="About"
              multiline
              onChange={(value) => updateField("about", value)}
              value={form.about}
            />
            <FieldEditor
              label="Email"
              onChange={(value) => updateField("email", value)}
              value={form.email}
            />
            <FieldEditor
              label="Phone"
              onChange={(value) => updateField("phone", value)}
              value={form.phone}
            />
            <FieldEditor
              label="Company"
              onChange={(value) => updateField("company", value)}
              value={form.company}
            />
            <FieldEditor
              label="Country"
              onChange={(value) => updateField("country", value)}
              value={form.country}
            />
            <FieldEditor
              label="Website"
              onChange={(value) => updateField("website", value)}
              value={form.website}
            />
            <FieldEditor
              label="Location"
              onChange={(value) => updateField("location", value)}
              value={form.location}
            />
            <FieldEditor
              label="Timezone"
              onChange={(value) => updateField("timezone", value)}
              value={form.timezone}
            />
            <FieldEditor
              label="Availability"
              onChange={(value) => updateField("availability", value)}
              value={form.availability}
            />
            <Separator />
            <div className="space-y-2">
              <p className="font-medium text-muted-foreground text-xs">
                Status
              </p>
              <div className="grid grid-cols-2 gap-2">
                {STATUS_OPTIONS.map((status) => (
                  <button
                    className={cn(
                      "rounded-lg border px-2 py-2 font-medium text-xs capitalize transition-colors",
                      form.status === status
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                    key={status}
                    onClick={() => updateField("status", status)}
                    type="button"
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          STATUS_DOT_CLASSES[status]
                        )}
                      />
                      {status}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <Button
              className="w-full"
              onClick={handleSaveOwnProfile}
              type="button"
            >
              Save changes
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {user.email && (
                <DetailRow
                  icon={<MailIcon className="size-4" />}
                  label="Email"
                  value={user.email}
                />
              )}
              {user.phone && (
                <DetailRow
                  icon={<PhoneIcon className="size-4" />}
                  label="Phone"
                  value={user.phone}
                />
              )}
              {user.website && (
                <DetailRow
                  icon={<GlobeIcon className="size-4" />}
                  label="Website"
                  value={user.website}
                />
              )}
            </div>
            {(user.company || user.country || user.timezone) && (
              <>
                <Separator />
                <div className="flex flex-col gap-3">
                  {user.company && (
                    <DetailRow
                      icon={<Building2Icon className="size-4" />}
                      label="Company"
                      value={user.company}
                    />
                  )}
                  {user.country && (
                    <DetailRow
                      icon={<GlobeIcon className="size-4" />}
                      label="Country"
                      value={user.country}
                    />
                  )}
                  {user.timezone && (
                    <DetailRow
                      icon={<MonitorIcon className="size-4" />}
                      label="Timezone"
                      value={user.timezone}
                    />
                  )}
                </div>
              </>
            )}
            {(user.location || user.availability) && (
              <>
                <Separator />
                <div className="flex flex-col gap-3">
                  {user.location && (
                    <DetailRow
                      icon={<MapPinIcon className="size-4" />}
                      label="Location"
                      value={user.location}
                    />
                  )}
                  {user.availability && (
                    <DetailRow
                      icon={<MonitorIcon className="size-4" />}
                      label="Availability"
                      value={user.availability}
                    />
                  )}
                </div>
              </>
            )}
            {user.tags && user.tags.length > 0 && (
              <>
                <Separator />
                <div className="flex items-start gap-2 text-sm">
                  <TagIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="shrink-0 text-muted-foreground text-sm">
                    Tags
                  </span>
                  <div className="ml-auto flex flex-wrap justify-end gap-1">
                    {user.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
            {contactConversation && (
              <>
                <Separator />
                <div className="flex flex-col gap-2">
                  <Button
                    className="w-full justify-start"
                    onClick={() => onMuteConversation(contactConversation.id)}
                    type="button"
                    variant="outline"
                  >
                    {contactConversation.isMuted
                      ? "Unmute notifications"
                      : "Mute notifications"}
                  </Button>
                  <Button
                    className="w-full justify-start"
                    onClick={() => onPinConversation(contactConversation.id)}
                    type="button"
                    variant="outline"
                  >
                    {contactConversation.isPinned
                      ? "Unpin conversation"
                      : "Pin to top"}
                  </Button>
                  <Button
                    className="w-full justify-start"
                    onClick={() =>
                      onFavouriteConversation(contactConversation.id)
                    }
                    type="button"
                    variant="outline"
                  >
                    {contactConversation.isFavourite
                      ? "Remove from favourites"
                      : "Add to favourites"}
                  </Button>
                  <Button
                    className="w-full justify-start"
                    onClick={() => onClearChat(contactConversation.id)}
                    type="button"
                    variant="outline"
                  >
                    Clear chat
                  </Button>
                  <Button
                    className="w-full justify-start"
                    onClick={() => onBlockContact(user.id)}
                    type="button"
                    variant="outline"
                  >
                    {user.isBlocked ? "Unblock contact" : "Block contact"}
                  </Button>
                </div>
              </>
            )}
            <div className="mt-auto pt-2">
              <Button
                className="w-full gap-2"
                onClick={() => {
                  onDeleteContact(user.id);
                  onClose();
                }}
                type="button"
                variant="destructive"
              >
                <Trash2Icon className="size-4" />
                Delete contact
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProfileContent;
