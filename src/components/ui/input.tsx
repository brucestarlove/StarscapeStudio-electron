import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Starscape input styling
          "flex h-10 w-full rounded-md px-4 py-3",
          "bg-white/10 border-2 border-white/10",
          "text-white placeholder:text-white/50",
          "transition-all duration-200",
          "focus-visible:bg-white focus-visible:text-dark-navy",
          "focus-visible:border-deep-blue focus-visible:shadow-subtle",
          "focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
