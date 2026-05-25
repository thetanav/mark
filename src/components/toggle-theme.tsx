import { Moon } from "lucide-react";
import { toggleTheme } from "@/actions/theme";
import { Button } from "@/components/ui/button";

export default function ToggleTheme() {
  return (
    <Button
      aria-label="Toggle theme"
      onClick={toggleTheme}
      size="icon"
      title="Toggle theme"
    >
      <Moon size={16} />
    </Button>
  );
}
