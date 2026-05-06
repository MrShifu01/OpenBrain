import * as React from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

import { cn } from "@/lib/utils";

// Brand-styled wrapper around react-day-picker. Custom CSS-variable
// theming hooks straight into the project's design tokens (--ember,
// --ink, --surface, --line) so the calendar feels native to the app
// instead of foreign-imported. v9 API: props pass straight through.
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("rdp-everion p-2", className)}
      classNames={classNames}
      {...props}
    />
  );
}

export { Calendar };
