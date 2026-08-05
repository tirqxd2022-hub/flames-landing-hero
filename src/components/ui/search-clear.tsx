import { X } from "lucide-react";

export function SearchClearButton({
  show,
  onClear,
  className = "",
}: {
  show: boolean;
  onClear: () => void;
  className?: string;
}) {
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label="Clear search"
      className={
        "absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-white " +
        className
      }
    >
      <X className="h-4 w-4" />
    </button>
  );
}
