import React, { useState } from 'react';
import type { ParsedQuestion } from '../types';

interface LatexEditModalProps {
  question: ParsedQuestion;
  onSave: (updatedQuestion: ParsedQuestion) => void;
  onCancel: () => void;
}

const LatexEditModal: React.FC<LatexEditModalProps> = ({ question, onSave, onCancel }) => {
  const [editedQuestion, setEditedQuestion] = useState<ParsedQuestion>({ ...question });

  const handleTextChange = (field: keyof ParsedQuestion, value: string) => {
    setEditedQuestion(prev => ({ ...prev, [field]: value }));
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...(editedQuestion.options || [])];
    newOptions[index] = value;
    setEditedQuestion(prev => ({ ...prev, options: newOptions }));
  };

  const handleStatementChange = (index: number, value: string) => {
    const newStatements = JSON.parse(JSON.stringify(editedQuestion.statements || []));
    newStatements[index].text = value;
    setEditedQuestion(prev => ({ ...prev, statements: newStatements }));
  };

  const renderContent = () => {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung câu hỏi (question_text)</label>
          <textarea
            rows={4}
            value={editedQuestion.question_text}
            onChange={(e) => handleTextChange('question_text', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm font-mono text-sm"
          />
        </div>

        {editedQuestion.question_type === 'multiple_choice' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Các lựa chọn (options)</label>
            <div className="space-y-2">
              {editedQuestion.options?.map((option, index) => (
                <textarea
                  key={index}
                  rows={2}
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md shadow-sm font-mono text-sm"
                />
              ))}
            </div>
          </div>
        )}

        {editedQuestion.question_type === 'true_false' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Các mệnh đề (statements)</label>
            <div className="space-y-2">
              {editedQuestion.statements?.map((statement, index) => (
                <textarea
                  key={index}
                  rows={2}
                  value={statement.text}
                  onChange={(e) => handleStatementChange(index, e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md shadow-sm font-mono text-sm"
                />
              ))}
            </div>
          </div>
        )}

        {(editedQuestion.question_type === 'short_answer' || editedQuestion.question_type === 'essay') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Đáp án gợi ý (suggested_answer)</label>
            <textarea
              rows={4}
              value={editedQuestion.suggested_answer || ''}
              onChange={(e) => handleTextChange('suggested_answer', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md shadow-sm font-mono text-sm"
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b">
          <h2 className="text-xl font-bold text-gray-800">Chỉnh sửa nội dung và mã LaTeX</h2>
        </div>
        <div className="p-6 overflow-y-auto">
          {renderContent()}
        </div>
        <div className="p-4 bg-gray-50 border-t flex justify-end space-x-3">
          <button onClick={onCancel} className="px-6 py-2 text-sm font-semibold bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">Hủy</button>
          <button onClick={() => onSave(editedQuestion)} className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700">Lưu</button>
        </div>
      </div>
    </div>
  );
};

export default LatexEditModal;
