import * as React from "react"
import { Check, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

// Lightweight checkbox primitive (no @radix-ui/react-checkbox dep).
// Supports `checked`, `indeterminate`, `onCheckedChange`, `disabled`.
const Checkbox = React.forwardRef(
  ({ className, checked, indeterminate = false, onCheckedChange, disabled, ...props }, ref) => {
    const inner = React.useRef(null)
    React.useImperativeHandle(ref, () => inner.current)
    React.useEffect(() => {
      if (inner.current) inner.current.indeterminate = !!indeterminate
    }, [indeterminate])
    return (
      <span className={cn("relative inline-flex h-4 w-4 items-center justify-center", className)}>
        <input
          ref={inner}
          type="checkbox"
          checked={!!checked}
          disabled={disabled}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          className={cn(
            "peer h-4 w-4 shrink-0 cursor-pointer appearance-none rounded border border-zinc-700 bg-zinc-900",
            "checked:border-emerald-500 checked:bg-emerald-600",
            "indeterminate:border-amber-500 indeterminate:bg-amber-600",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
          {...props}
        />
        {indeterminate ? (
          <Minus className="pointer-events-none absolute h-3 w-3 text-white" />
        ) : checked ? (
          <Check className="pointer-events-none absolute h-3 w-3 text-white" />
        ) : null}
      </span>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
