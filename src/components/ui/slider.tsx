import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className
    )}
    {...props}
  >
    {/* Track background - visible dark bar */}
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-[rgba(168,192,255,0.15)] border border-[rgba(168,192,255,0.2)]">
      {/* Filled range portion - gradient fill */}
      <SliderPrimitive.Range className="absolute h-full bg-gradient-cyan-purple rounded-full" />
    </SliderPrimitive.Track>
    {/* Thumb - prominent circle with gradient background */}
    <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-[rgba(168,192,255,0.6)] bg-gradient-cyan-purple shadow-[0_2px_8px_rgba(6,182,212,0.4)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(168,192,255,0.5)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a2e] hover:scale-110 hover:shadow-[0_4px_12px_rgba(6,182,212,0.6)] disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
