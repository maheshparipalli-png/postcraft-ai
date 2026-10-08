export type Platform = "LinkedIn" | "X" | "Instagram" | "Facebook" | "YouTube" | "Reddit" | "Threads" | "TikTok";
export type Position = "Agree" | "Partially Agree" | "Disagree" | "Add a Different Perspective" | "Challenge the Assumption" | "Ask a Question";
export type Depth = "Easy to Understand" | "Medium" | "High";
export type Style = "Natural" | "Crunchy" | "Bold" | "Thought-Provoking" | "Witty" | "Storytelling" | "Rhyming" | "Satirical";

export type Comment = {
  id: string;
  comment_text: string;
  quality_score: number;
  why_it_works: string | null;
  is_favorite: boolean;
};

export type Attachment = { name: string; type: string; data: string };

export type HistoryItem = {
  id: string;
  created_at: string;
  post: string;
  url: string;
  platform: Platform;
  position: Position;
  comments: Comment[];
};

export const platforms: Platform[] = ["LinkedIn", "X", "Instagram", "Facebook", "YouTube", "Reddit", "Threads", "TikTok"];
export const positions: Position[] = ["Agree", "Partially Agree", "Disagree", "Add a Different Perspective", "Challenge the Assumption", "Ask a Question"];
export const styles: Style[] = ["Natural", "Crunchy", "Bold", "Thought-Provoking", "Witty", "Storytelling", "Rhyming", "Satirical"];
export const depths: Depth[] = ["Easy to Understand", "Medium", "High"];
export const quickRefines = ["Shorter", "More Human", "More Bold", "Add a Question"];
