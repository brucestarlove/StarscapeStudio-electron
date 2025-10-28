import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-button font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-light-blue focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Starscape primary button (cosmic gradient)
        default: "bg-gradient-cosmic text-white shadow-default hover:bg-gradient-cosmic-hover hover:-translate-y-0.5 hover:shadow-elevated active:translate-y-0",
        
        // Starscape destructive button
        destructive: "bg-error text-white shadow-default hover:bg-error/90",
        
        // Starscape outline button (secondary)
        outline: "border-2 border-light-blue bg-transparent text-light-blue hover:bg-light-blue hover:text-dark-navy",
        
        // Starscape secondary variant
        secondary: "bg-mid-navy text-white shadow-subtle hover:bg-deep-blue",
        
        // Starscape ghost button
        ghost: "hover:bg-light-blue/20 hover:text-light-blue",
        
        // Starscape link button
        link: "text-light-blue underline-offset-4 hover:underline",
        
        // Starscape gradient button
        gradient: "bg-gradient-cyan-vibrant text-white shadow-elevated hover:scale-105 hover:shadow-glow-cyan active:scale-95",
      },
      size: {
        default: "h-10 px-7 py-3.5",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
