import React, { useRef, KeyboardEvent, ClipboardEvent, ChangeEvent } from 'react';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Six individual digit input boxes with:
 * - Auto-focus-next on digit entry
 * - Backspace moves to previous box
 * - Paste support (pastes up to 6 digits across boxes)
 * - Keyboard navigation (arrow keys)
 */
export function OtpInput({ value, onChange, disabled = false }: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, '').split('').slice(0, 6);

  const focusBox = (index: number) => {
    if (index >= 0 && index < 6) {
      inputRefs.current[index]?.focus();
    }
  };

  const handleChange = (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, ''); // digits only
    if (!raw) return;

    const digit = raw[raw.length - 1]; // take last digit if multiple typed
    const newDigits = [...digits];
    newDigits[index] = digit;
    onChange(newDigits.join('').replace(/ /g, ''));

    // Move focus to next box
    if (index < 5) {
      focusBox(index + 1);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newDigits = [...digits];
      if (newDigits[index] && newDigits[index] !== ' ') {
        // Clear current box
        newDigits[index] = '';
        onChange(newDigits.join('').replace(/ /g, ''));
      } else if (index > 0) {
        // Move to previous box and clear it
        newDigits[index - 1] = '';
        onChange(newDigits.join('').replace(/ /g, ''));
        focusBox(index - 1);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusBox(index - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusBox(index + 1);
    } else if (e.key === 'Enter') {
      // Trigger form submit via the parent
      const form = inputRefs.current[index]?.closest('form');
      form?.requestSubmit();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    onChange(pasted.padEnd(6, '').slice(0, 6).replace(/ /g, ''));

    // Focus the box after the last pasted digit
    const nextIndex = Math.min(pasted.length, 5);
    focusBox(nextIndex);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  return (
    <div className="otp-input-group" role="group" aria-label="6-digit share code">
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          pattern="\d"
          maxLength={2} // allow 2 so handleChange can grab the new digit
          value={digits[i] === ' ' ? '' : digits[i]}
          placeholder="."
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={handleFocus}
          disabled={disabled}
          className="otp-box"
          aria-label={`Digit ${i + 1}`}
          autoComplete="one-time-code"
          autoFocus={i === 0}
        />
      ))}
    </div>
  );
}
