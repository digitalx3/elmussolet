import React, { createContext, useContext, useState } from 'react';

interface ListAccessState {
  listId: string | null;
  listCode: string | null;
  token: string | null;
  babyName: string | null;
  owners: Array<{ firstName: string; lastName: string }>;
  expectedDate: string | null;
}

interface ListAccessContextType extends ListAccessState {
  setAccess: (data: Omit<ListAccessState, 'token'> & { token: string }) => void;
  clearAccess: () => void;
  hasAccess: boolean;
}

const initial: ListAccessState = {
  listId: null, listCode: null, token: null,
  babyName: null, owners: [], expectedDate: null,
};

const ListAccessContext = createContext<ListAccessContextType | undefined>(undefined);

export const ListAccessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ListAccessState>(initial);

  const setAccess = (data: Omit<ListAccessState, 'token'> & { token: string }) => {
    setState(data);
  };

  const clearAccess = () => setState(initial);

  return (
    <ListAccessContext.Provider value={{
      ...state,
      setAccess,
      clearAccess,
      hasAccess: !!state.token,
    }}>
      {children}
    </ListAccessContext.Provider>
  );
};

export const useListAccess = () => {
  const ctx = useContext(ListAccessContext);
  if (!ctx) throw new Error('useListAccess must be used within ListAccessProvider');
  return ctx;
};
