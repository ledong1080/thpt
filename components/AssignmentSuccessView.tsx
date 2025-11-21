
import React, { useState } from 'react';
import { CheckCircleIcon, ClipboardIcon } from './icons';

interface AssignmentSuccessViewProps {
  link: string;
  code: string;
  onReturn: () => void;
  onStartNew: () => void;
}

const AssignmentSuccessView: React.FC<AssignmentSuccessViewProps> = ({ link, code, onReturn, onStartNew }) => {
    const [copyStatus, setCopyStatus] = useState({ link: 'Copy', code: 'Copy' });

    const handleCopy = (text: string, type: 'link' | 'code') => {
        navigator.clipboard.writeText(text).then(() => {
            setCopyStatus(prev => ({ ...prev, [type]: 'Copied!' }));
            setTimeout(() => {
                setCopyStatus(prev => ({ ...prev, [type]: 'Copy' }));
            }, 2000);
        });
    };
    
    return (
        <div className="flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8 border border-slate-200/80 transform transition-all">
                <div className="text-center">
                    <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto" />
                    <h2 className="mt-4 text-2xl font-bold text-gray-800">Giao bài thành công!</h2>
                    <p className="mt-2 text-gray-600">Hãy sao chép và gửi link cùng mã đề dưới đây cho học sinh.</p>
                </div>

                <div className="mt-8 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Link bài tập cho học sinh:</label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                            <div className="relative flex items-stretch flex-grow focus-within:z-10">
                                <input
                                    type="text"
                                    readOnly
                                    value={link}
                                    className="block w-full rounded-none rounded-l-md border-gray-300 bg-gray-50 pl-3 text-indigo-700 sm:text-sm"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => handleCopy(link, 'link')}
                                className="relative -ml-px inline-flex items-center space-x-2 rounded-r-md border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                            >
                                <ClipboardIcon className="h-5 w-5 text-gray-400" />
                                <span>{copyStatus.link}</span>
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Mã đề cho học sinh:</label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                            <div className="relative flex items-stretch flex-grow focus-within:z-10">
                                <input
                                    type="text"
                                    readOnly
                                    value={code}
                                    className="block w-full rounded-none rounded-l-md border-gray-300 bg-gray-50 pl-3 font-mono tracking-widest text-center text-gray-900 sm:text-sm"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => handleCopy(code, 'code')}
                                className="relative -ml-px inline-flex items-center space-x-2 rounded-r-md border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                            >
                                <ClipboardIcon className="h-5 w-5 text-gray-400" />
                                <span>{copyStatus.code}</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                    <div className="flex">
                        <div className="flex-shrink-0">
                             <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M8.257 3.099c.636-1.21 2.273-1.21 2.91 0l6.363 12.152c.601 1.148-.28 2.599-1.574 2.599H3.468c-1.294 0-2.175-1.451-1.574-2.599L8.257 3.099zM9 13a1 1 0 112 0 1 1 0 01-2 0zm1-5a1 1 0 00-1 1v3a1 1 0 002 0V9a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-yellow-700">
                                <span className="font-bold">Lưu ý quan trọng:</span> Link bài tập có thể cần <span className="font-semibold">vài phút</span> để hoạt động sau khi tạo. Vui lòng kiểm tra link trước khi gửi cho học sinh.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-center space-x-4">
                    <button
                        onClick={onReturn}
                        className="rounded-md bg-gray-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-700"
                    >
                        Quay lại đề gốc
                    </button>
                    <button
                        onClick={onStartNew}
                        className="rounded-md bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                    >
                        Tạo đề thi khác
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AssignmentSuccessView;
