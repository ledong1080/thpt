import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SUBJECTS, GRADES, ALL_CURRICULUM, QUESTION_LEVELS, QUESTION_TYPES } from '../constants';
import type { Chapter, Topic, LearningObjective, QuestionRequest, ParsedExam, FullCurriculum, GradeCurriculum, TopicDetails, SubjectCurriculum } from '../types';
import { SparklesIcon, PlusIcon, TrashIcon, DragHandleIcon, PencilIcon } from './icons';
import { generateExam, extractGenericTextFromPdf } from '../services/geminiService';
import ExamResultView from './ExamResultView';
import MathText from './MathText';
import Accordion from './Accordion';
import * as mammoth from 'mammoth';

interface CreateBySelectionFormProps {
    onBack: () => void;
}

const CustomSelect: React.FC<{ value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; options: string[]; label: string; }> = ({ value, onChange, options, label }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <select value={value} onChange={onChange} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
    </div>
);

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = (reader.result as string).split(',')[1];
            if (result) {
                resolve(result);
            } else {
                reject(new Error("Failed to read file as base64."));
            }
        };
        reader.onerror = error => reject(error);
    });
};


const CreateBySelectionForm: React.FC<CreateBySelectionFormProps> = ({ onBack }) => {
    const [view, setView] = useState<'form' | 'generating' | 'result' | 'error'>('form');
    const [generatedExam, setGeneratedExam] = useState<ParsedExam | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Accordion state
    const [openAccordion, setOpenAccordion] = useState<number | null>(1);
    const toggleAccordion = (index: number) => {
        setOpenAccordion(openAccordion === index ? null : index);
    };

    // Curriculum state
    const [curriculumData, setCurriculumData] = useState<SubjectCurriculum>(ALL_CURRICULUM);
    const [isUsingCustomData, setIsUsingCustomData] = useState(false);

    // Form state
    const [subject, setSubject] = useState(SUBJECTS[0]);
    const [grade, setGrade] = useState(GRADES[4]); // Default to Lớp 10
    const [selectedChapterNames, setSelectedChapterNames] = useState<string[]>([]);
    const [selectedTopicNames, setSelectedTopicNames] = useState<string[]>([]);
    const [learningObjectives, setLearningObjectives] = useState<LearningObjective[]>([]);
    const [selectedObjectives, setSelectedObjectives] = useState<Set<string>>(new Set());
    const [editingObjective, setEditingObjective] = useState<{ id: string; text: string } | null>(null);

    const [newObjectiveText, setNewObjectiveText] = useState('');
    const [questionRequests, setQuestionRequests] = useState<QuestionRequest[]>([]);
    const [supplementaryFile, setSupplementaryFile] = useState<File | null>(null);

    // Question request form state
    const [reqCount, setReqCount] = useState(5);
    const [reqType, setReqType] = useState(QUESTION_TYPES[0]);
    const [reqLevel, setReqLevel] = useState(QUESTION_LEVELS[0]);
    const [reqTopic, setReqTopic] = useState<string>('');
    const [reqDetails, setReqDetails] = useState('');

    useEffect(() => {
        try {
            const savedCurriculum = localStorage.getItem('customCurriculum');
            if (savedCurriculum) {
                setCurriculumData(JSON.parse(savedCurriculum));
                setIsUsingCustomData(true);
            } else {
                setCurriculumData(ALL_CURRICULUM);
                setIsUsingCustomData(false);
            }
        } catch (e) {
            console.error("Failed to load curriculum from localStorage", e);
            setCurriculumData(ALL_CURRICULUM);
            setIsUsingCustomData(false);
        }
    }, []);
    
    const currentSubjectData = useMemo(() => curriculumData[subject] || {}, [curriculumData, subject]);
    const gradeNumber = useMemo(() => grade.match(/\d+/)?.[0] || '10', [grade]);
    const currentGradeData = useMemo(() => currentSubjectData[gradeNumber] || {}, [currentSubjectData, gradeNumber]);


    const memoizedChapters = useMemo((): Chapter[] => {
        const chaptersMap = new Map<string, Topic[]>();
        Object.entries(currentGradeData).forEach(([topicName, topicDetails]) => {
            const chapterName = (topicDetails as TopicDetails).chapter;
            if (!chaptersMap.has(chapterName)) {
                chaptersMap.set(chapterName, []);
            }
            chaptersMap.get(chapterName)!.push({ id: topicName, name: topicName });
        });
        return Array.from(chaptersMap.entries()).map(([name, topics], index) => ({
            id: `ch_${gradeNumber}_${index}`,
            name,
            topics,
        }));
    }, [currentGradeData, gradeNumber]);

    useEffect(() => {
        setSelectedChapterNames([]);
        setSelectedTopicNames([]);
    }, [grade, curriculumData, subject]);

    useEffect(() => {
        if (!currentGradeData) return;
        const newObjectives = selectedTopicNames.flatMap(topicName => {
            const topicDetails = currentGradeData[topicName];
            return topicDetails?.objectives.map((text, index) => ({
                id: `lo_${topicName}_${index}`,
                text
            })) || [];
        });
        setLearningObjectives(newObjectives);
        setSelectedObjectives(new Set(newObjectives.map(obj => obj.id)));
    }, [selectedTopicNames, currentGradeData]);


    const availableTopics = useMemo(() => {
        if (selectedChapterNames.length === 0) return [];
        return memoizedChapters
            .filter(c => selectedChapterNames.includes(c.name))
            .flatMap(c => c.topics);
    }, [selectedChapterNames, memoizedChapters]);
    
    useEffect(() => {
        // Auto-select the first topic if none is selected or the selected one is no longer valid
        if (selectedTopicNames.length > 0 && !selectedTopicNames.includes(reqTopic)) {
            setReqTopic(selectedTopicNames[0]);
        } else if (selectedTopicNames.length === 0) {
            setReqTopic('');
        }
    }, [selectedTopicNames, reqTopic]);

    const handleChapterToggle = (chapterName: string) => {
        const isSelected = selectedChapterNames.includes(chapterName);
        const newSelectedChapters = isSelected
            ? selectedChapterNames.filter(name => name !== chapterName)
            : [...selectedChapterNames, chapterName];
        setSelectedChapterNames(newSelectedChapters);

        // When a chapter is un-checked, un-check all its topics as well.
        if (isSelected) {
            const chapterTopics = memoizedChapters.find(c => c.name === chapterName)?.topics.map(t => t.name) || [];
            const newSelectedTopics = selectedTopicNames.filter(name => !chapterTopics.includes(name));
            setSelectedTopicNames(newSelectedTopics);
        }
        // When a chapter is checked, do nothing to the topics. Let the user select them.
    };
    
    const handleTopicToggle = (topicName: string) => {
        setSelectedTopicNames(prev => prev.includes(topicName) ? prev.filter(name => name !== topicName) : [...prev, topicName]);
    };

    const handleObjectiveCheckboxChange = (id: string) => {
        setSelectedObjectives(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };
    
    const handleStartEditObjective = (objective: LearningObjective) => {
        setEditingObjective({ id: objective.id, text: objective.text });
    };

    const handleSaveEditObjective = () => {
        if (!editingObjective) return;
        setLearningObjectives(prev =>
            prev.map(obj =>
                obj.id === editingObjective.id ? { ...obj, text: editingObjective.text } : obj
            )
        );
        setEditingObjective(null);
    };

    const handleCancelEditObjective = () => {
        setEditingObjective(null);
    };
    
    const handleAddObjective = () => {
        if (newObjectiveText.trim()) {
            const newId = `lo_manual_${Date.now()}`;
            setLearningObjectives(prev => [...prev, { id: newId, text: newObjectiveText.trim() }]);
            setSelectedObjectives(prev => new Set(prev).add(newId));
            setNewObjectiveText('');
        }
    };
    
    const handleDeleteObjective = (id: string) => {
        setLearningObjectives(prev => prev.filter(obj => obj.id !== id));
        setSelectedObjectives(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
        });
        if (editingObjective?.id === id) {
            setEditingObjective(null);
        }
    };

    const handleAddRequest = () => {
        if (!reqTopic) {
            alert("Vui lòng chọn một chủ đề để thêm yêu cầu câu hỏi.");
            return;
        }
        const newRequest: QuestionRequest = {
            id: `req_${Date.now()}`,
            count: reqCount,
            type: reqType,
            level: reqLevel,
            topic: reqTopic,
            details: reqDetails
        };
        setQuestionRequests(prev => [...prev, newRequest]);
    };
    
    const handleDeleteRequest = (id: string) => {
        setQuestionRequests(prev => prev.filter(req => req.id !== id));
    };
    
    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };
    
     const handleDownloadCurriculum = () => {
        const jsonString = JSON.stringify(curriculumData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'chuong-trinh-hoc.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const data = JSON.parse(text);
                // Basic validation
                if (typeof data === 'object' && data !== null && Object.keys(data).length > 0) {
                     setCurriculumData(data);
                     setIsUsingCustomData(true);
                     localStorage.setItem('customCurriculum', text);
                     alert('Tải lên chương trình học thành công!');
                } else {
                    throw new Error("Invalid JSON structure.");
                }
            } catch (error) {
                alert('Tệp JSON không hợp lệ hoặc có lỗi khi đọc tệp.');
                console.error(error);
            }
        };
        reader.readAsText(file);
    };

    const handleRestoreDefault = () => {
        if (window.confirm("Bạn có chắc chắn muốn khôi phục chương trình học mặc định không? Mọi dữ liệu đã tải lên sẽ bị xóa.")) {
            localStorage.removeItem('customCurriculum');
            setCurriculumData(ALL_CURRICULUM);
            setIsUsingCustomData(false);
            alert('Đã khôi phục chương trình học mặc định.');
        }
    };


    const handleGenerateExam = async () => {
        const apiKey = localStorage.getItem('geminiApiKey');
        if (!apiKey) {
            setError("Vui lòng đặt API Key trong Cấu hình Hệ thống trước.");
            setView('error');
            return;
        }
        if (questionRequests.length === 0) {
            setError("Vui lòng thêm ít nhất một yêu cầu về câu hỏi vào đề thi.");
            return;
        }

        setView('generating');
        setError(null);

        let supplementaryContent: string | undefined;
        if (supplementaryFile) {
            try {
                if (supplementaryFile.type === 'application/pdf') {
                    const base64 = await fileToBase64(supplementaryFile);
                    supplementaryContent = await extractGenericTextFromPdf(base64, apiKey);
                } else if (supplementaryFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                    const arrayBuffer = await supplementaryFile.arrayBuffer();
                    const result = await mammoth.extractRawText({ arrayBuffer });
                    supplementaryContent = result.value;
                } else if (supplementaryFile.type === 'text/plain') {
                    supplementaryContent = await supplementaryFile.text();
                } else {
                    console.warn('Định dạng tệp bổ sung không được hỗ trợ và sẽ được bỏ qua.');
                }
            } catch (e: any) {
                setError(`Lỗi đọc tệp bổ sung: ${e.message}`);
                setView('error');
                return;
            }
        }

        const params = {
            subject,
            grade,
            chapters: selectedChapterNames,
            topics: selectedTopicNames,
            objectives: learningObjectives
                .filter(o => selectedObjectives.has(o.id))
                .map(o => o.text),
            questionRequests,
            supplementaryContent,
        };
        
        try {
            const resultJsonString = await generateExam(params, apiKey);
            const result = JSON.parse(resultJsonString);
            if (result.error) {
                throw new Error(result.error);
            }
            setGeneratedExam({
                questions: result.questions.map((q: any, index: number) => ({ ...q, id: `gq_${index}` }))
            });
            setView('result');
        } catch (e: any) {
            console.error("Error generating exam:", e);
            setError(e.message || "Không thể tạo đề thi. Vui lòng thử lại.");
            setView('error');
        }
    };

    const handleStartNew = () => {
        setGeneratedExam(null);
        setError(null);
        setView('form');
        setQuestionRequests([]);
    };

    if (view === 'generating') {
        return (
             <div className="flex flex-col items-center justify-center p-10 bg-white rounded-2xl shadow-2xl border border-slate-200/80">
                <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-indigo-600"></div>
                <h2 className="mt-6 text-2xl font-semibold text-gray-700">AI đang tạo đề...</h2>
                <p className="mt-2 text-gray-500">Quá trình này có thể mất một vài phút. Vui lòng không rời khỏi trang.</p>
            </div>
        );
    }

    if (view === 'result' && generatedExam) {
        return <ExamResultView examData={generatedExam} onBackToForm={handleStartNew} onStartNew={onBack} />;
    }

    if (view === 'error') {
         return (
            <div className="p-6 bg-white rounded-2xl shadow-2xl border border-red-200/80">
                <h2 className="text-2xl font-bold text-red-700 mb-4">Tạo đề thất bại</h2>
                <div className="prose max-w-none p-4 border rounded-md bg-red-50 text-red-900">{error || "Đã xảy ra lỗi không xác định."}</div>
                <div className="mt-6">
                     <button 
                        onClick={() => setView('form')}
                        className="inline-flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-colors"
                    >
                        Quay lại Form
                    </button>
                </div>
            </div>
        );
    }
    
    return (
        <div className="w-full">
            <button onClick={onBack} className="text-sm text-indigo-600 hover:underline mb-4 inline-flex items-center gap-1">
                &larr; Quay lại trang chủ
            </button>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Accordion 
                        number={1} 
                        title="Chọn Môn học & Lớp"
                        isOpen={openAccordion === 1}
                        onToggle={() => toggleAccordion(1)}
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <CustomSelect label="Môn học" value={subject} onChange={(e) => setSubject(e.target.value)} options={SUBJECTS} />
                            <CustomSelect label="Lớp / Khối" value={grade} onChange={(e) => setGrade(e.target.value)} options={GRADES} />
                        </div>
                    </Accordion>

                    <Accordion 
                        number={2} 
                        title="Tùy chỉnh Nội dung & Thêm yêu cầu"
                        isOpen={openAccordion === 2}
                        onToggle={() => toggleAccordion(2)}
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="font-semibold text-gray-700 mb-2">Chương (Chọn nhiều)</h4>
                                <div className="h-40 overflow-y-auto border p-3 rounded-md bg-gray-50 space-y-2">
                                    {memoizedChapters.map(c => (
                                        <label key={c.id} className="flex items-center space-x-2 cursor-pointer">
                                            <input type="checkbox" checked={selectedChapterNames.includes(c.name)} onChange={() => handleChapterToggle(c.name)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                            <span>{c.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                             <div>
                                <h4 className="font-semibold text-gray-700 mb-2">Chủ đề (Chọn nhiều)</h4>
                                <div className="h-40 overflow-y-auto border p-3 rounded-md bg-gray-50 space-y-2">
                                     {availableTopics.length > 0 ? availableTopics.map(t => (
                                        <label key={t.id} className="flex items-center space-x-2 cursor-pointer">
                                            <input type="checkbox" checked={selectedTopicNames.includes(t.name)} onChange={() => handleTopicToggle(t.name)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
                                            <span>{t.name}</span>
                                        </label>
                                    )) : <p className="text-gray-500 text-sm">Vui lòng chọn một chương.</p>}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 border-t pt-6">
                             <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                     <div>
                                        <label className="font-semibold text-gray-700">Thêm yêu cầu cần đạt mới (hoặc để AI gợi ý)</label>
                                        <div className="flex gap-2 mt-1">
                                            <input type="text" value={newObjectiveText} onChange={e => setNewObjectiveText(e.target.value)} placeholder="Nhập một yêu cầu cần đạt..." className="flex-grow p-2 border rounded-md" />
                                            <button onClick={handleAddObjective} className="px-4 py-2 bg-indigo-500 text-white rounded-md font-semibold hover:bg-indigo-600">Thêm</button>
                                        </div>
                                     </div>
                                      <div>
                                        <div className="flex justify-between items-center">
                                            <label className="font-semibold text-gray-700">Mục tiêu học tập (Có thể chọn/sửa/xóa/kéo-thả)</label>
                                            <button className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                                                <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                                                Gợi ý Yêu cầu
                                            </button>
                                        </div>
                                        <div className="h-48 overflow-y-auto border p-2 rounded-md bg-gray-100 space-y-2 mt-1">
                                            {learningObjectives.map(obj => (
                                                <div key={obj.id} className="flex items-center justify-between bg-white p-2 rounded shadow-sm border">
                                                    {editingObjective?.id === obj.id ? (
                                                        <div className="flex-grow flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                value={editingObjective.text}
                                                                onChange={(e) => setEditingObjective(prev => prev ? {...prev, text: e.target.value} : null)}
                                                                className="flex-grow p-1 border rounded-md"
                                                                onKeyDown={(e) => e.key === 'Enter' && handleSaveEditObjective()}
                                                                autoFocus
                                                            />
                                                            <button onClick={handleSaveEditObjective} className="text-green-600 hover:text-green-800 font-bold">✓</button>
                                                            <button onClick={handleCancelEditObjective} className="text-red-600 hover:text-red-800 font-bold">×</button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="flex items-center gap-2 flex-grow min-w-0">
                                                                <DragHandleIcon className="w-5 h-5 text-gray-400 cursor-grab flex-shrink-0" />
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedObjectives.has(obj.id)}
                                                                    onChange={() => handleObjectiveCheckboxChange(obj.id)}
                                                                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0"
                                                                />
                                                                <MathText text={obj.text} className="text-sm pr-2 truncate" />
                                                            </div>
                                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                                <button onClick={() => handleObjectiveCheckboxChange(obj.id)} className="text-gray-500 hover:text-gray-800">
                                                                    <PlusIcon className="w-5 h-5" />
                                                                </button>
                                                                <button onClick={() => handleStartEditObjective(obj)} className="text-gray-500 hover:text-blue-600">
                                                                    <PencilIcon className="w-4 h-4" />
                                                                </button>
                                                                <button onClick={() => handleDeleteObjective(obj.id)} className="text-gray-500 hover:text-red-600">
                                                                    <TrashIcon className="w-4 h-4"/>
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-4 flex items-center gap-2 flex-wrap">
                                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
                                            <button onClick={handleDownloadCurriculum} className="px-4 py-2 text-sm bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-md shadow">Tải File</button>
                                            <button onClick={handleUploadClick} className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-md shadow">Tải lên File</button>
                                            <button onClick={handleRestoreDefault} className="px-4 py-2 text-sm bg-yellow-400 hover:bg-yellow-500 text-gray-800 font-semibold rounded-md shadow">Khôi phục gốc</button>
                                            {isUsingCustomData && <span className="text-xs text-gray-500 ml-2">Đang dùng dữ liệu đã lưu.</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-50 rounded-lg border space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                         <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Số câu & Loại câu</label>
                                            <div className="flex gap-2">
                                                <input type="number" value={reqCount} onChange={e => setReqCount(parseInt(e.target.value, 10))} min="1" className="w-20 p-2 border rounded-md"/>
                                                <select value={reqType} onChange={e => setReqType(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md shadow-sm">
                                                    {QUESTION_TYPES.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <CustomSelect label="Mức độ" value={reqLevel} onChange={e => setReqLevel(e.target.value)} options={QUESTION_LEVELS} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Áp dụng cho Chủ đề</label>
                                        <select 
                                            value={reqTopic} 
                                            onChange={e => setReqTopic(e.target.value)} 
                                            disabled={selectedTopicNames.length === 0} 
                                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100 disabled:text-gray-500"
                                        >
                                            {selectedTopicNames.length > 0 
                                                ? selectedTopicNames.map(topic => <option key={topic} value={topic}>{topic}</option>)
                                                : <option>Vui lòng chọn một chủ đề ở trên</option>
                                            }
                                        </select>
                                    </div>
                                     <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Yêu cầu bổ sung (nếu có)</label>
                                        <textarea value={reqDetails} onChange={e => setReqDetails(e.target.value)} rows={2} placeholder="Ví dụ: Câu hỏi cần có hình vẽ..." className="w-full p-2 border rounded-md"></textarea>
                                    </div>
                                    <button onClick={handleAddRequest} disabled={!reqTopic} className="w-full px-4 py-2 bg-blue-500 text-white rounded-md font-semibold hover:bg-blue-600 disabled:bg-gray-400">Thêm vào đề</button>
                                </div>
                            </div>
                        </div>
                    </Accordion>
                    
                    <Accordion 
                        number={3} 
                        title="Nạp tài liệu bổ sung (Tùy chọn)"
                        isOpen={openAccordion === 3}
                        onToggle={() => toggleAccordion(3)}
                    >
                        <p className="text-sm text-gray-600 mb-2">Tải lên file .txt, .pdf, .docx... hoặc dán nội dung để AI tham khảo khi tạo câu hỏi.</p>
                         <div className="flex items-center justify-center w-full">
                            <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <svg className="w-8 h-8 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/></svg>
                                    <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Nhấn để tải lên</span> hoặc kéo thả</p>
                                    <p className="text-xs text-gray-500">DOCX, PDF, TXT (MAX. 5MB)</p>
                                </div>
                                <input id="dropzone-file" type="file" className="hidden" onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        if (file.size > 5 * 1024 * 1024) { // 5MB
                                            alert("Tệp quá lớn. Vui lòng chọn tệp dưới 5MB.");
                                            return;
                                        }
                                        setSupplementaryFile(file);
                                    } else {
                                        setSupplementaryFile(null);
                                    }
                                }} />
                            </label>
                        </div> 
                        {supplementaryFile && <p className="text-sm text-gray-600 mt-2">Đã chọn tệp: {supplementaryFile.name}</p>}
                    </Accordion>
                </div>

                <div className="lg:col-span-1">
                    <div className="bg-white rounded-xl shadow-xl border border-indigo-200 overflow-hidden sticky top-6">
                        <div className="bg-indigo-600 p-4 flex items-center">
                            <div className="bg-white text-indigo-600 rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg mr-4 flex-shrink-0">4</div>
                            <h3 className="text-xl font-bold text-white">Tổng hợp và Tạo đề</h3>
                        </div>

                        <div className="p-6">
                            <p className="text-sm text-gray-600 mb-4">
                                Các yêu cầu bạn thêm sẽ xuất hiện ở đây. Khi đã hoàn tất, nhấn nút bên dưới để AI bắt đầu tạo đề.
                            </p>
                            
                            {error && <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-md text-sm border border-red-200">{error}</div>}

                            <div className="bg-slate-100 p-3 rounded-lg min-h-[16rem] max-h-96 overflow-y-auto space-y-3">
                                {questionRequests.length > 0 ? questionRequests.map(req => (
                                    <div key={req.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex justify-between items-start transition-all">
                                        <div className="flex-grow mr-2">
                                            <p className="font-semibold text-gray-800">{req.count} câu {req.type} ({req.level})</p>
                                            <p className="text-sm text-gray-600 mt-1">
                                                <MathText text={req.topic} />
                                            </p>
                                            {req.details && (
                                                <p className="text-xs text-gray-500 mt-1 italic">
                                                    Ghi chú: <MathText text={req.details} />
                                                </p>
                                            )}
                                        </div>
                                        <button 
                                            onClick={() => handleDeleteRequest(req.id)} 
                                            className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors flex-shrink-0"
                                            aria-label="Xóa yêu cầu"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                )) : (
                                    <div className="flex items-center justify-center h-full pt-16">
                                        <p className="text-gray-500 text-center">Chưa có yêu cầu nào được thêm.</p>
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={handleGenerateExam}
                                disabled={questionRequests.length === 0}
                                className="w-full mt-6 px-4 py-4 bg-indigo-600 text-white rounded-lg font-bold text-lg flex items-center justify-center gap-2 shadow-lg hover:bg-indigo-700 hover:-translate-y-0.5 transform transition-all disabled:bg-gray-400 disabled:shadow-md disabled:transform-none disabled:cursor-not-allowed"
                            >
                                <SparklesIcon className="w-6 h-6" />
                                TẠO ĐỀ THI
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateBySelectionForm;