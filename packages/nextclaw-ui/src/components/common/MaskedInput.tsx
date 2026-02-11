import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MaskedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  maskedValue?: string;
  isSet?: boolean;
}

export function MaskedInput({ maskedValue, isSet, className, ...props }: MaskedInputProps) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="relative">
      <Input
        type={showKey ? 'text' : 'password'}
        className={cn('pr-20', className)}
        placeholder={isSet ? '已设置 (未修改)' : ''}
        {...props}
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
        {(isSet || maskedValue) && (
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
