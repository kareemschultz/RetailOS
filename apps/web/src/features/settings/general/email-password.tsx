// React Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@RetailOS/ui/components/input-group";
import { Label } from "@RetailOS/ui/components/label";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
// Third-party Imports
import { CheckIcon, EyeIcon, EyeOffIcon, MailIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";

const requirements = [
  { regex: /.{12,}/, text: "At least 12 characters" },
  { regex: /[a-z]/, text: "At least 1 lowercase letter" },
  { regex: /[A-Z]/, text: "At least 1 uppercase letter" },
  { regex: /[0-9]/, text: "At least 1 number" },
  {
    regex: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
    text: "At least 1 special character",
  },
];

const EmailPass = () => {
  const [isVisible, setIsVisible] = useState(false);

  const [password, setPassword] = useState("");

  const toggleVisibility = () => setIsVisible((prevState) => !prevState);

  const strength = requirements.map((req) => ({
    met: req.regex.test(password),
    text: req.text,
  }));

  const strengthScore = useMemo(
    () => strength.filter((req) => req.met).length,
    [strength]
  );

  const getColor = (score: number) => {
    if (score === 0) {
      return "bg-border";
    }
    if (score <= 1) {
      return "bg-destructive";
    }
    if (score <= 2) {
      return "bg-orange-500 ";
    }
    if (score <= 3) {
      return "bg-amber-500";
    }
    if (score === 4) {
      return "bg-yellow-400";
    }

    return "bg-green-500";
  };

  const getText = (score: number) => {
    if (score === 0) {
      return "Enter a password";
    }
    if (score <= 2) {
      return "Weak password";
    }
    if (score <= 3) {
      return "Medium password";
    }
    if (score === 4) {
      return "Strong password";
    }

    return "Very strong password";
  };

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
      {/* Vertical Tabs List */}
      <div className="flex flex-col space-y-1">
        <h3 className="font-semibold text-base">Email & Password</h3>
        <p className="text-muted-foreground text-sm">
          Manage your email and password settings.
        </p>
      </div>

      {/* Content */}
      <div className="lg:col-span-2">
        <form className="mx-auto space-y-6">
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
              <InputGroupAddon align="inline-end" className="pr-2.75">
                <MailIcon className="size-4" />
                <span className="sr-only">Email</span>
              </InputGroupAddon>
            </InputGroup>
          </div>
          <div className="w-full space-y-2">
            <Label className="gap-1" htmlFor="current-password">
              Current Password<span className="text-destructive">*</span>
            </Label>
            <InputGroup>
              <InputGroupInput
                id="current-password"
                placeholder="Password"
                required
                type={isVisible ? "text" : "password"}
              />
              <InputGroupAddon align="inline-end" className="pr-1.5">
                <Button
                  className="rounded-l-none text-muted-foreground hover:bg-transparent focus-visible:ring-ring/50"
                  onClick={() => setIsVisible((prevState) => !prevState)}
                  size="icon"
                  variant="ghost"
                >
                  {isVisible ? <EyeOffIcon /> : <EyeIcon />}
                  <span className="sr-only">
                    {isVisible ? "Hide password" : "Show password"}
                  </span>
                </Button>
              </InputGroupAddon>
            </InputGroup>
          </div>
          <div className="w-full space-y-2">
            <Label className="gap-1" htmlFor="new-password">
              New Password<span className="text-destructive">*</span>
            </Label>
            <InputGroup className="mb-3">
              <InputGroupInput
                id="new-password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                type={isVisible ? "text" : "password"}
                value={password}
              />
              <InputGroupAddon align="inline-end" className="pr-1.5">
                <Button
                  className="rounded-l-none text-muted-foreground hover:bg-transparent focus-visible:ring-ring/50"
                  onClick={toggleVisibility}
                  size="icon"
                  variant="ghost"
                >
                  {isVisible ? <EyeOffIcon /> : <EyeIcon />}
                  <span className="sr-only">
                    {isVisible ? "Hide password" : "Show password"}
                  </span>
                </Button>
              </InputGroupAddon>
            </InputGroup>

            <div className="mb-4 flex h-1 w-full gap-1">
              {Array.from({ length: 5 }).map((_, index) => (
                <span
                  className={cn(
                    "h-full flex-1 rounded-full transition-all duration-500 ease-out",
                    index < strengthScore
                      ? getColor(strengthScore)
                      : "bg-border"
                  )}
                  key={index}
                />
              ))}
            </div>

            <p className="font-medium text-foreground text-sm">
              {getText(strengthScore)}. Must contain :
            </p>

            <ul className="mb-4 space-y-1.5">
              {strength.map((req, index) => (
                <li className="flex items-center gap-2" key={index}>
                  {req.met ? (
                    <CheckIcon className="size-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <XIcon className="size-4 text-muted-foreground" />
                  )}
                  <span
                    className={cn(
                      "text-xs",
                      req.met
                        ? "text-green-600 dark:text-green-400"
                        : "text-muted-foreground"
                    )}
                  >
                    {req.text}
                    <span className="sr-only">
                      {req.met
                        ? " - Requirement met"
                        : " - Requirement not met"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 flex justify-end">
            <Button className="max-sm:w-full" type="submit">
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmailPass;
