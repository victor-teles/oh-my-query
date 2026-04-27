import type { ReactNode } from "react";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

interface SettingsFeedbackValue {
  lastSavedAt: number | null;
  notifySaved: () => void;
}

const SettingsFeedbackContext = createContext<SettingsFeedbackValue | null>(
  null
);

export const SettingsFeedbackProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const notifySaved = useCallback(() => {
    setLastSavedAt(Date.now());
  }, []);

  const value = useMemo(
    () => ({ lastSavedAt, notifySaved }),
    [lastSavedAt, notifySaved]
  );

  return (
    <SettingsFeedbackContext.Provider value={value}>
      {children}
    </SettingsFeedbackContext.Provider>
  );
};

export const useSettingsFeedback = () => {
  const ctx = useContext(SettingsFeedbackContext);
  if (!ctx) {
    throw new Error(
      "useSettingsFeedback must be used within SettingsFeedbackProvider"
    );
  }
  return ctx;
};
