import { httpsCallable } from "@firebase/functions";
import { firebase } from "@/infrastructure/firebase";
import { FunctionsService, CreateProposalRequest, CreateProposalResponse } from "@/core";

export const functionsService: FunctionsService = {
  async createProposal(payload: CreateProposalRequest): Promise<CreateProposalResponse> {
    const result = await httpsCallable<CreateProposalRequest, CreateProposalResponse>(
      firebase.functions,
      "createProposal",
    )(payload);
    return result.data;
  },
};


