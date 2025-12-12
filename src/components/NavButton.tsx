import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavButtonProps {
  to: string;
  children: React.ReactNode;
}

export function NavButton({ to, children }: NavButtonProps) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link to={to}>
      <Button
        variant={isActive ? "default" : "ghost"}
        size="sm"
        className={cn(
          "transition-all",
          isActive && "shadow-md"
        )}
      >
        {children}
      </Button>
    </Link>
  );
}
