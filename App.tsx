
import React from 'react';
import Header from './components/Header';
import ExamGenerator from './components/ExamGenerator';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Header />
      <main className="p-4 sm:p-6 lg:p-8">
        <ExamGenerator />
      </main>
    </div>
  );
};

export default App;
