import { GraphService } from "./graph.service";
import { getRepositoryIntelligenceService } from "../repository/repository.runtime";

let graphService: GraphService | null = null;

export const getGraphService = (): GraphService => {
  if (!graphService) {
    graphService = new GraphService(getRepositoryIntelligenceService());
  }
  return graphService;
};
