import { Mic, Square, X, LoaderCircle, Settings } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { IconActionButton } from '@/shared/components/ui/actions/icon-action-button';
import { t } from '@/shared/lib/i18n';
import type { ChatVoiceInputManager, VoiceError, VoiceSnapshot } from '@/features/chat/managers/chat-voice-input.manager';
import { ChatVoiceShortcutControl } from './chat-voice-shortcut-control';

const ERROR_KEYS: Record<VoiceError, string> = {
  unsupported: 'chatInputVoiceUnsupported', permission: 'chatInputVoicePermissionDenied',
  network: 'chatInputVoiceNetwork', 'audio-capture': 'chatInputVoiceDevice',
  'no-speech': 'chatInputVoiceNoSpeech', interrupted: 'chatInputVoiceInterrupted',
  timeout: 'chatInputVoiceTimeout', failed: 'chatInputVoiceFailed',
};

export function ChatVoiceInputPanel({ manager, snapshot, onStart, desktop }: {
  manager: ChatVoiceInputManager;
  snapshot: VoiceSnapshot;
  onStart: () => void;
  desktop: boolean;
}) {
  const { phase, error, seconds } = snapshot;
  if (phase === 'ready') return desktop ? <VoiceShortcutPanel onClose={manager.cancel} /> : null;
  const busy = phase === 'starting' || phase === 'stopping';
  const status = {
    idle: 'chatInputVoice', ready: 'chatInputVoiceShortcut', starting: 'chatInputVoiceStarting',
    recording: 'chatInputVoiceRecording', stopping: 'chatInputVoiceFinishing', error: 'chatInputVoiceFailed',
  }[phase];
  return (
    <div role='region' aria-label={t('chatInputVoice')}
      className={'max-h-[var(--radix-popover-content-available-height,24rem)] max-w-full overflow-y-auto border border-border bg-popover text-popover-foreground shadow-lg ' +
        (error ? 'w-80 rounded-xl p-3' : 'rounded-full px-3 py-1.5')}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.nativeEvent.isComposing) {
          event.stopPropagation(); manager.cancel();
        }
      }}>
      <div className='flex items-center gap-2'>
        {busy ? <LoaderCircle className='h-4 w-4 shrink-0 motion-safe:animate-spin text-muted-foreground' />
          : <Mic className={'h-4 w-4 shrink-0 ' + (phase === 'recording' ? 'text-destructive' : '')} />}
        <span role='status' className='min-w-0 flex-1 text-xs font-medium'>{t(status)}</span>
        {phase === 'recording' ? <span className='text-xs tabular-nums text-muted-foreground'>{seconds}s</span> : null}
        {phase === 'recording' ? <IconActionButton icon={<Square className='h-3 w-3' />}
          label={t('chatInputVoiceFinish')} onClick={manager.finish} /> : null}
        <IconActionButton icon={<X className='h-4 w-4' />} label={t('chatInputVoiceCancel')} onClick={manager.cancel} />
        {desktop ? <IconActionButton icon={<Settings className='h-4 w-4' />}
          label={t('chatInputVoiceShortcut')} disabled={busy} onClick={manager.openSettings} /> : null}
      </div>
      {error ? <>
        <p role='alert' className='mt-2 text-xs leading-5 text-destructive'>{t(ERROR_KEYS[error])}</p>
        <p className='mt-1 text-xs text-muted-foreground'>{t('chatInputVoiceReviewHint')}</p>
        <Button className='mt-2' size='sm' disabled={error === 'unsupported'} onClick={onStart}>{t('chatInputVoiceRetry')}</Button>
      </> : null}
    </div>
  );
}

function VoiceShortcutPanel({ onClose }: { onClose: () => void }) {
  return <div role='region' aria-label={t('chatInputVoiceShortcut')}
    className='max-h-[var(--radix-popover-content-available-height,24rem)] w-80 max-w-full overflow-y-auto rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg'
    onKeyDown={(event) => {
      if (event.key === 'Escape' && !event.nativeEvent.isComposing) { event.stopPropagation(); onClose(); }
    }}>
    <div className='flex items-center gap-2'>
      <Settings className='h-4 w-4' />
      <span className='flex-1 text-sm font-medium'>{t('chatInputVoiceShortcut')}</span>
      <IconActionButton icon={<X className='h-4 w-4' />} label={t('chatInputVoiceCloseSettings')} onClick={onClose} />
    </div>
    <ChatVoiceShortcutControl />
  </div>;
}
