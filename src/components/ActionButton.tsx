import { Button } from "@shadcn/ui/button";
import { LucideIcon } from "lucide-react";
import { PropsWithChildren } from "react";

interface ActionButtonProps {
  icon?: LucideIcon;
  type?: "button" | "submit" | "reset";
  variant?: "default" | "outline" | "secondary" | "ghost" | "link";
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export const ActionButton = ({
  children,
  icon: Icon,
  type = "button",
  variant = "default",
  className,
  onClick,
}: PropsWithChildren<ActionButtonProps>) => {
  return (
    <Button type={type} variant={variant} className={className} onClick={onClick}>
      {Icon && <Icon className="h-4 w-4 mr-2" />}
      {children}
    </Button>
  );
};
