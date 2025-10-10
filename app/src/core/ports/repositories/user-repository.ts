import { User, UserData } from "../../entities/user";
import { GenericRepository } from "./generic-repository";

export type UserRepository = GenericRepository<User, UserData>;

