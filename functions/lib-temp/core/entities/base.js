"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.baseEntitySchema = void 0;
const zod_1 = __importDefault(require("zod"));
exports.baseEntitySchema = zod_1.default.object({
    id: zod_1.default.string(),
    createdAt: zod_1.default.string().optional(),
    updatedAt: zod_1.default.string().optional(),
});
//# sourceMappingURL=base.js.map