export interface KeySummary {
  id: string;
  eventId: string;
  value: string;
  normalizedValue: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateKeyInput {
  eventId: string;
  value: string;
}

export interface UpdateKeyInput {
  value: string;
}

export interface KeyListResult {
  data: KeySummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface QuestionSummary {
  id: string;
  roundId: string;
  keyId: string;
  keyValue: string;
  questionText: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateQuestionInput {
  roundId: string;
  keyId: string;
  questionText: string;
}

export interface UpdateQuestionInput {
  questionText: string;
}

export interface QuestionListResult {
  data: QuestionSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
