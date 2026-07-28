import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "motion-interactive group/button inline-flex shrink-0 items-center justify-center rounded-md border bg-clip-padding text-sm font-medium whitespace-nowrap outline-none select-none transition-[background-color,border-color,color,box-shadow,transform] duration-[var(--motion-standard)] ease-[var(--ease-out-expo)] focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-3 aria-invalid:ring-destructive/20 active:translate-y-px motion-reduce:transform-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-forest bg-forest text-primary-foreground font-semibold shadow-[var(--shadow-control)] hover:border-[var(--forest-hover)] hover:bg-[var(--forest-hover)] hover:shadow-[var(--shadow-card)] active:shadow-[var(--shadow-hairline)]",
        outline:
          "border-border bg-panel text-ink shadow-[var(--shadow-control)] hover:border-forest/30 hover:bg-accent hover:text-forest active:shadow-[var(--shadow-hairline)] aria-expanded:border-forest/30 aria-expanded:bg-accent",
        secondary:
          "border-forest/15 bg-accent text-forest shadow-[var(--shadow-control)] hover:border-forest/30 hover:bg-muted active:shadow-[var(--shadow-hairline)] aria-expanded:border-forest/30",
        ghost:
          "border-transparent bg-transparent text-foreground shadow-none hover:bg-muted hover:text-forest active:bg-accent aria-expanded:bg-muted",
        destructive:
          "border-destructive bg-destructive text-primary-foreground shadow-[var(--shadow-control)] hover:opacity-90 active:shadow-[var(--shadow-hairline)] focus-visible:ring-destructive/20",
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
