
import React from 'react';

interface AccordionProps {
  title: string;
  number?: number;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}

const Accordion: React.FC<AccordionProps> = ({ title, number, children, isOpen, onToggle }) => {

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200/80">
      <button
        onClick={onToggle}
        className="w-full flex items-center p-4 bg-indigo-500 hover:bg-indigo-600 transition-colors text-white"
        aria-expanded={isOpen}
      >
        <div className="flex items-center">
          {number !== undefined && (
            <div className="bg-white text-indigo-500 rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg mr-4 flex-shrink-0">{number}</div>
          )}
          <h2 className="text-lg font-semibold text-left">{title}</h2>
        </div>
      </button>
      {isOpen && (
        <div className="p-6 bg-white">
          {children}
        </div>
      )}
    </div>
  );
};

export default Accordion;
