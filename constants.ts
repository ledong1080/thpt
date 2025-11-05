import type { SubjectCurriculum } from './types';
import { ALL_SUBJECTS_CURRICULUM } from './data/curriculum';

export const SUBJECTS = ['Tin học', 'Toán học', 'Vật lý', 'Hóa học','Sinh học','Lịch sử', 'Địa lí', 'Tiếng Anh','GD-KT-PL','KTCN','KTNN'];
export const GRADES = ['Lớp 6', 'Lớp 7', 'Lớp 8', 'Lớp 9', 'Lớp 10', 'Lớp 11', 'Lớp 12'];

export const ALL_CURRICULUM: SubjectCurriculum = ALL_SUBJECTS_CURRICULUM;

// Renamed for clarity and correctness
export const QUESTION_TYPES = ['Trắc nghiệm', 'Đúng/Sai', 'Trả lời ngắn', 'Tự luận'];
export const QUESTION_LEVELS = ['Nhận biết', 'Thông hiểu', 'Vận dụng', 'Vận dụng cao'];