import { Button } from "@RetailOS/ui/components/button";
import { Checkbox } from "@RetailOS/ui/components/checkbox";
import { Input } from "@RetailOS/ui/components/input";
import { Label } from "@RetailOS/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

const schema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export default function SignInForm() {
  const navigate = useNavigate({ from: "/login" });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        { email: value.email, password: value.password, rememberMe },
        {
          onSuccess: () => {
            navigate({ to: "/onboarding" });
            toast.success("Welcome back");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        }
      );
    },
    validators: { onSubmit: schema },
  });

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <form.Field name="email">
        {(field) => (
          <div className="space-y-2">
            <Label className="leading-5" htmlFor={field.name}>
              Email address
            </Label>
            <Input
              autoComplete="email"
              className="h-11 rounded-lg"
              id={field.name}
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="Enter your email address"
              type="email"
              value={field.state.value}
            />
            {field.state.meta.errors.map((error) => (
              <p className="text-destructive text-xs" key={error?.message}>
                {error?.message}
              </p>
            ))}
          </div>
        )}
      </form.Field>

      <form.Field name="password">
        {(field) => (
          <div className="space-y-2">
            <Label className="leading-5" htmlFor={field.name}>
              Password
            </Label>
            <div className="relative">
              <Input
                autoComplete="current-password"
                className="h-11 rounded-lg pr-10"
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="••••••••••••"
                type={showPassword ? "text" : "password"}
                value={field.state.value}
              />
              <Button
                className="absolute inset-y-0 right-0 h-11 rounded-l-none text-muted-foreground hover:bg-transparent"
                onClick={() => setShowPassword((prev) => !prev)}
                size="icon"
                type="button"
                variant="ghost"
              >
                {showPassword ? (
                  <EyeOffIcon className="size-4" />
                ) : (
                  <EyeIcon className="size-4" />
                )}
                <span className="sr-only">
                  {showPassword ? "Hide password" : "Show password"}
                </span>
              </Button>
            </div>
            {field.state.meta.errors.map((error) => (
              <p className="text-destructive text-xs" key={error?.message}>
                {error?.message}
              </p>
            ))}
          </div>
        )}
      </form.Field>

      <div className="flex items-center justify-between gap-y-2 text-sm">
        <div className="flex items-center gap-2.5">
          <Checkbox
            checked={rememberMe}
            id="rememberMe"
            onCheckedChange={(checked) => setRememberMe(checked === true)}
          />
          <Label className="font-normal" htmlFor="rememberMe">
            Remember me
          </Label>
        </div>

        <button
          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          onClick={() =>
            toast.info(
              "Password reset is coming soon — contact your administrator."
            )
          }
          type="button"
        >
          Forgot password?
        </button>
      </div>

      <form.Subscribe
        selector={(state) => ({
          canSubmit: state.canSubmit,
          isSubmitting: state.isSubmitting,
        })}
      >
        {({ canSubmit, isSubmitting }) => (
          <Button
            className="h-11 w-full rounded-lg bg-[var(--brand)] text-[var(--brand-foreground)] shadow-sm transition hover:opacity-90"
            disabled={!canSubmit || isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Signing in…" : "Sign in to RetailOS"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
