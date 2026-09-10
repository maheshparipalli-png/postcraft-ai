export type AIProvider = {
  generateText(prompt: string): Promise<string>;
};
