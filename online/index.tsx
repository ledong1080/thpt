
import React from 'react';
import ReactDOM from 'react-dom/client';
import OnlineExam from '../OnlineExam';

const rootElement = document.getElementById('exam-root');
if (!rootElement) {
  throw new Error("Could not find exam root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <OnlineExam />
  </React.StrictMode>
);