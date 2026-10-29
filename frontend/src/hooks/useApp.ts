import { useContext } from 'react';
import { AppContext } from '../context/AppContextInstance';
import { AppContextValue } from '../types';

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
