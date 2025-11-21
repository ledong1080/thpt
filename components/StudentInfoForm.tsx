
import React, { useState } from 'react';

interface StudentInfoFormProps {
    teacherName: string;
    onSubmit: (info: { name: string; studentClass: string; code: string }) => void;
    error?: string | null;
}

const StudentInfoForm: React.FC<StudentInfoFormProps> = ({ teacherName, onSubmit, error }) => {
    const [name, setName] = useState('');
    const [studentClass, setStudentClass] = useState('');
    const [code, setCode] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim() && studentClass.trim() && code.trim()) {
            onSubmit({ name, studentClass, code });
        }
    };
    
    const isButtonDisabled = !name.trim() || !studentClass.trim() || !code.trim();

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 border border-slate-200/80">
                <h2 className="text-3xl font-bold text-center text-gray-800">Thông Tin Học Sinh</h2>
                <p className="text-center text-gray-500 mt-2 mb-8">Vui lòng nhập để bắt đầu làm bài.</p>
                
                <form onSubmit={handleSubmit}>
                    <div className="space-y-6">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
                            <input
                                type="text"
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        <div>
                            <label htmlFor="studentClass" className="block text-sm font-medium text-gray-700 mb-1">Lớp</label>
                            <input
                                type="text"
                                id="studentClass"
                                value={studentClass}
                                onChange={(e) => setStudentClass(e.target.value)}
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        <div>
                            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">Mã đề</label>
                            <input
                                type="text"
                                id="code"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                required
                                placeholder="Nhập mã đề giáo viên cung cấp"
                                className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Giáo viên:</label>
                            <div className="mt-1 w-full p-3 bg-gray-100 border border-gray-200 rounded-md text-gray-700 font-medium">
                                {teacherName}
                            </div>
                        </div>
                        
                        {error && <p className="text-sm text-red-600 text-center font-medium bg-red-50 p-3 rounded-md border border-red-200">{error}</p>}
                        
                        <button
                            type="submit"
                            disabled={isButtonDisabled}
                            className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            Bắt đầu làm bài
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StudentInfoForm;
