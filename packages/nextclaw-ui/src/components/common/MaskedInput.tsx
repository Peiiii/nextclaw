import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MaskedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  maskedValue?: string;
  isSet?: boolean;
}

export function MaskedInput({ isSet, className, value, onChange, placeholder, ...props }: MaskedInputProps) {
  const [showKey, setShowKey] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const hasUserInput = typeof value === 'string' && value.length > 0;

  // Determine what to display
  const showMaskedDots = isSet && !hasUserInput && !isEditing;

  return (
    <div className="relative">
      {showMaskedDots ? (
        // Show masked state - clickable to edit
        <div
          onClick={() => setIsEditing(true)}
          className={cn(
            'flex h-9 w-full rounded-xl border border-gray-200/80 bg-white px-3.5 py-2 text-sm text-gray-500 cursor-text items-center pr-12',
            className
          )}
        >
          ••••••••••••
        </div>
      ) : (
        <Input
          type={showKey ? 'text' : 'password'}
          className={cn('pr-12', className)}
          value={value}
          onChange={onChange}
          onBlur={() => {
            if (!hasUserInput) {
              setIsEditing(false);
            }
          }}
          placeholder={placeholder}
          autoFocus={isEditing}
          {...props}
        />
      )}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
        {(isSet || hasUserInput) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowKey(!showKey)}
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}
