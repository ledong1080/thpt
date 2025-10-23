import React, { useState, useEffect } from 'react';
import type { ParsedQuestion, TrueFalseStatement } from '../types';

interface EditQuestionModalProps {
  question: ParsedQuestion;
  onSave: (updatedQuestion: ParsedQuestion) => void;
  onCancel: () => void;
}

const EditQuestionModal: React.FC<EditQuestionModalProps> = ({ question, onSave, onCancel }) => {
  const [editedQuestion, setEditedQuestion] = useState<ParsedQuestion>({ ...question });

  useEffect(() => {
    // Ensure statements is an array for true/false questions
    const initialQuestion = { ...question };
    if (initialQuestion.question_type === 'true_false' && !initialQuestion.statements) {
        initialQuestion.statements = [];
    }
    setEditedQuestion(initialQuestion);
  }, [question]);
  
  const handleQuestionTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedQuestion(prev => ({ ...prev, question_text: e.target.value }));
  };

  const handleOptionTextChange = (index: number, value: string) => {
    const newOptions = [...(editedQuestion.options || [])];
    newOptions[index] = value;
    setEditedQuestion(prev => ({ ...prev, options: newOptions }));
  };
  
  const handleCorrectAnswerChange = (index: number) => {
    setEditedQuestion(prev => ({ ...prev, correct_answer_index: index }));
  };

  const handleStatementTextChange = (index: number, value: string) => {
      const newStatements = [...(editedQuestion.statements || [])];
      newStatements[index] = { ...newStatements[index], text: value };
      setEditedQuestion(prev => ({ ...prev, statements: newStatements }));
  };
  
  const handleStatementTruthChange = (index: number) => {
      const newStatements = [...(editedQuestion.statements || [])];
      newStatements[index] = { ...newStatements[index], is_true: !newStatements[index].is_true };
      setEditedQuestion(prev => ({ ...prev, statements: newStatements }));
  };

  const handleSaveChanges = () => {
    onSave(editedQuestion);
  };

  const renderMultipleChoiceEditor = () => (
     <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Đáp án:</label>
        <div className="space-y-4">
          {editedQuestion.options?.map((option, index) => (
            <div key={index} className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg border">
              <input
                type="radio"
                name="correct-answer"
                checked={editedQuestion.correct_answer_index === index}
                onChange={() => handleCorrectAnswerChange(index)}
                className="h-5 w-5 mt-1 text-indigo-600 focus:ring-indigo-500 border-gray-300"
              />
              <div className="flex-grow">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => handleOptionTextChange(index, e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
                />
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center text-gray-400 mt-2">
                   Chưa có ảnh
                </div>
                 <div className="mt-2 space-x-2">
                    <button className="px-3 py-1 text-xs bg-white border rounded hover:bg-gray-100">Dán ảnh</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
  );

  const renderTrueFalseEditor = () => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Các mệnh đề:</label>
        <div className="space-y-4">
          {editedQuestion.statements?.map((statement, index) => (
            <div key={index} className="p-4 bg-gray-50 rounded-lg border">
                <textarea
                  rows={2}
                  value={statement.text}
                  onChange={(e) => handleStatementTextChange(index, e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
                 <div className="flex items-center space-x-4 mt-2">
                    <span className="text-sm font-medium">Giá trị:</span>
                    <button 
                        onClick={() => handleStatementTruthChange(index)}
                        className={`px-4 py-1 rounded-md text-sm font-semibold ${statement.is_true ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'}`}
                    >
                        Đúng
                    </button>
                    <button 
                        onClick={() => handleStatementTruthChange(index)}
                         className={`px-4 py-1 rounded-md text-sm font-semibold ${!statement.is_true ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700'}`}
                    >
                        Sai
                    </button>
                </div>
            </div>
          ))}
        </div>
      </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b">
          <h2 className="text-xl font-bold text-gray-800">Chỉnh sửa câu hỏi</h2>
        </div>
        <div className="p-6 space-y-6 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hình ảnh câu hỏi</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
              Chưa có ảnh
            </div>
            <div className="mt-2 space-x-2">
              <button className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300">Tải ảnh lên</button>
              <button className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300">Dán ảnh</button>
            </div>
          </div>

          <div>
            <label htmlFor="question-text" className="block text-sm font-medium text-gray-700 mb-1">Nội dung câu hỏi</label>
            <textarea
              id="question-text"
              rows={4}
              value={editedQuestion.question_text}
              onChange={handleQuestionTextChange}
              className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {editedQuestion.question_type === 'true_false' ? renderTrueFalseEditor() : renderMultipleChoiceEditor()}
        </div>
        <div className="p-4 bg-gray-50 border-t flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-6 py-2 text-sm font-semibold bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
          >
            Hủy
          </button>
          <button
            onClick={handleSaveChanges}
            className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700"
          >
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditQuestionModal;