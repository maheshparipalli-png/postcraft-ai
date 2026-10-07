import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Comment | Ninety6 AI",
  description: "Turn posts into thoughtful comments with Comment.",
};

export default function CommentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
