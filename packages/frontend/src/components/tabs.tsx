import { type ReactNode, createContext, useContext, useState } from "react";

type TabsContextType = {
  activeTab: string;
  setActiveTab: (value: string) => void;
};

const TabsContext = createContext<TabsContextType | null>(null);

function useTabs() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs components must be used within a Tabs border");
  }
  return context;
}

export function Tabs({ defaultValue, children, className = "" }: { defaultValue: string; children: ReactNode; className?: string }) {
  const [activeTab, setActiveTab] = useState(defaultValue);
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={`tabs-root ${className}`.trim()}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`tabs-list ${className}`.trim()}>{children}</div>;
}

export function TabsTrigger({ value, children, className = "" }: { value: string; children: ReactNode; className?: string }) {
  const { activeTab, setActiveTab } = useTabs();
  const isActive = activeTab === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      className={`tabs-trigger ${isActive ? "is-active" : ""} ${className}`.trim()}
      onClick={() => setActiveTab(value)}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className = "" }: { value: string; children: ReactNode; className?: string }) {
  const { activeTab } = useTabs();
  if (activeTab !== value) return null;
  return (
    <div role="tabpanel" className={`tabs-content ${className}`.trim()}>
      {children}
    </div>
  );
}
