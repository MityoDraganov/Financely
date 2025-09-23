"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateTotals = exports.proposalSchema = exports.proposalDataSchema = exports.proposalApprovalSchema = exports.proposalItemSchema = exports.PROPOSAL_STATUSES = void 0;
const zod_1 = __importDefault(require("zod"));
const base_1 = require("./base");
exports.PROPOSAL_STATUSES = {
    DRAFT: "DRAFT",
    SENT: "SENT",
    ACCEPTED: "ACCEPTED",
    REJECTED: "REJECTED",
    EXPIRED: "EXPIRED",
};
exports.proposalItemSchema = zod_1.default.object({
    description: zod_1.default.string().min(1),
    qty: zod_1.default.number().min(0),
    unitPrice: zod_1.default.number().min(0),
    taxPct: zod_1.default.number().min(0).max(100).optional(),
});
exports.proposalApprovalSchema = zod_1.default.object({
    tokenHash: zod_1.default.string(),
    expiresAt: zod_1.default.string(),
    sentAt: zod_1.default.string(),
    approvedAt: zod_1.default.string().optional(),
    rejectedAt: zod_1.default.string().optional(),
});
exports.proposalDataSchema = zod_1.default.object({
    orgId: zod_1.default.string().min(1),
    customerId: zod_1.default.string().min(1),
    title: zod_1.default.string().min(1),
    description: zod_1.default.string().optional(),
    status: zod_1.default.nativeEnum(exports.PROPOSAL_STATUSES),
    items: zod_1.default.array(exports.proposalItemSchema),
    subtotal: zod_1.default.number().min(0),
    taxTotal: zod_1.default.number().min(0),
    total: zod_1.default.number().min(0),
    currency: zod_1.default.string().min(1),
    terms: zod_1.default.string().optional(),
    notes: zod_1.default.string().optional(),
    approval: exports.proposalApprovalSchema.optional(),
});
exports.proposalSchema = base_1.baseEntitySchema.merge(exports.proposalDataSchema);
const calculateTotals = (items, vatRatePct) => {
    const subtotal = items.reduce((acc, i) => acc + i.qty * i.unitPrice, 0);
    const taxTotal = items.reduce((acc, i) => { var _a, _b; return acc + (i.qty * i.unitPrice) * (((_b = (_a = i.taxPct) !== null && _a !== void 0 ? _a : vatRatePct) !== null && _b !== void 0 ? _b : 0) / 100); }, 0);
    const total = subtotal + taxTotal;
    return { subtotal, taxTotal, total };
};
exports.calculateTotals = calculateTotals;
//# sourceMappingURL=proposal.js.map