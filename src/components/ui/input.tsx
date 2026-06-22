import * as React from "react"
import { cn } from "../../lib/utils"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-[13px] border border-[#e0e0e4] bg-white dark:bg-ot-dark-card px-4 py-2 font-ui text-[15px] text-[#0e0e10] placeholder:text-[#9a9aa2] outline-none focus:border-[#2a5fff] disabled:cursor-not-allowed disabled:opacity-50 transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium",
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
