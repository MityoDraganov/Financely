import { Template, TemplateData } from "../../entities/template";
import { GenericRepository } from "./generic-repository";

export type TemplateRepository = GenericRepository<Template, TemplateData>;

