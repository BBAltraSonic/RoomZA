import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "motion-field h-11 w-full min-w-0 rounded-md border border-input bg-panel px-3.5 py-1 text-base shadow-[var(--shadow-control)] outline-none transition-[border-color,box-shadow] duration-[var(--motion-standard)] file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/25 sm:h-8 sm:px-3 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
