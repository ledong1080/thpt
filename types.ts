export interface QuestionRequest {
  id: string;
  count: number;
  level: string;
  type: string;
  topic: string;
  details: string;
}

export interface Chapter {
  id: string;
  name: string;
  topics: Topic[];
}

export interface Topic {
  id: string;
  name: string;
}

export interface LearningObjective {
  id: string;
  text: string;
}

// Interface for the new True/False statement structure
export interface TrueFalseStatement {
  text: string;
  is_true: boolean;
}

// Updated ParsedQuestion to be a flexible type
export interface ParsedQuestion {
  id: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
  question_text: string;
  question_image?: string; // For the question's image

  // Context fields for matrix and specification views
  chapter?: string;
  topic?: string;
  level?: string;

  // Fields for 'multiple_choice'
  options?: string[];
  option_images?: (string | null)[]; // For each option's image
  correct_answer_index?: number;
  
  // Fields for 'true_false'
  statements?: TrueFalseStatement[];
  
  // Fields for 'short_answer' and 'essay'
  suggested_answer?: string;
  
  explanation?: string;
}


export interface ParsedExam {
  questions: ParsedQuestion[];
}

// Types for uploadable curriculum data
export interface TopicDetails {
  chapter: string;
  content: string;
  objectives: string[];
  common_exercises: string[];
}

export interface GradeCurriculum {
  [topicName: string]: TopicDetails;
}

export interface FullCurriculum {
  [grade: string]: GradeCurriculum;
}

export interface SubjectCurriculum {
  [subject: string]: FullCurriculum;
}