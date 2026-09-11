import { Mic, Square, X, LoaderCircle, Settings } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { IconActionButton } from '@/shared/components/ui/actions/icon-action-button';
import { t } from '@/shared/lib/i18n';
import type { ChatVoiceInputManager, VoiceError, VoiceSnapshot } from '@/features/chat/managers/chat-voice-input.manager';
import { ChatVoiceShortcutControl } from './chat-voice-shortcut-control';
import { voicePermissionInstructionKeys } from '@/features/chat/utils/chat-voice-permissions.utils';

const ERROR_KEYS: Record<VoiceError, string> = {
  'insecure-context': 'chatInputVoiceInsecureContext', unsupported: 'chatInputVoiceUnsupported', permission: 'chatInputVoicePermissionDenied',
  'service-denied': 'chatInputVoiceServiceDenied', 'no-device': 'chatInputVoiceNoDevice', 'device-busy': 'chatInputVoiceDeviceBusy',
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
  const microphoneError = ['permission', 'audio-capture', 'no-device', 'device-busy'].includes(error ?? '');
  const status = {
    idle: 'chatInputVoice', ready: 'chatInputVoiceShortcut', starting: 'chatInputVoiceStarting',
    recording: 'chatInputVoiceRecording', stopping: 'chatInputVoiceFinishing', error: 'chatInputVoiceFailed',
  }[phase];
  return (
    <div role='region' aria-label={t('chatInputVoice')}
      className={'flex max-h-[var(--radix-popover-content-available-height,24rem)] max-w-full flex-col overflow-hidden border border-border bg-popover text-popover-foreground shadow-lg ' +
        (phase === 'error' ? 'w-80 rounded-xl p-3' : 'w-fit rounded-full px-3 py-1.5')}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.nativeEvent.isComposing) {
          event.stopPropagation(); manager.saveAndClose();
        }
      }}>
      <div className='flex shrink-0 items-center gap-2'>
        {busy ? <LoaderCircle className='h-4 w-4 shrink-0 motion-safe:animate-spin text-muted-foreground' />
          : <Mic className={'h-4 w-4 shrink-0 ' + (phase === 'recording' ? 'text-destructive' : '')} />}
        <span role='status' className='grid min-w-0 flex-1 text-xs font-medium'
          title={phase === 'starting' ? t('chatInputVoicePermissionPurpose') : undefined}>
          <span className='col-start-1 row-start-1 truncate'>{t(status)}</span>
          {phase !== 'error' ? ['chatInputVoiceStarting', 'chatInputVoiceRecording', 'chatInputVoiceFinishing'].map((key) =>
            <span key={key} aria-hidden='true' className='invisible col-start-1 row-start-1'>{t(key)}</span>) : null}
        </span>
        {phase !== 'error' ? <span aria-hidden={phase !== 'recording'} data-recording={phase === 'recording'}
          className='w-7 text-right text-xs tabular-nums text-muted-foreground data-[recording=false]:invisible'>{seconds}s</span> : null}
        {phase !== 'error' ? <IconActionButton icon={<Square className='h-3 w-3' />}
          label={t('chatInputVoiceSaveAndClose')} tooltip={t('chatInputVoiceEscapeHint')} disabled={phase === 'stopping'} onClick={manager.saveAndClose} /> : null}
        {desktop ? <IconActionButton icon={<Settings className='h-4 w-4' />}
          label={t('chatInputVoiceShortcut')} disabled={busy} onClick={manager.openSettings} /> : null}
      </div>
      <div className='min-h-0 overflow-y-auto'>
      {phase === 'starting' ? <p className='sr-only'>{t('chatInputVoicePermissionPurpose')}</p> : null}
      {error ? <VoiceErrorDetails error={error} microphoneError={microphoneError} text={snapshot.text} /> : null}
      </div>
      {error ? <Button className='mt-2 shrink-0 self-start' size='sm'
        disabled={error === 'unsupported' || error === 'insecure-context'} onClick={onStart}>
        {t(microphoneError ? 'chatInputVoiceCheckAndRetry' : 'chatInputVoiceRetry')}
      </Button> : null}
      {phase === 'error' ? <Button className='mt-2 shrink-0 self-start' variant='ghost' size='sm'
        title={t('chatInputVoiceEscapeHint')} onClick={manager.saveAndClose}>{t('chatInputVoiceSaveAndClose')}</Button> : null}
    </div>
  );
}

function VoiceErrorDetails({ error, microphoneError, text }: { error: VoiceError; microphoneError: boolean; text: string }) {
  return <>
    <p role='alert' className='mt-2 text-xs leading-5 text-destructive'>{t(ERROR_KEYS[error])}</p>
    {microphoneError ? <ol className='mt-2 list-decimal space-y-1 pl-4 text-xs leading-5 text-muted-foreground'>
      {voicePermissionInstructionKeys(navigator.userAgent).map((key) => <li key={key}>{t(key)}</li>)}
      <li>{t('chatInputVoicePermissionRetryHint')}</li>
    </ol> : null}
    {text ? <p className='mt-1 text-xs text-muted-foreground'>{t('chatInputVoiceReviewHint')}</p> : null}
  </>;
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
