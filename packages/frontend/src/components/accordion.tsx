import { type ReactNode, createContext, useContext, useState } from "react";

type AccordionContextType = {
  activeItem: string | null;
  toggleItem: (value: string) => void;
};

const AccordionContext = createContext<AccordionContextType | null>(null);

function useAccordion() {
  const context = useContext(AccordionContext);
  if (!context) {
    throw new Error("Accordion components must be used within an Accordion root");
  }
  return context;
}

export function Accordion({ children, className = "", type = "single", collapsible = true }: { children: ReactNode; className?: string; type?: "single"; collapsible?: boolean }) {
  const [activeItem, setActiveItem] = useState<string | null>(null);

  function toggleItem(value: string) {
    if (activeItem === value) {
      if (collapsible) {
        setActiveItem(null);
      }
    } else {
      setActiveItem(value);
    }
  }

  return (
    <AccordionContext.Provider value={{ activeItem, toggleItem }}>
      <div className={`accordion-root ${className}`.trim()}>{children}</div>
    </AccordionContext.Provider>
  );
}

export function AccordionItem({ value, children, className = "" }: { value: string; children: ReactNode; className?: string }) {
  const { activeItem } = useAccordion();
  const isOpen = activeItem === value;

  return (
    <div className={`accordion-item ${isOpen ? "is-open" : ""} ${className}`.trim()} data-value={value}>
      {children}
    </div>
  );
}

export function AccordionTrigger({ value, children, className = "" }: { value: string; children: ReactNode; className?: string }) {
  const { activeItem, toggleItem } = useAccordion();
  const isOpen = activeItem === value;

  return (
    <button
      type="button"
      className={`accordion-trigger ${isOpen ? "is-open" : ""} ${className}`.trim()}
      onClick={() => toggleItem(value)}
      aria-expanded={isOpen}
    >
      {children}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`accordion-icon ${isOpen ? "is-open" : ""}`}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
}

export function AccordionContent({ value, children, className = "" }: { value: string; children: ReactNode; className?: string }) {
  const { activeItem } = useAccordion();
  const isOpen = activeItem === value;

  if (!isOpen) return null;

  return (
    <div className={`accordion-content ${className}`.trim()}>
      <div className="accordion-content-inner">{children}</div>
    </div>
  );
}
