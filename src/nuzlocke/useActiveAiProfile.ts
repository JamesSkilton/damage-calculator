import { useEffect, useState } from 'react';
import { runtimeConfig } from '../config/runtimeConfig';
import { ACTIVE_RUN_CHANGED_EVENT, getActiveTarget } from './activeRun';
import { createNuzlockeClient } from './httpClient';
import type { AiProfile } from './types';

// The AI profile of the run currently being tracked, if any.
export function useActiveAiProfile(): AiProfile | undefined {
  const [profile, setProfile] = useState<AiProfile>();

  useEffect(() => {
    if (!runtimeConfig.presetApiUrl) return undefined;
    const client = createNuzlockeClient(runtimeConfig.presetApiUrl);
    let cancelled = false;
    const load = async () => {
      const target = getActiveTarget();
      if (!target) {
        setProfile(undefined);
        return;
      }
      try {
        const run = await client.getRun(target.ownerCode, target.runId);
        if (!cancelled) setProfile(run.aiProfile);
      } catch {
        if (!cancelled) setProfile(undefined);
      }
    };
    void load();
    window.addEventListener(ACTIVE_RUN_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(ACTIVE_RUN_CHANGED_EVENT, load);
    };
  }, []);

  return profile;
}
