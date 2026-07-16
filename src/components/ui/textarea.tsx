import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "motion-field flex field-sizing-content min-h-16 w-full rounded-lg border-0 bg-background px-3.5 py-3 sm:px-3 sm:py-2.5 text-base shadow-[var(--neu-inset-sm)] outline-none placeholder:text-muted-foreground focus-visible:shadow-[var(--neu-inset)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2 aria-invalid:ring-destructive/40 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
