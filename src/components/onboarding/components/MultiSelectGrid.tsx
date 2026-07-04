import React from "react";
import OptionCard from "./OptionCard";
import { cn } from "@/lib/utils";

interface Option {
  id: string;
  label: string;
  description?: string;
  icon?: string | React.ReactNode;
}

interface MultiSelectGridProps {
  options: Option[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  columnsClass?: string;
}

export default function MultiSelectGrid({
  options,
  selectedIds,
  onChange,
  columnsClass = "grid-cols-1 sm:grid-cols-2",
}: MultiSelectGridProps) {
  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className={cn("grid gap-3 w-full max-w-xl mx-auto pt-2", columnsClass)}>
      {options.map((opt) => (
        <OptionCard
          key={opt.id}
          title={opt.label}
          description={opt.description}
          icon={opt.icon}
          selected={selectedIds.includes(opt.id)}
          onClick={() => handleToggle(opt.id)}
        />
      ))}
    </div>
  );
}
