import type { FullCurriculum } from './types';
import { DEFAULT_CURRICULUM_DATA } from './data/curriculum';

export const SUBJECTS = ['Tin học'];
export const GRADES = ['Lớp 6', 'Lớp 7', 'Lớp 8', 'Lớp 9', 'Lớp 10', 'Lớp 11', 'Lớp 12'];

export const DEFAULT_CURRICULUM: FullCurriculum = DEFAULT_CURRICULUM_DATA;

// Renamed for clarity and correctness
export const QUESTION_TYPES = ['Trắc nghiệm', 'Đúng/Sai', 'Trả lời ngắn', 'Tự luận'];
export const QUESTION_LEVELS = ['Nhận biết', 'Thông hiểu', 'Vận dụng', 'Vận dụng cao'];
