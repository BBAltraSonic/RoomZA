import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "motion-field flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-panel px-3.5 py-3 text-base shadow-[var(--shadow-control)] outline-none transition-[border-color,box-shadow] duration-[var(--motion-standard)] placeholder:text-muted-foreground focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/25 sm:px-3 sm:py-2.5 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
