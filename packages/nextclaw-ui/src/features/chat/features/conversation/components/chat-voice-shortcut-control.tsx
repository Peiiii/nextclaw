import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { t } from '@/shared/lib/i18n';
import { isVoiceShortcut, useChatVoiceShortcutStore, voiceShortcutLabel } from '@/features/chat/stores/chat-voice-shortcut.store';

export function ChatVoiceShortcutControl() {
  const { shortcut, setShortcut } = useChatVoiceShortcutStore();
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <div className='mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground'>
    <div className='flex flex-wrap items-center gap-2'>
      <Button variant='ghost' size='sm' aria-label={t('chatInputVoiceBind')}
        onClick={() => { setCapturing(true); setError(null); }} onBlur={() => setCapturing(false)}
        onKeyDown={(event) => {
          if (!capturing || event.nativeEvent.isComposing) return;
          if (event.key === 'Escape') { event.stopPropagation(); setCapturing(false); return; }
          if (event.key === 'Tab') return;
          event.preventDefault(); event.stopPropagation();
          const value = { code: event.code, ctrl: event.ctrlKey, meta: event.metaKey, alt: event.altKey, shift: event.shiftKey };
          if (!isVoiceShortcut(value)) { setError('chatInputVoiceBindInvalid'); return; }
          try { setShortcut(value); setCapturing(false); setError(null); }
          catch { setError('chatInputVoiceSaveFailed'); }
        }}>
        {capturing ? t('chatInputVoiceCapture') : shortcut ? voiceShortcutLabel(shortcut) : t('chatInputVoiceBind')}
      </Button>
      {shortcut ? <Button variant='ghost' size='sm' onClick={() => {
        try { setShortcut(null); setError(null); } catch { setError('chatInputVoiceSaveFailed'); }
      }}>{t('chatInputVoiceUnbind')}</Button> : null}
    </div>
    <p role={capturing ? 'status' : undefined} className='mt-1 leading-5'>{t(capturing ? 'chatInputVoiceCaptureHelp' : 'chatInputVoiceShortcutHelp')}</p>
    {error ? <p role='alert' className='mt-1 text-destructive'>{t(error)}</p> : null}
  </div>;
}
