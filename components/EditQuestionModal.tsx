import React, { useState, useEffect, useRef } from 'react';
import type { ParsedQuestion, TrueFalseStatement } from '../types';

// Helper function to convert file to base64 data URL
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

interface EditQuestionModalProps {
  question: ParsedQuestion;
  onSave: (updatedQuestion: ParsedQuestion) => void;
  onCancel: () => void;
}

const EditQuestionModal: React.FC<EditQuestionModalProps> = ({ question, onSave, onCancel }) => {
  const [editedQuestion, setEditedQuestion] = useState<ParsedQuestion>({ ...question });
  
  // State and refs for image handling
  const [pasteTarget, setPasteTarget] = useState<'question' | `option_${number}` | null>(null);
  const questionImageInputRef = useRef<HTMLInputElement>(null);
  const optionImageInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const initialQuestion = { ...question };
    if (initialQuestion.question_type === 'true_false' && !initialQuestion.statements) {
        initialQuestion.statements = [];
    }
    // Ensure option_images array exists and has the correct length for MCQs
    if (initialQuestion.question_type === 'multiple_choice') {
      const numOptions = initialQuestion.options?.length || 4;
      const currentImages = initialQuestion.option_images || [];
      if (currentImages.length !== numOptions) {
        initialQuestion.option_images = Array(numOptions).fill(null).map((_, i) => currentImages[i] || null);
      }
    }
    setEditedQuestion(initialQuestion);
  }, [question]);
  
  // Effect to handle clipboard paste events globally when a paste target is active
  useEffect(() => {
    if (!pasteTarget) return;

    const handlePaste = async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            event.preventDefault();
            const base64 = await fileToBase64(blob as File);

            if (pasteTarget === 'question') {
              setEditedQuestion(prev => ({ ...prev, question_image: base64 }));
            } else if (pasteTarget.startsWith('option_')) {
              const index = parseInt(pasteTarget.split('_')[1], 10);
              setEditedQuestion(prev => {
                const newOptionImages = [...(prev.option_images || [])];
                newOptionImages[index] = base64;
                return { ...prev, option_images: newOptionImages };
              });
            }
            setPasteTarget(null); // Deactivate after successful paste
            break; 
          }
        }
      }
    };
    
    window.addEventListener('paste', handlePaste);
    
    // Cleanup function to remove the event listener
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [pasteTarget]);

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
  
  const handleSuggestedAnswerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedQuestion(prev => ({ ...prev, suggested_answer: e.target.value }));
  };

  const handleSaveChanges = () => {
    onSave(editedQuestion);
  };

  // Generic handler for file input changes
  const handleImageFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>, 
    updateState: (base64: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      try {
        const base64 = await fileToBase64(file);
        updateState(base64);
      } catch (error) {
        console.error("Error converting file to base64:", error);
      }
    }
    if (e.target) e.target.value = '';
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
                <div className="mt-2">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center text-gray-500 min-h-[100px] flex items-center justify-center relative bg-white">
                        {editedQuestion.option_images?.[index] ? (
                            <>
                                <img src={editedQuestion.option_images[index]!} alt={`Option ${index+1}`} className="max-h-32 max-w-full object-contain" />
                                <button
                                    type="button"
                                    onClick={() => setEditedQuestion(prev => {
                                        const newImages = [...(prev.option_images || [])];
                                        newImages[index] = null;
                                        return {...prev, option_images: newImages};
                                    })}
                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs leading-none hover:bg-red-600"
                                    aria-label="Xóa ảnh"
                                >
                                    &#x2715;
                                </button>
                            </>
                        ) : (
                            <span>{pasteTarget === `option_${index}` ? 'Sẵn sàng dán ảnh (Ctrl+V)...' : 'Chưa có ảnh'}</span>
                        )}
                    </div>
                     <div className="mt-2 space-x-2">
                        <button type="button" onClick={() => optionImageInputRefs.current[index]?.click()} className="px-3 py-1 text-xs bg-white border rounded hover:bg-gray-100">Tải ảnh lên</button>
                        <button type="button" onClick={() => setPasteTarget(`option_${index}`)} className="px-3 py-1 text-xs bg-white border rounded hover:bg-gray-100">Dán ảnh</button>
                        {/* FIX: The ref callback for an array of refs should not return a value. Encapsulating the assignment in a block fixes the TypeScript error. */}
                        <input type="file" ref={el => {optionImageInputRefs.current[index] = el;}} onChange={e => handleImageFileChange(e, base64 => setEditedQuestion(prev => {
                            const newImages = [...(prev.option_images || [])];
                            newImages[index] = base64;
                            return {...prev, option_images: newImages};
                        }))} accept="image/*" className="hidden" />
                    </div>
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
  
  const renderShortAnswerAndEssayEditor = () => (
    <div>
        <label htmlFor="suggested-answer" className="block text-sm font-medium text-gray-700 mb-1">Đáp án gợi ý / Dàn ý</label>
        <textarea
          id="suggested-answer"
          rows={5}
          value={editedQuestion.suggested_answer || ''}
          onChange={handleSuggestedAnswerChange}
          className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          placeholder={editedQuestion.question_type === 'short_answer' ? "Nhập đáp án ngắn gọn..." : "Nhập dàn ý chi tiết hoặc đáp án mẫu..."}
        />
    </div>
  );
  
  const renderEditorContent = () => {
      switch(editedQuestion.question_type) {
          case 'multiple_choice':
              return renderMultipleChoiceEditor();
          case 'true_false':
              return renderTrueFalseEditor();
          case 'short_answer':
          case 'essay':
              return renderShortAnswerAndEssayEditor();
          default:
              return null;
      }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b">
          <h2 className="text-xl font-bold text-gray-800">Chỉnh sửa câu hỏi</h2>
        </div>
        <div className="p-6 space-y-6 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hình ảnh câu hỏi</label>
             <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-500 min-h-[150px] flex items-center justify-center relative">
                {editedQuestion.question_image ? (
                    <>
                        <img src={editedQuestion.question_image} alt="Question" className="max-h-40 max-w-full object-contain" />
                        <button
                            type="button"
                            onClick={() => setEditedQuestion(prev => ({...prev, question_image: undefined}))}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm leading-none hover:bg-red-600"
                            aria-label="Xóa ảnh"
                        >
                            &#x2715;
                        </button>
                    </>
                ) : (
                    <span>{pasteTarget === 'question' ? 'Sẵn sàng dán ảnh (Ctrl+V)...' : 'Chưa có ảnh'}</span>
                )}
            </div>
            <div className="mt-2 space-x-2">
              <button type="button" onClick={() => questionImageInputRef.current?.click()} className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300">Tải ảnh lên</button>
              <button type="button" onClick={() => setPasteTarget('question')} className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300">Dán ảnh</button>
              <input type="file" ref={questionImageInputRef} onChange={e => handleImageFileChange(e, base64 => setEditedQuestion(prev => ({...prev, question_image: base64})))} accept="image/*" className="hidden" />
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

          {renderEditorContent()}
          
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