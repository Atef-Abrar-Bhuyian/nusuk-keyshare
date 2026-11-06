import { useLocalIdSet } from "./use-local-id-set";

const STORAGE_KEY = "keys_not_working_ids";

/**
 * "Not working" marks are personal to this device: they live in localStorage
 * and are never sent to the shared list, so other users can still try the key.
 */
export function useNotWorkingKeys() {
  const { ids, toggle, remove, hydrated } = useLocalIdSet(STORAGE_KEY);

  return {
    notWorkingIds: ids,
    toggleNotWorking: toggle,
    unmarkNotWorking: remove,
    hydrated,
  };
}
