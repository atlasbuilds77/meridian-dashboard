import * as React from "react";

export type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  onCheckedChange?: (checked: boolean) => void;
};

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, defaultChecked, onCheckedChange, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={(event) => {
          onCheckedChange?.(event.target.checked);
          props.onChange?.(event);
        }}
        className={`h-4 w-4 rounded border border-border/60 bg-background text-profit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-profit/30 ${className || ""}`}
        {...props}
      />
    );
  }
);

Checkbox.displayName = "Checkbox";

export { Checkbox };
