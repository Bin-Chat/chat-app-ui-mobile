export interface PollOptionView {
  _id: string;
  text: string;
  addedBy: string;
  voteCount: number;
  voters: string[];
}

export interface PollView {
  _id: string;
  conversationId: string;
  messageId: string;
  createdBy: string;
  question: string;
  options: PollOptionView[];
  totalVoters: number;
  myVotes: string[];
  allowMultiple: boolean;
  allowAddOptions: boolean;
  hideResultsUntilVoted: boolean;
  hideVoters: boolean;
  isClosed: boolean;
  isExpired: boolean;
  expiresAt: string | null;
  closedAt: string | null;
  canSeeResults: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePollPayload {
  question: string;
  options: string[];
  allowMultiple?: boolean;
  allowAddOptions?: boolean;
  hideResultsUntilVoted?: boolean;
  hideVoters?: boolean;
  expiresAt?: string;
}
