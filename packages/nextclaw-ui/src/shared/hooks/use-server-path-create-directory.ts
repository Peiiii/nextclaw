import { useMutation } from '@tanstack/react-query';
import { createServerPathDirectory } from '@/shared/lib/api';

export function useServerPathCreateDirectory() {
  return useMutation({ mutationFn: createServerPathDirectory });
}
