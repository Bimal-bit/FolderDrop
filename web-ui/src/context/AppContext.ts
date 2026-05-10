import { createContext } from 'react';
import { ToastType } from '../hooks/useToast';

interface AppContextValue {
  addToast: (message: string, type?: ToastType, duration?: number) => void;
}

export const AppContext = createContext<AppContextValue>({
  addToast: () => {},
});
