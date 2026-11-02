export type DateOrder = "auto" | "dmy" | "mdy" | "ymd";

export interface Attachment {
  path: string;
  name: string;
  kind: "image" | "video" | "audio" | "file";
}

export interface ChatMessage {
  id: number;
  date: string;
  time: string;
  sender: string | null;
  text: string;
  attachments: Attachment[];
}

export interface ChatData {
  messages: ChatMessage[];
  participants: string[];
  days: { date: string; count: number; index: number }[];
  dateOrder: Exclude<DateOrder, "auto">;
  ambiguousDates: boolean;
  warnings: string[];
  mediaCount: number;
  transcripts: string[];
  transcript: string;
}
