import { useLocalIdSet } from "./use-local-id-set";

const STORAGE_KEY = "keys_done_ids";

/**
 * "Done" marks are personal to this device: they live in localStorage and are
 * never sent to the shared list, so other users can still use the same key.
 */
export function useDoneKeys() {
  const { ids, toggle, add, remove, clearAll, hydrated } = useLocalIdSet(STORAGE_KEY);

  return {
    doneIds: ids,
    toggleDone: toggle,
    markDone: add,
    unmarkDone: remove,
    clearAllDone: clearAll,
    hydrated,
  };
}
