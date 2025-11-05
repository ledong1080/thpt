
import React, { useState, useMemo } from 'react';
import { MixIcon } from './icons';

interface ShuffleExamsModalProps {
  onClose: () => void;
  onShuffle: (options: { title: string; count: number; codes: string[] }) => void;
}

const ShuffleExamsModal: React.FC<ShuffleExamsModalProps> = ({ onClose, onShuffle }) => {
  const [title, setTitle] = useState('');
  const [count, setCount] = useState(4);
  const [codesStr, setCodesStr] = useState('');

  const codes = useMemo(() => codesStr.split(',').map(c => c.trim()).filter(c => c), [codesStr]);

  const isInputValid = useMemo(() => {
    if (codes.length > 0) {
      return count > 0 && count === codes.length;
    }
    return count > 0;
  }, [count, codes]);

  const handleSubmit = () => {
    if (isInputValid) {
      let finalCodes = codes;
      if (finalCodes.length === 0 && count > 0) {
        finalCodes = Array.from({ length: count }, (_, i) => String((i + 1) * 111));
      }
      onShuffle({ title, count: count, codes: finalCodes });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b bg-teal-600 text-white rounded-t-2xl">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <MixIcon className="w-6 h-6" />
            Tùy chọn Trộn đề & Xuất Word
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="shuffle-title" className="block text-sm font-medium text-gray-700">Tiêu đề chung cho các đề</label>
            <input
              type="text"
              id="shuffle-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Đề kiểm tra 15 phút"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="shuffle-count" className="block text-sm font-medium text-gray-700">Số lượng đề cần trộn</label>
            <input
              type="number"
              id="shuffle-count"
              min="1"
              value={count}
              onChange={(e) => setCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="shuffle-codes" className="block text-sm font-medium text-gray-700">Danh sách mã đề (cách nhau bởi dấu phẩy)</label>
            <textarea
              id="shuffle-codes"
              rows={3}
              value={codesStr}
              onChange={(e) => setCodesStr(e.target.value)}
              placeholder="Ví dụ: 132, 209, 357, 484 (để trống sẽ tự sinh)"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
             <p className={`mt-1 text-xs ${!codesStr.trim() || count === codes.length ? 'text-gray-500' : 'text-red-600'}`}>
              {codesStr.trim() && count !== codes.length
                ? `Số lượng mã đề (${codes.length}) phải bằng số lượng đề cần trộn (${count}).`
                : 'Nếu để trống, mã đề sẽ được sinh tự động theo dạng: 111, 222,...'
              }
            </p>
          </div>
        </div>
        <div className="p-4 bg-gray-50 border-t flex justify-end space-x-3 rounded-b-2xl">
          <button onClick={onClose} className="px-6 py-2 text-sm font-semibold bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">Hủy</button>
          <button
            onClick={handleSubmit}
            disabled={!isInputValid}
            className="px-6 py-2 text-sm font-semibold text-white bg-teal-600 rounded-md shadow-sm hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Bắt đầu Trộn đề
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShuffleExamsModal;
