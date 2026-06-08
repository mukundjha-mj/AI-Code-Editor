import { GraphService } from "./graph.service";
import { getRepositoryIntelligenceService } from "../repository/repository.runtime";
import { getDecisionMemoryService } from "../decision-memory/decision-memory.runtime";

let graphService: GraphService | null = null;

export const getGraphService = (): GraphService => {
  if (!graphService) {
    graphService = new GraphService(getRepositoryIntelligenceService(), getDecisionMemoryService());
  }
  return graphService;
};
