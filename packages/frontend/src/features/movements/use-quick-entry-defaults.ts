import { useCallback, useState } from "react";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export type PersistedDefaults = {
  accountId?: string;
  paymentMethod?: "PIX" | "CASH" | "OTHER";
  keepContext?: boolean;
  recentCategories?: string[];
};

const STORAGE_KEY = "quick-entry-defaults";

function readPersistedDefaults(storage: StorageLike | null): PersistedDefaults {
  if (storage === null) {
    return {};
  }

  try {
    const rawValue = storage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return {};
    }

    return JSON.parse(rawValue) as PersistedDefaults;
  } catch {
    return {};
  }
}

function resolveStorage(storage?: StorageLike): StorageLike | null {
  if (storage) {
    return storage;
  }

  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export function useQuickEntryDefaults(storage?: StorageLike) {
  const resolvedStorage = resolveStorage(storage);
  const [defaults, setDefaults] = useState<PersistedDefaults>(() =>
    readPersistedDefaults(resolvedStorage),
  );

  const saveDefaults = useCallback(
    (nextDefaults: PersistedDefaults) => {
      setDefaults(nextDefaults);

      if (resolvedStorage === null) {
        return;
      }

      resolvedStorage.setItem(STORAGE_KEY, JSON.stringify(nextDefaults));
    },
    [resolvedStorage],
  );

  return { defaults, saveDefaults };
}
