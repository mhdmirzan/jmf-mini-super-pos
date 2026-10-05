import React from 'react';

export interface QuantityControlProps {
  value: number;
  onChange: (qty: number) => void;
  onEnter?: () => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export const QuantityControl: React.FC<QuantityControlProps> = ({
  value,
  onChange,
  onEnter,
  min,
  max,
  step,
  unit,
  disabled = false,
  size = 'md',
  className = '',
}) => {
  const isWeight = (unit || '').toUpperCase() === 'KG' || (step !== undefined && step < 1);
  const actualStep = step !== undefined ? step : (isWeight ? 0.25 : 1);
  const actualMin = min !== undefined ? min : (isWeight ? 0.001 : 1);

  const formatDisplay = (val: number) => {
    if (isWeight) {
      // Keep up to 3 decimals, trimming unnecessary trailing zeros if whole
      const fixed = Number(val).toFixed(3);
      // If ends with .000, keep or format clean
      return parseFloat(fixed).toString();
    }
    return Math.floor(val).toString();
  };

  const [textVal, setTextVal] = React.useState<string>(formatDisplay(value));
  const [isFocused, setIsFocused] = React.useState(false);

  React.useEffect(() => {
    if (!isFocused) {
      setTextVal(formatDisplay(value));
    }
  }, [value, isWeight, isFocused]);

  const handleDecrement = () => {
    const rawNext = value - actualStep;
    const next = isWeight
      ? Math.max(actualMin, parseFloat(rawNext.toFixed(3)))
      : Math.max(actualMin, Math.floor(rawNext));
    if (value > actualMin) {
      onChange(next);
      setTextVal(next.toString());
    }
  };

  const handleIncrement = () => {
    const rawNext = value + actualStep;
    const calculated = isWeight
      ? parseFloat(rawNext.toFixed(3))
      : Math.floor(rawNext);
    const next = max !== undefined ? Math.min(max, calculated) : calculated;
    if (max === undefined || value < max) {
      onChange(next);
      setTextVal(next.toString());
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setTextVal(raw);

    if (raw === '' || raw === '.') {
      return;
    }

    if (!isWeight) {
      // Pieces / Count: Int values only
      const clean = raw.replace(/[^0-9]/g, '');
      if (clean === '') return;
      const val = parseInt(clean, 10);
      if (!isNaN(val) && val >= actualMin) {
        const finalVal = max !== undefined ? Math.min(max, val) : val;
        onChange(finalVal);
      }
    } else {
      // Weight (KG): Up to 3 decimal places
      // Regex check: maximum 3 decimals, positive numbers
      if (!/^\d*(\.\d{0,3})?$/.test(raw)) {
        return; // reject invalid input with > 3 decimals
      }
      const val = parseFloat(raw);
      if (!isNaN(val) && val > 0) {
        const rounded = parseFloat(val.toFixed(3));
        const finalVal = max !== undefined ? Math.min(max, rounded) : rounded;
        onChange(finalVal);
      }
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (textVal === '' || textVal === '.' || isNaN(parseFloat(textVal))) {
      setTextVal(formatDisplay(actualMin));
      onChange(actualMin);
      return;
    }

    let parsed = parseFloat(textVal);
    if (parsed < actualMin) parsed = actualMin;
    if (max !== undefined && parsed > max) parsed = max;

    const finalVal = isWeight ? parseFloat(parsed.toFixed(3)) : Math.floor(parsed);
    setTextVal(formatDisplay(finalVal));
    onChange(finalVal);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isWeight && (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-')) {
      e.preventDefault();
      return;
    }
    if (isWeight && (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-')) {
      e.preventDefault();
      return;
    }
    // Limit to 3 decimal places on typing
    if (isWeight && e.key >= '0' && e.key <= '9') {
      const input = e.currentTarget;
      const currentVal = input.value;
      const dotIndex = currentVal.indexOf('.');
      if (dotIndex !== -1) {
        const selStart = input.selectionStart ?? currentVal.length;
        const decimals = currentVal.substring(dotIndex + 1);
        if (selStart > dotIndex && decimals.length >= 3 && input.selectionStart === input.selectionEnd) {
          e.preventDefault();
          return;
        }
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBlur();
      if (onEnter) onEnter();
    }
  };

  const isSm = size === 'sm';

  return (
    <div className={`inline-flex items-center border border-slate-300 rounded-md bg-white select-none ${className}`}>
      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled || value <= actualMin}
        className={`${isSm ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'} flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer font-bold`}
        aria-label="Decrease quantity"
      >
        -
      </button>
      <input
        type="text"
        value={textVal}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          setIsFocused(true);
        }}
        onBlur={handleBlur}
        inputMode={isWeight ? "decimal" : "numeric"}
        disabled={disabled}
        className={`${isSm ? (isWeight ? 'w-16 h-6 text-xs' : 'w-9 h-6 text-xs') : (isWeight ? 'w-20 h-8 text-sm' : 'w-12 h-8 text-sm')} text-center font-mono font-bold text-slate-900 bg-transparent border-x border-slate-300 focus:outline-none focus:bg-blue-50`}
      />
      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled || (max !== undefined && value >= max)}
        className={`${isSm ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'} flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer font-bold`}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
};
