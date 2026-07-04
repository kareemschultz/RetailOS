import { Button } from "@RetailOS/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@RetailOS/ui/components/dropdown-menu";
import { Monitor, Moon, Sun } from "lucide-react";

import { useSettings } from "@/theme/settings-store";

// Light/dark/system toggle. Icon-only trigger needs an accessible label.
// Color mode has ONE owner: the settings store (settings.mode), which
// propagates to next-themes. Calling next-themes setTheme directly here
// fights the store's effect (setTheme's identity changes per theme change,
// re-firing the store's sync effect and reverting the choice within a frame).
export function ModeToggle() {
  const { updateSettings } = useSettings();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button aria-label="Toggle color theme" size="icon" variant="ghost" />
        }
      >
        <Sun className="size-5 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute size-5 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => updateSettings({ mode: "light" })}>
            <Sun className="size-4" />
            Light
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => updateSettings({ mode: "dark" })}>
            <Moon className="size-4" />
            Dark
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => updateSettings({ mode: "system" })}>
            <Monitor className="size-4" />
            System
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
