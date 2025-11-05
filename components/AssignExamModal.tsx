
import React, { useState } from 'react';
import { SlidersIcon } from './icons';

interface AssignExamModalProps {
  onClose: () => void;
  onAssign: (config: any) => void;
}

const AssignExamModal: React.FC<AssignExamModalProps> = ({ onClose, onAssign }) => {
    const [config, setConfig] = useState({
        title: '',
        timeLimit: 45,
        maxRetries: 1,
        scorePart1: 5,
        scorePart2: 2,
        scorePart3: 2,
        scorePart4: 1,
        trueFalseScoring: 'progressive',
        showAnswers: true,
        showAiExplanation: true,
        allowAiReview: true,
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        
        if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            setConfig(prev => ({ ...prev, [name]: checked }));
        } else {
             setConfig(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) : value }));
        }
    };
    
    const handleSubmit = () => {
        onAssign(config);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
                <div className="p-5 border-b bg-green-600 text-white rounded-t-2xl">
                    <h2 className="text-xl font-bold flex items-center gap-3">
                        <SlidersIcon className="w-6 h-6"/>
                        Tùy chọn Giao bài tập
                    </h2>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* Exam Title */}
                    <div>
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700">Tiêu đề bài thi</label>
                        <input
                            type="text"
                            name="title"
                            id="title"
                            value={config.title}
                            onChange={handleInputChange}
                            placeholder="Ví dụ: Đề kiểm tra 15 phút"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                        <p className="mt-1 text-xs text-gray-500">Để trống để dùng tiêu đề mặc định.</p>
                    </div>

                    {/* Time and Retries */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="timeLimit" className="block text-sm font-medium text-gray-700">Thời gian làm bài (phút)</label>
                            <input
                                type="number"
                                name="timeLimit"
                                id="timeLimit"
                                value={config.timeLimit}
                                onChange={handleInputChange}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                            <p className="mt-1 text-xs text-gray-500">Nhập 0 để không giới hạn thời gian.</p>
                        </div>
                        <div>
                            <label htmlFor="maxRetries" className="block text-sm font-medium text-gray-700">Số lần làm lại tối đa</label>
                            <input
                                type="number"
                                name="maxRetries"
                                id="maxRetries"
                                min="0"
                                value={config.maxRetries}
                                onChange={handleInputChange}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                            <p className="mt-1 text-xs text-gray-500">Số lần học sinh được phép làm lại sau lần đầu tiên. Nhập 0 nghĩa là chỉ được làm bài 1 lần duy nhất.</p>
                        </div>
                    </div>

                    {/* Scoring */}
                    <fieldset className="border-t pt-4">
                        <legend className="text-base font-medium text-gray-900 mb-2">Cài đặt thang điểm (Tổng điểm mặc định là 10)</legend>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                            <div>
                                <label htmlFor="scorePart1" className="block text-xs font-medium text-gray-700">Tổng điểm P.I (TN)</label>
                                <input type="number" name="scorePart1" id="scorePart1" value={config.scorePart1} onChange={handleInputChange} className="mt-1 w-full p-2 border rounded-md"/>
                            </div>
                            <div>
                                <label htmlFor="scorePart2" className="block text-xs font-medium text-gray-700">Tổng điểm P.II (Đúng/Sai)</label>
                                <input type="number" name="scorePart2" id="scorePart2" value={config.scorePart2} onChange={handleInputChange} className="mt-1 w-full p-2 border rounded-md"/>
                            </div>
                            <div>
                                <label htmlFor="scorePart3" className="block text-xs font-medium text-gray-700">Tổng điểm P.III (TL Ngắn)</label>
                                <input type="number" name="scorePart3" id="scorePart3" value={config.scorePart3} onChange={handleInputChange} className="mt-1 w-full p-2 border rounded-md"/>
                            </div>
                            <div>
                                <label htmlFor="scorePart4" className="block text-xs font-medium text-gray-700">Tổng điểm P.IV (Tự luận)</label>
                                <input type="number" name="scorePart4" id="scorePart4" value={config.scorePart4} onChange={handleInputChange} className="mt-1 w-full p-2 border rounded-md"/>
                            </div>
                        </div>
                    </fieldset>
                    
                     {/* True/False Scoring Method */}
                    <div>
                        <label htmlFor="trueFalseScoring" className="block text-sm font-medium text-gray-700">Cách tính điểm cho mỗi câu P.II (Đúng/Sai)</label>
                        <p className="mt-1 text-xs text-gray-500">Mỗi câu Đúng/Sai có 4 ý. Chọn cách tính điểm cho các ý đúng trong 1 câu.</p>
                        <select
                            name="trueFalseScoring"
                            id="trueFalseScoring"
                            value={config.trueFalseScoring}
                            onChange={handleInputChange}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                        >
                            <option value="progressive">Lũy tiến (1ý=10%, 2ý=25%, 3ý=50%, 4ý=100% điểm)</option>
                        </select>
                        <p className="mt-1 text-xs text-gray-500">Điểm mỗi câu = Tổng điểm P.II / Số câu P.II.</p>
                    </div>

                    {/* Checkbox Options */}
                    <div className="space-y-4 border-t pt-4">
                        <div className="relative flex items-start">
                            <div className="flex h-5 items-center">
                                <input id="showAnswers" name="showAnswers" type="checkbox" checked={config.showAnswers} onChange={handleInputChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                            </div>
                            <div className="ml-3 text-sm">
                                <label htmlFor="showAnswers" className="font-medium text-gray-700">Cho xem đáp án đúng</label>
                                <p className="text-xs text-gray-500">Sau khi nộp bài, học sinh có thể thấy điểm và câu trả lời đúng.</p>
                            </div>
                        </div>
                        <div className="relative flex items-start">
                            <div className="flex h-5 items-center">
                                <input id="showAiExplanation" name="showAiExplanation" type="checkbox" checked={config.showAiExplanation} onChange={handleInputChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                            </div>
                            <div className="ml-3 text-sm">
                                <label htmlFor="showAiExplanation" className="font-medium text-gray-700">Cho xem giải thích của AI</label>
                                <p className="text-xs text-gray-500">Hiển thị lời giải chi tiết do AI tạo ra sau khi nộp bài.</p>
                            </div>
                        </div>
                        <div className="relative flex items-start">
                            <div className="flex h-5 items-center">
                                <input id="allowAiReview" name="allowAiReview" type="checkbox" checked={config.allowAiReview} onChange={handleInputChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                            </div>
                            <div className="ml-3 text-sm">
                                <label htmlFor="allowAiReview" className="font-medium text-gray-700">Cho phép AI nhận xét năng lực</label>
                                <p className="text-xs text-gray-500">Sau khi nộp bài, AI sẽ phân tích và đưa ra nhận xét về năng lực của học sinh.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border-t flex justify-end space-x-3 rounded-b-2xl">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2 text-sm font-semibold bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="inline-flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-green-600 rounded-md shadow-sm hover:bg-green-700"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                        Xác nhận & Giao bài
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AssignExamModal;
