export interface VeniceModel {
  id: string;
  name: string;
  category: string;
}

export const VENICE_MODELS: VeniceModel[] = [
  { id: "llama-3.3-70b", name: "Llama 3.3 70B", category: "General" },
  { id: "deepseek-r1-llama-70b", name: "DeepSeek R1 (Llama 70B)", category: "Reasoning" },
  { id: "deepseek-v4-pro", name: "DeepSeek v4 Pro", category: "General" },
  { id: "qwen-3.6", name: "Qwen 3.6", category: "General" },
];

export function isValidVeniceModel(modelName: string): boolean {
  return VENICE_MODELS.some((m) => m.id === modelName);
}

export function getVeniceModelList(): VeniceModel[] {
  return VENICE_MODELS;
}
