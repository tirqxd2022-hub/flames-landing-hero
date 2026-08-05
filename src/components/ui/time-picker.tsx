import { useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Props = {
  value: string; // "HH:MM" 24h
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
};

function parse(value: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value || "");
  if (!m) return { h12: 12, min: 0, ampm: "AM" as "AM" | "PM" };
  const h = Math.max(0, Math.min(23, parseInt(m[1], 10)));
  const min = Math.max(0, Math.min(59, parseInt(m[2], 10)));
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return { h12, min, ampm };
}

function format12(h12: number, min: number, ampm: "AM" | "PM") {
  return `${h12}:${String(min).padStart(2, "0")} ${ampm}`;
}

function to24(h12: number, min: number, ampm: "AM" | "PM") {
  let h = h12 % 12;
  if (ampm === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function TimePicker({ value, onChange, placeholder = "Select time", className }: Props) {
  const [open, setOpen] = useState(false);
  const { h12, min, ampm } = useMemo(() => parse(value), [value]);
  const ampmTyped = ampm as "AM" | "PM";

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  const set = (next: Partial<{ h12: number; min: number; ampm: "AM" | "PM" }>) => {
    const nh = next.h12 ?? h12;
    const nm = next.min ?? min;
    const na = next.ampm ?? ampmTyped;
    onChange(to24(nh, nm, na));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full bg-[color:var(--background)] border border-white/10 rounded-lg px-3 py-2.5 text-sm flex items-center justify-between gap-2 hover:border-white/20 transition-colors",
            className
          )}
        >
          <span className={value ? "" : "text-muted-foreground"}>
            {value ? format12(h12, min, ampmTyped) : placeholder}
          </span>
          <Clock className="size-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-3 bg-[color:var(--card)] border-white/10 pointer-events-auto"
      >
        <div className="flex gap-2 items-stretch">
          <Column
            label="Hr"
            items={hours}
            selected={h12}
            render={(v) => String(v).padStart(2, "0")}
            onSelect={(v) => set({ h12: v })}
          />
          <Column
            label="Min"
            items={minutes}
            selected={min}
            render={(v) => String(v).padStart(2, "0")}
            onSelect={(v) => set({ min: v })}
          />
          <div className="flex flex-col gap-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground text-center mb-1">AM/PM</div>
            {(["AM", "PM"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => set({ ampm: p })}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors border",
                  ampmTyped === p
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-white/10 hover:border-white/20 text-foreground/80"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-medium"
          >
            Done
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Column<T extends number>({
  label,
  items,
  selected,
  render,
  onSelect,
}: {
  label: string;
  items: T[];
  selected: T;
  render: (v: T) => string;
  onSelect: (v: T) => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground text-center mb-1">{label}</div>
      <div className="h-48 w-14 overflow-y-auto rounded-md border border-white/10 bg-[color:var(--background)] flame-scroll">
        {items.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onSelect(v)}
            className={cn(
              "w-full text-center py-1.5 text-sm transition-colors",
              selected === v
                ? "bg-primary text-primary-foreground font-semibold"
                : "hover:bg-white/5 text-foreground/80"
            )}
          >
            {render(v)}
          </button>
        ))}
      </div>
    </div>
  );
}
