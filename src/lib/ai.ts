// Mock AI service for improving text. Replace with real API call as needed.
export async function improveTextWithAI(text: string): Promise<string> {
  // Simulate network delay
  await new Promise((res) => setTimeout(res, 1200));
  // Simple mock: add a prefix and suffix
  return `✨ Improved: ${text.trim()} ✨`;
}
