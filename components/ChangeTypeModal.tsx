import React, { useState } from 'react';
import type { ParsedQuestion } from '../types';
import { QUESTION_TYPES } from '../constants';

interface ChangeTypeModalProps {
  question: ParsedQuestion;
  onConvert: (newType: string) => void;
  onCancel: () => void;
}

const questionTypeNameMap: { [key: string]: string } = {
    'multiple_choice': 'Trắc nghiệm',
    'true_false': 'Đúng/Sai',
    'short_answer': 'Trả lời ngắn',
    'essay': 'Tự luận'
};

const ChangeTypeModal: React.FC<ChangeTypeModalProps> = ({ question, onConvert, onCancel }) => {
  const [selectedType, setSelectedType] = useState<string>('');
  const currentTypeDisplay = questionTypeNameMap[question.question_type];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md">
        <div className="p-5 border-b">
          <h2 className="text-xl font-bold text-gray-800">Đổi dạng câu hỏi</h2>
          <p className="text-sm text-gray-500 mt-1">Dạng hiện tại: <span className="font-semibold">{currentTypeDisplay}</span></p>
        </div>
        <div className="p-6">
          <p className="font-medium text-gray-700 mb-3">Chọn dạng câu hỏi mới:</p>
          <div className="space-y-2">
            {QUESTION_TYPES.map(type => (
              <label
                key={type}
                className={`flex items-center p-3 rounded-md border-2 cursor-pointer transition-all ${
                  selectedType === type ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300'
                } ${type === currentTypeDisplay ? 'opacity-50 cursor-not-allowed' : 'hover:border-indigo-400'}`}
              >
                <input
                  type="radio"
                  name="question-type"
                  value={type}
                  checked={selectedType === type}
                  onChange={() => setSelectedType(type)}
                  disabled={type === currentTypeDisplay}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                />
                <span className={`ml-3 font-medium ${selectedType === type ? 'text-indigo-900' : 'text-gray-800'}`}>{type}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="p-4 bg-gray-50 border-t flex justify-end space-x-3">
          <button onClick={onCancel} className="px-6 py-2 text-sm font-semibold bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">Hủy</button>
          <button
            onClick={() => onConvert(selectedType)}
            disabled={!selectedType || selectedType === currentTypeDisplay}
            className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangeTypeModal;
