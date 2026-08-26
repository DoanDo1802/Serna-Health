import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

/**
 * Hook xác định component đã mount trên client hay chưa (chuẩn React 19 SSR hydration).
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
