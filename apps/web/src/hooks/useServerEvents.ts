import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { api } from '../api/ApiClient';
import { ServerEvents } from '../api/ServerEvents';

/** Opens the SSE stream for the app's lifetime. Returns whether it's currently connected. */
export function useServerEvents(): boolean {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState<boolean>(true);

  useEffect(() => {
    const events = new ServerEvents(api.eventsUrl(), queryClient);

    return events.connect((isConnected) => {
      setConnected(isConnected);

      // After a reconnect, refetch in case events were missed beyond the replay window.
      if (isConnected) {
        void queryClient.invalidateQueries();
      }
    });
  }, [queryClient]);

  return connected;
}
