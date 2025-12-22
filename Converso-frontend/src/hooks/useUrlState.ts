import { useSearchParams } from "react-router-dom";
import { useCallback } from "react";

export function useUrlState<T extends Record<string, any>>() {
  const [searchParams, setSearchParams] = useSearchParams();

  const get = useCallback(
    (key: string, defaultValue?: any) => {
      const value = searchParams.get(key);
      return value ?? defaultValue;
    },
    [searchParams]
  );

  const set = useCallback(
    (state: Partial<T>, options: { replace?: boolean } = { replace: true }) => {
      const params = new URLSearchParams(searchParams);

      Object.entries(state).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "" || value === "all") {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      });

      setSearchParams(params, options);
    },
    [searchParams, setSearchParams]
  );

  return { get, set };
}
