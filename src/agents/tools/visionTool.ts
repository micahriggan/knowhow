import { askGptVision } from "../../ai";

export async function visionTool(imageUrl: string, question: string) {
  return askGptVision(imageUrl, question);
}
