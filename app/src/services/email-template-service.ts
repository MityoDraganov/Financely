import { EmailTemplateData } from "@/core";
import { getEmailTemplateRealtimeRepository } from "@/repositories/email-template-realtime-repository";

// Email templates use Realtime Database for collaborative editing
const emailTemplateRepository = getEmailTemplateRealtimeRepository();

export const emailTemplateService = {
  list(orgId: string) {
    return emailTemplateRepository.getAll({
      queryConstraints: [{ field: "orgId", operator: "==", value: orgId }],
    });
  },
  get(id: string) {
    return emailTemplateRepository.get({ id });
  },
  create(data: EmailTemplateData) {
    return emailTemplateRepository.create({ data });
  },
  createDraft(data: EmailTemplateData) {
    // Create a draft template (same as create, but ensures status is draft)
    const draftData = {
      ...data,
      status: "draft" as const,
    };
    return emailTemplateRepository.create({ data: draftData });
  },
  updateDraft(id: string, data: Partial<EmailTemplateData>) {
    return emailTemplateRepository.update({ id, data });
  },
  update(id: string, data: Partial<EmailTemplateData>) {
    return emailTemplateRepository.update({ id, data });
  },
  delete(id: string) {
    return emailTemplateRepository.delete({ id });
  },
};

export type EmailTemplateService = typeof emailTemplateService;


