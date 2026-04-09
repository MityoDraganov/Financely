import {
  CommercialCase,
  CommercialCaseData,
  CommercialCaseEvent,
  CommercialCaseEventData,
} from "../../entities/commercial-case";
import { GenericRepository } from "./generic-repository";

export type CommercialCaseRepository = GenericRepository<CommercialCase, CommercialCaseData>;
export type CommercialCaseEventRepository = GenericRepository<CommercialCaseEvent, CommercialCaseEventData>;
