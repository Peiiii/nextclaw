import { RuntimeControlCard } from '@/features/system-status/components/runtime-control-card';
import { RuntimePresenceCard } from '@/features/system-status/components/runtime-presence-card';
import { PwaInstallCard } from '@/features/pwa';

export function RuntimeConfigOverview() {
  return (
    <>
      <RuntimeControlCard />
      <RuntimePresenceCard />
      <PwaInstallCard />
    </>
  );
}
