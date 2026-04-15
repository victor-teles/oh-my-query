import { Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

interface KeysPatternInputProps {
  initialValue?: string;
  onChange: (value: string) => void;
  focusKey?: number;
  className?: string;
  autoFocus?: boolean;
}

export const KeysPatternInput = ({
  initialValue = "",
  onChange,
  focusKey,
  className,
  autoFocus,
}: KeysPatternInputProps) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusKey !== undefined) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [focusKey]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(e.target.value);
      onChange(e.target.value);
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    setValue("");
    onChange("");
    inputRef.current?.focus();
  }, [onChange]);

  return (
    <InputGroup className={cn("h-8", className)}>
      <InputGroupAddon>
        <InputGroupText>
          <Search />
        </InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        ref={inputRef}
        autoFocus={autoFocus}
        onChange={handleChange}
        placeholder="SCAN MATCH — e.g. user:*"
        spellCheck={false}
        value={value}
        className="font-mono"
      />
      {value && (
        <InputGroupAddon>
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear pattern"
            className="rounded p-0.5 text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          >
            <X className="size-3" />
          </button>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
};
