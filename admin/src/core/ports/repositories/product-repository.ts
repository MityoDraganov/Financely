import { Product, ProductData } from "../../entities/product";
import { GenericRepository } from "./generic-repository";

export type ProductRepository = GenericRepository<Product, ProductData>;

