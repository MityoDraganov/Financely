import { Contact, ContactData } from "../../entities/contact";
import { GenericRepository } from "./generic-repository";

export type ContactRepository = GenericRepository<Contact, ContactData>;
