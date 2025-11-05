
import React, { useState, useEffect } from 'react';

interface SystemConfigProps {
    onSaveSuccess: () => void;
}

const SystemConfig: React.FC<SystemConfigProps> = ({ onSaveSuccess }) => {
    const [apiKey, setApiKey] = useState('');
    const [githubToken, setGithubToken] = useState('');
    const [scriptUrl, setScriptUrl] = useState('');
    const [sheetUrl, setSheetUrl] = useState('');
    const [teacherName, setTeacherName] = useState('');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        // Load saved settings from localStorage on component mount
        setApiKey(localStorage.getItem('geminiApiKey') || '');
        setGithubToken(localStorage.getItem('githubToken') || '');
        setScriptUrl(localStorage.getItem('googleScriptUrl') || '');
        setSheetUrl(localStorage.getItem('googleSheetUrl') || '');
        setTeacherName(localStorage.getItem('teacherName') || '');
    }, []);

    const handleSave = () => {
        localStorage.setItem('geminiApiKey', apiKey);
        localStorage.setItem('githubToken', githubToken);
        localStorage.setItem('googleScriptUrl', scriptUrl);
        localStorage.setItem('googleSheetUrl', sheetUrl);
        localStorage.setItem('teacherName', teacherName);
        setSaved(true);
        setTimeout(() => {
            setSaved(false);
            onSaveSuccess();
        }, 1000); // Hide message and close accordion after 1 second
    };
    
    const FormRow = ({ children }: { children: React.ReactNode }) => (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2 items-center">
            {children}
        </div>
    );

    const Label = ({ children, htmlFor }: { children: React.ReactNode, htmlFor: string }) => (
        <label htmlFor={htmlFor} className="block text-sm font-medium leading-6 text-gray-900">
            {children}
        </label>
    );

    const Input = ({ id, value, onChange, type = 'text', placeholder = '' }: { id: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, type?: string, placeholder?: string }) => (
        <input
            type={type}
            name={id}
            id={id}
            value={value}
            onChange={onChange}
            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
            placeholder={placeholder}
        />
    );


    return (
        <div className="space-y-6">
            <p className="text-sm text-gray-600">
                Vui lòng cung cấp các thông tin cần thiết để sử dụng đầy đủ các tính năng nâng cao và lưu trữ.
            </p>
            <div className="space-y-4">
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-6">
                    <div className="sm:col-span-full">
                        <label htmlFor="api-key" className="block text-sm font-medium leading-6 text-gray-900">API Key <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-600 text-xs hover:underline ml-2">Lấy Gemini API Key</a></label>
                        <div className="mt-2">
                             <Input id="api-key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                        </div>
                    </div>
                    
                    <div className="sm:col-span-full">
                        <label htmlFor="github-token" className="block text-sm font-medium leading-6 text-gray-900">
                            GitHub Token
                            <a href="https://github.com/settings/tokens/new?scopes=gist" target="_blank" rel="noopener noreferrer" className="text-indigo-600 text-xs hover:underline ml-2">
                                (Lấy GitHub Token với quyền 'gist')
                            </a>
                        </label>
                        <div className="mt-2">
                            <Input id="github-token" type="password" value={githubToken} onChange={(e) => setGithubToken(e.target.value)} placeholder="dán token vào đây"/>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">Cần thiết cho chức năng "Giao bài tập" để lưu dữ liệu đề thi.</p>
                    </div>

                     <div className="sm:col-span-3">
                        <label htmlFor="script-url" className="block text-sm font-medium leading-6 text-gray-900">Google Script Web App URL</label>
                        <div className="mt-2">
                             <Input id="script-url" value={scriptUrl} onChange={(e) => setScriptUrl(e.target.value)} />
                        </div>
                    </div>
                     <div className="sm:col-span-3">
                        <label htmlFor="sheet-url" className="block text-sm font-medium leading-6 text-gray-900">Link Google Sheet (xem KQ)</label>
                        <div className="mt-2">
                             <Input id="sheet-url" value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} />
                        </div>
                    </div>

                    <div className="sm:col-span-full">
                        <label htmlFor="teacher-name" className="block text-sm font-medium leading-6 text-gray-900">Tên Giáo Viên</label>
                        <div className="mt-2">
                             <Input id="teacher-name" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-end gap-x-6">
                {saved && <span className="text-sm text-green-600">Đã lưu thành công!</span>}
                <button
                    onClick={handleSave}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                    Lưu Cấu Hình
                </button>
            </div>
        </div>
    );
};

export default SystemConfig;