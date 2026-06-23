import React, { createContext, useContext } from 'react';

const TabBadgeContext = createContext({ unreadNotifications: 0 });

export function TabBadgeProvider({ unreadNotifications = 0, children }) {
  return (
    <TabBadgeContext.Provider value={{ unreadNotifications }}>
      {children}
    </TabBadgeContext.Provider>
  );
}

export function useTabBadges() {
  return useContext(TabBadgeContext);
}
