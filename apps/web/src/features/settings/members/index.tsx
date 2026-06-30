// React Imports

// Component Imports
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@RetailOS/ui/components/avatar";
import { Button } from "@RetailOS/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@RetailOS/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@RetailOS/ui/components/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@RetailOS/ui/components/input-group";
import { Label } from "@RetailOS/ui/components/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@RetailOS/ui/components/select";
import { Separator } from "@RetailOS/ui/components/separator";
// Third-party Imports
import { EllipsisVerticalIcon, MailIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
// SVG Import
import BadgeCheck from "@/features/settings/badge-check";

import type { MembersData } from "@/features/settings/types";

interface MembersProps {
  membersData: MembersData;
}

const Members = ({ membersData }: MembersProps) => {
  const [role, setRole] = useState<string | null>("");

  const [members, setMembers] = useState(() => membersData.members);

  const [pending, setPending] = useState(() => membersData.pending);

  const removeMember = (id: number) =>
    setMembers((prev) => prev.filter((m) => m.id !== id));

  const revokeInvite = (id: string) =>
    setPending((prev) => prev.filter((p) => p.id !== id));

  return (
    <section className="py-3">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-semibold text-base">Members</h3>
          <p className="text-muted-foreground text-sm">
            Manage your team members and their permissions.
          </p>
        </div>
        <Dialog>
          <DialogTrigger render={<Button className="max-sm:w-full" />}>
            <PlusIcon />
            Invite Member
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg [&>[data-slot=dialog-close]>svg]:size-5">
            <DialogHeader>
              <div className="space-y-1">
                <DialogTitle className="m-0 text-lg">
                  Invite people to your workspace
                </DialogTitle>
                <DialogDescription className="text-sm">
                  With free plan, you can add up to 10 users to each workspace.
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="mt-4 grid grid-cols-1 gap-4">
              <div className="w-full space-y-2">
                <Label className="gap-1" htmlFor="email">
                  Email<span className="text-destructive">*</span>
                </Label>
                <InputGroup>
                  <InputGroupInput
                    id="email"
                    placeholder="Email address"
                    required
                    type="email"
                  />
                  <InputGroupAddon align="inline-end">
                    <MailIcon className="size-4" />
                    <span className="sr-only">Email</span>
                  </InputGroupAddon>
                </InputGroup>
              </div>

              <div className="w-full space-y-2">
                <Label htmlFor="invite-role">Select role</Label>
                <Select onValueChange={(val) => setRole(val)} value={role}>
                  <SelectTrigger className="w-full" id="invite-role">
                    <SelectValue placeholder="Select role..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="Contributor">Contributor</SelectItem>
                      <SelectItem value="Viewer">Viewer</SelectItem>
                      <SelectItem value="Member">Member</SelectItem>
                      <SelectItem value="No Access">No Access</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-4 sm:flex-row sm:justify-end">
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <DialogClose render={<Button />}>Add user</DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {members.map((member, idx) => {
        const isAdmin = member.role === "Admin";

        return (
          <div key={member.id}>
            <div className="flex items-center justify-between gap-3 py-1">
              <div className="flex items-center gap-3">
                <div className="relative w-fit">
                  <Avatar className="size-9.5">
                    <AvatarImage alt={member.name} src={member.avatar} />
                    <AvatarFallback>OP</AvatarFallback>
                  </Avatar>
                  {isAdmin && (
                    <span className="absolute -top-1.5 -right-1.5">
                      <span className="sr-only">Verified</span>
                      <BadgeCheck className="size-5 fill-sky-500 text-background" />
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-start max-sm:max-w-30">
                  <p className="font-medium text-sm">{member.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {member.email}
                  </p>
                </div>
              </div>

              <div
                className={
                  isAdmin
                    ? "flex cursor-not-allowed items-center gap-2 opacity-60"
                    : "flex items-center gap-2"
                }
              >
                <Select defaultValue={member.role} disabled={isAdmin}>
                  <SelectTrigger className="w-30 px-2 py-1 max-sm:w-20">
                    <SelectValue placeholder="Select a access" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="Contributor">Contributor</SelectItem>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="Viewer">Viewer</SelectItem>
                      <SelectItem value="Member">Member</SelectItem>
                      <SelectItem value="No Access">No Access</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>

                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        className="rounded-full"
                        disabled={isAdmin}
                        size="icon"
                        variant="ghost"
                      />
                    }
                  >
                    <EllipsisVerticalIcon />{" "}
                    <span className="sr-only">Edit menu</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-20">
                    <DropdownMenuGroup>
                      <DropdownMenuItem>View Details</DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive transition-colors duration-300 hover:bg-destructive/10! hover:text-destructive!"
                        onClick={() => removeMember(member.id)}
                      >
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {idx !== members.length - 1 && <Separator className="my-2" />}
          </div>
        );
      })}

      <div className="mt-10">
        <h3 className="font-medium text-base">Pending invitations</h3>
        <div className="mt-6">
          {pending.map((invite, idx) => (
            <div key={invite.id}>
              <div className="flex items-center justify-between gap-3 py-1">
                <div className="flex items-center gap-3">
                  <Avatar className="size-9.5 border border-primary border-dashed">
                    <AvatarImage src={invite.avatar} />
                    <AvatarFallback>OP</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start max-sm:max-w-30">
                    <p className="font-medium text-sm">{invite.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {invite.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select defaultValue={invite.role}>
                    <SelectTrigger className="w-30 px-2 py-1 max-sm:w-20">
                      <SelectValue placeholder="Select a access" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="Contributor">Contributor</SelectItem>
                        <SelectItem value="Admin">Admin</SelectItem>
                        <SelectItem value="Viewer">Viewer</SelectItem>
                        <SelectItem value="Member">Member</SelectItem>
                        <SelectItem value="No Access">No Access</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          className="rounded-full"
                          size="icon"
                          variant="ghost"
                        />
                      }
                    >
                      <EllipsisVerticalIcon />
                      <span className="sr-only">Edit menu</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-20">
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          className="text-destructive transition-colors duration-300 hover:bg-destructive/10! hover:text-destructive!"
                          onClick={() => revokeInvite(invite.id)}
                        >
                          Revoke
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              {idx !== pending.length - 1 && <Separator className="my-2" />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Members;
