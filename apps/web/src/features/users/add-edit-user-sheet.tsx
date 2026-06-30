// React Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@RetailOS/ui/components/field";
import { Input } from "@RetailOS/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@RetailOS/ui/components/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@RetailOS/ui/components/sheet";
// Third-party Imports
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
// Type Imports
import type {
  AppUser,
  UserFormData,
  UserPlan,
  UserRole,
  UserSheetMode,
  UserStatus,
} from "@/features/users/types";

const ROLES: UserRole[] = [
  "Admin",
  "Editor",
  "Subscriber",
  "Maintainer",
  "Guest",
];
const PLANS: UserPlan[] = ["Basic", "Team", "Enterprise"];
const STATUSES: UserStatus[] = ["Active", "Pending", "Suspended", "Inactive"];

const COUNTRIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "India",
  "Japan",
  "Brazil",
  "Netherlands",
  "Singapore",
  "Spain",
  "Italy",
  "Mexico",
  "South Korea",
];

const userFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  contact: z.string().optional(),
  company: z.string().optional(),
  country: z.string().optional(),
  role: z.enum(["Admin", "Editor", "Subscriber", "Maintainer", "Guest"]),
  plan: z.enum(["Basic", "Team", "Enterprise"]),
  status: z.enum(["Active", "Pending", "Suspended", "Inactive"]),
});

type UserFormValues = z.infer<typeof userFormSchema>;

const defaultValues: UserFormValues = {
  name: "",
  email: "",
  contact: "",
  company: "",
  country: "",
  role: "Subscriber",
  plan: "Basic",
  status: "Active",
};

export interface AddEditUserSheetProps {
  mode: UserSheetMode | null;
  onAdd: (data: UserFormData) => void;
  onClose: () => void;
  onEdit: (id: string, data: Partial<UserFormData>) => void;
  user: AppUser | null;
}

export function AddEditUserSheet({
  mode,
  user,
  onClose,
  onAdd,
  onEdit,
}: AddEditUserSheetProps) {
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (mode === "edit" && user) {
      form.reset({
        name: user.name,
        email: user.email,
        contact: user.contact ?? "",
        company: user.company ?? "",
        country: user.country ?? "",
        role: user.role,
        plan: user.plan,
        status: user.status,
      });

      return;
    }

    if (mode === "add") {
      form.reset(defaultValues);
    }
  }, [form, mode, user]);

  const handleSubmit = (values: UserFormValues) => {
    const data: UserFormData = {
      name: values.name,
      email: values.email,
      contact: values.contact || undefined,
      company: values.company || undefined,
      country: values.country || undefined,
      role: values.role,
      plan: values.plan,
      status: values.status,
    };

    if (mode === "add") {
      onAdd(data);
    }

    if (mode === "edit" && user) {
      onEdit(user.id, data);
    }
  };

  return (
    <Sheet onOpenChange={(open) => !open && onClose()} open={mode !== null}>
      <SheetContent
        className="w-full overflow-y-auto sm:max-w-[420px]"
        side="right"
      >
        <SheetHeader className="pb-0">
          <SheetTitle className="font-medium text-lg">
            {mode === "edit" ? "Edit User" : "Add New User"}
          </SheetTitle>
        </SheetHeader>

        <form
          className="flex flex-col gap-4 px-4 pb-4"
          onSubmit={form.handleSubmit(handleSubmit)}
        >
          <FieldGroup className="gap-4">
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field className="gap-2" data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                  <Input
                    {...field}
                    aria-invalid={fieldState.invalid}
                    id={field.name}
                    placeholder="Full name"
                  />
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="email"
              render={({ field, fieldState }) => (
                <Field className="gap-2" data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                  <Input
                    {...field}
                    aria-invalid={fieldState.invalid}
                    id={field.name}
                    placeholder="name@example.com"
                    type="email"
                  />
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="contact"
              render={({ field, fieldState }) => (
                <Field className="gap-2" data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Contact</FieldLabel>
                  <Input
                    {...field}
                    aria-invalid={fieldState.invalid}
                    id={field.name}
                    placeholder="+1 (555) 000-0000"
                    type="tel"
                  />
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="company"
              render={({ field, fieldState }) => (
                <Field className="gap-2" data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Company</FieldLabel>
                  <Input
                    {...field}
                    aria-invalid={fieldState.invalid}
                    id={field.name}
                    placeholder="Company name"
                  />
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="country"
              render={({ field, fieldState }) => (
                <Field className="gap-2" data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="country">Country</FieldLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="w-full" id="country">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country} value={country}>
                            {country}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="role"
              render={({ field, fieldState }) => (
                <Field className="gap-2" data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="role">Role</FieldLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="w-full" id="role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="plan"
              render={({ field, fieldState }) => (
                <Field className="gap-2" data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="plan">Plan</FieldLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="w-full" id="plan">
                      <SelectValue placeholder="Select plan" />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {PLANS.map((plan) => (
                          <SelectItem key={plan} value={plan}>
                            {plan}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="status"
              render={({ field, fieldState }) => (
                <Field className="gap-2" data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="status">Status</FieldLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="w-full" id="status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />
          </FieldGroup>

          <SheetFooter className="px-0 sm:flex-row">
            <Button
              className="sm:flex-1"
              onClick={onClose}
              type="submit"
              variant="outline"
            >
              Cancel
            </Button>
            <Button className="sm:flex-1" type="submit">
              {mode === "edit" ? "Save Changes" : "Add User"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
