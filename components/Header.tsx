
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-2xl m-4 rounded-xl border border-indigo-400/50">
      <div className="container mx-auto px-6 py-6 md:py-8">
        <div className="flex flex-col justify-center items-center">
            <h1 
              className="text-2xl md:text-4xl font-bold text-center [text-shadow:2px_2px_4px_rgba(0,0,0,0.5)] leading-tight"
            >
              HỆ THỐNG TẠO ĐỀ THI TRẮC NGHIỆM BẰNG AI
            </h1>
            <p className="text-base md:text-2xl mt-3 md:mt-4 opacity-80">Thầy Lê Văn Đông</p>
        </div>
      </div>
    </header>
  );
};

export default Header;