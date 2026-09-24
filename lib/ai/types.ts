export type AIFormat = "json" | Record<string, unknown>;

export type AIGenerateOptions = {
  format?: AIFormat;
  temperature?: number;
  numPredict?: number;
};

export type AIProvider = {
  generateText(prompt: string, options?: AIGenerateOptions): Promise<string>;
  generateTextStream(
    prompt: string,
    options: AIGenerateOptions | undefined,
    onToken: (token: string) => void,
  ): Promise<string>;
};
