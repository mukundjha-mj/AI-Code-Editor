import { RepositoryIntelligenceService } from "./repository-intelligence.service";

let sharedRepositoryService: RepositoryIntelligenceService | null = null;

export const getRepositoryIntelligenceService = (): RepositoryIntelligenceService => {
  if (!sharedRepositoryService) {
    sharedRepositoryService = new RepositoryIntelligenceService();
  }
  return sharedRepositoryService;
};
