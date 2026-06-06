export interface CodeAnalysisService {
  analyzeFile(path: string): Promise<{ summary: string }>;
}
