import React from 'react';
import type { ParsedQuestion } from '../types';
import MathText from './MathText';

interface ExamMatrixViewProps {
    questions: ParsedQuestion[];
}

const LEVELS = ['Nhận biết', 'Thông hiểu', 'Vận dụng', 'Vận dụng cao'];
const LEVEL_HEADERS = ['Nhận', 'Thông', 'Vận', 'Vận.C'];

const TYPES = ['multiple_choice', 'true_false', 'short_answer', 'essay'];
const TYPE_HEADERS = ['TNKQ', 'Đúng-Sai', 'Trả lời ngắn', 'Tự luận'];

interface MatrixRow {
    chapter: string;
    topic: string;
    counts: { [type: string]: { [level: string]: number } };
    topicTotal: number;
}

const ExamMatrixView: React.FC<ExamMatrixViewProps> = ({ questions }) => {
    
    const matrixData = React.useMemo(() => {
        const rowsByTopic: { [key: string]: MatrixRow } = {};

        questions.forEach(q => {
            const topicKey = `${q.chapter || 'Không xác định'} - ${q.topic || 'Không xác định'}`;
            if (!rowsByTopic[topicKey]) {
                rowsByTopic[topicKey] = {
                    chapter: q.chapter || 'Không xác định',
                    topic: q.topic || 'Không xác định',
                    counts: {},
                    topicTotal: 0,
                };
                TYPES.forEach(type => {
                    rowsByTopic[topicKey].counts[type] = {};
                    LEVELS.forEach(level => {
                        rowsByTopic[topicKey].counts[type][level] = 0;
                    });
                });
            }

            const row = rowsByTopic[topicKey];
            if (q.question_type && q.level) {
                 if (row.counts[q.question_type] && typeof row.counts[q.question_type][q.level] === 'number') {
                    row.counts[q.question_type][q.level]++;
                    row.topicTotal++;
                }
            }
        });

        const groupedByChapter: { [chapter: string]: MatrixRow[] } = {};
        Object.values(rowsByTopic).forEach(row => {
            if (!groupedByChapter[row.chapter]) {
                groupedByChapter[row.chapter] = [];
            }
            groupedByChapter[row.chapter].push(row);
        });

        return groupedByChapter;
    }, [questions]);

    const totals = React.useMemo(() => {
        const levelTotals: { [level: string]: number } = {};
        const typeTotals: { [type: string]: { [level: string]: number } } = {};
        let grandTotal = 0;
        
        LEVELS.forEach(l => levelTotals[l] = 0);
        TYPES.forEach(t => {
            typeTotals[t] = {};
            LEVELS.forEach(l => typeTotals[t][l] = 0);
        });
        
        questions.forEach(q => {
            if (q.question_type && q.level) {
                typeTotals[q.question_type][q.level]++;
                levelTotals[q.level]++;
                grandTotal++;
            }
        });

        return { levelTotals, typeTotals, grandTotal };
    }, [questions]);

    if (!questions || questions.length === 0) {
        return (
            <div className="bg-white p-6 rounded-xl shadow-xl border border-slate-200/80 mt-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Ma trận đề thi / Bảng đặc tả</h3>
                <p className="text-gray-600">Không có dữ liệu câu hỏi để hiển thị ma trận. Vui lòng đảm bảo đề thi đã được tạo thành công.</p>
            </div>
        )
    }

    return (
        <div className="bg-white p-6 rounded-xl shadow-xl border border-slate-200/80 mt-6 overflow-x-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Ma trận đề thi / Bảng đặc tả</h3>
            <table className="min-w-full divide-y divide-gray-200 border border-gray-300 text-sm">
                <thead className="bg-gray-50 text-center font-semibold">
                    <tr>
                        <th rowSpan={3} className="border p-2 align-middle">TT</th>
                        <th rowSpan={3} className="border p-2 align-middle">Chương/Chủ đề</th>
                        <th rowSpan={3} className="border p-2 align-middle">Nội dung/Đơn vị kiến thức</th>
                        <th colSpan={TYPE_HEADERS.length * LEVEL_HEADERS.length} className="border p-2">Mức độ nhận thức</th>
                        <th rowSpan={3} className="border p-2 align-middle">Tổng cộng</th>
                    </tr>
                    <tr>
                        {TYPE_HEADERS.map(header => (
                            <th key={header} colSpan={LEVEL_HEADERS.length} className="border p-2">{header}</th>
                        ))}
                    </tr>
                    <tr>
                        {TYPE_HEADERS.map(typeHeader => 
                            LEVEL_HEADERS.map(levelHeader => (
                                <th key={`${typeHeader}-${levelHeader}`} className="border p-2 font-normal">{levelHeader}</th>
                            ))
                        )}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {Object.keys(matrixData).map((chapter, chapterIndex) => {
                        const topics = matrixData[chapter];
                        return (
                            <React.Fragment key={chapter}>
                                {topics.map((row, topicIndex) => (
                                    <tr key={row.topic}>
                                        {topicIndex === 0 && (
                                            <td rowSpan={topics.length} className="border p-2 text-center font-semibold align-top">{chapterIndex + 1}</td>
                                        )}
                                        {topicIndex === 0 && (
                                            <td rowSpan={topics.length} className="border p-2 font-semibold align-top"><MathText text={chapter} /></td>
                                        )}
                                        <td className="border p-2"><MathText text={row.topic} /></td>
                                        {TYPES.map(type => 
                                            LEVELS.map(level => (
                                                <td key={`${type}-${level}`} className="border p-2 text-center">
                                                    {row.counts[type]?.[level] > 0 ? row.counts[type][level] : ''}
                                                </td>
                                            ))
                                        )}
                                        <td className="border p-2 text-center font-bold">{row.topicTotal}</td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        );
                    })}
                    <tr className="bg-gray-100 font-bold text-center">
                        <td colSpan={3} className="border p-2">Tổng</td>
                        {TYPES.map(type => 
                            LEVELS.map(level => (
                                <td key={`total-${type}-${level}`} className="border p-2">
                                    {totals.typeTotals[type]?.[level] > 0 ? totals.typeTotals[type][level] : ''}
                                </td>
                            ))
                        )}
                        <td className="border p-2">{totals.grandTotal}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

export default ExamMatrixView;