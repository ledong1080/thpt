
import React, { useState } from 'react';
import { ChevronDownIcon } from './icons';

interface AccordionProps {
  title: string;
  children: React.ReactNode;
}

const Accordion: React.FC<AccordionProps> = ({ title, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-4 bg-white hover:bg-gray-50 transition-colors rounded-lg"
      >
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        <ChevronDownIcon
          className={`w-6 h-6 text-gray-500 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="p-4 border-t border-gray-200 bg-white rounded-b-lg">
          {children}
        </div>
      )}
    </div>
  );
};

export default Accordion;
