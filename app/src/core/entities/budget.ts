import z from "zod";

const exactBudgetValueSchema = z.object({
	kind: z.literal("exact"),
	amount: z.number().finite().nonnegative(),
	currency: z.string().min(1).optional(),
});

const rangeBudgetValueSchema = z.object({
	kind: z.literal("range"),
	minAmount: z.number().finite().nonnegative(),
	maxAmount: z.number().finite().nonnegative(),
	currency: z.string().min(1).optional(),
});

export const budgetValueSchema = z
	.discriminatedUnion("kind", [exactBudgetValueSchema, rangeBudgetValueSchema])
	.superRefine((value, ctx) => {
		if (value.kind === "range" && value.maxAmount < value.minAmount) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "maxAmount must be greater than or equal to minAmount",
				path: ["maxAmount"],
			});
		}
	});

export type BudgetValue = z.infer<typeof budgetValueSchema>;
