import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Comment | Ninety6 AI",
  description: "Turn posts into thoughtful comments with Comment.",
};

export default function CommentLayout({ children }: { children: ReactNode }) {
  return children;
}
