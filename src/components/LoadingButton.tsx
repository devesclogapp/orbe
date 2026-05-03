import { useState } from "react";
import { Button } from "@shadcn/ui/button";
import { LucideLoader2 } from "lucide-react";

interface LoadingButtonProps {
  onClick: () => Promise<void>;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const LoadingButton = ({ onClick, disabled = false, children, className }: LoadingButtonProps) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await onClick();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="submit"
      disabled={disabled || loading}
      className={className}
      onClick={handleClick}
    >
      {loading && <LucideLoader2 className="h-4 w-4 mr-2 animate-spin" />}
      {children}
    </Button>
  );
};
