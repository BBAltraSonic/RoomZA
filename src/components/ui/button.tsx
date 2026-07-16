import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Neumorphic base: shared surface color, depth from paired shadows, no
  // borders. Raised elements press "in" (inset shadow) on :active.
  "motion-interactive group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-background text-primary font-semibold shadow-[var(--neu-raised)] hover:shadow-[var(--neu-raised-lg)] active:shadow-[var(--neu-inset)]",
        outline:
          "bg-background text-foreground shadow-[var(--neu-raised-sm)] hover:shadow-[var(--neu-raised)] active:shadow-[var(--neu-inset-sm)] aria-expanded:shadow-[var(--neu-inset-sm)]",
        secondary:
          "bg-background text-secondary-foreground shadow-[var(--neu-raised)] hover:shadow-[var(--neu-raised-lg)] active:shadow-[var(--neu-inset)] aria-expanded:shadow-[var(--neu-inset)]",
        ghost:
          "text-foreground shadow-none hover:shadow-[var(--neu-inset-sm)] active:shadow-[var(--neu-inset)] aria-expanded:shadow-[var(--neu-inset-sm)]",
        destructive:
          "bg-background text-destructive shadow-[var(--neu-raised-sm)] hover:shadow-[var(--neu-raised)] active:shadow-[var(--neu-inset-sm)] focus-visible:ring-destructive/20",
        link: "text-primary underline-offset-4 shadow-none hover:underline",
      },
      size: {
        default:
          "h-11 sm:h-8 gap-2 sm:gap-1.5 px-4 sm:px-2.5 has-data-[icon=inline-end]:pr-3 sm:has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-3 sm:has-data-[icon=inline-start]:pl-2",
        xs: "h-9 sm:h-6 gap-1.5 sm:gap-1 rounded-[min(var(--radius-md),10px)] px-3 sm:px-2 text-sm sm:text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2 sm:has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-2 sm:has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-4 sm:[&_svg:not([class*='size-'])]:size-3",
        sm: "h-10 sm:h-7 gap-2 sm:gap-1 rounded-[min(var(--radius-md),12px)] px-3 sm:px-2.5 text-base sm:text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2.5 sm:has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-2.5 sm:has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-4 sm:[&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 sm:h-9 gap-2 sm:gap-1.5 px-5 sm:px-2.5 has-data-[icon=inline-end]:pr-4 sm:has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-4 sm:has-data-[icon=inline-start]:pl-2",
        icon: "size-11 sm:size-8",
        "icon-xs":
          "size-9 sm:size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-4 sm:[&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-10 sm:size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-12 sm:size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  nativeButton,
  render,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  const classes = cn(buttonVariants({ variant, size, className }))
  const shouldRenderNonNativeElement = render && !(nativeButton ?? false)

  if (shouldRenderNonNativeElement && React.isValidElement<{ className?: string }>(render)) {
    return React.cloneElement(render, {
      ...props,
      "data-slot": "button",
      className: cn(classes, render.props.className),
    } as Partial<React.HTMLAttributes<HTMLElement>>)
  }

  return (
    <ButtonPrimitive
      data-slot="button"
      className={classes}
      nativeButton={nativeButton ?? (render ? false : true)}
      render={render}
      {...props}
    />
  )
}

export { Button, buttonVariants }
