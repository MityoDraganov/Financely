import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GitBranch } from "lucide-react";
import { WorkflowCondition, WorkflowConditionOperator } from "@/core";

interface ConditionalBranchEditorProps {
  conditions: WorkflowCondition[];
  onConditionsChange: (conditions: WorkflowCondition[]) => void;
  availableFields?: Array<{ value: string; label: string }>;
  className?: string;
}

const conditionOperators: { value: WorkflowConditionOperator; label: string }[] = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not Equals" },
  { value: "greater_than", label: "Greater Than" },
  { value: "less_than", label: "Less Than" },
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Not Contains" },
  { value: "is_empty", label: "Is Empty" },
  { value: "is_not_empty", label: "Is Not Empty" },
];

const defaultFields = [
  { value: "invoice.status", label: "Invoice Status" },
  { value: "invoice.amount", label: "Invoice Amount" },
  { value: "proposal.status", label: "Proposal Status" },
  { value: "lead.status", label: "Lead Status" },
  { value: "contact.email", label: "Contact Email" },
  { value: "product.stock", label: "Product Stock" },
];

// Map of field names to their possible values (for fields with predefined options)
const fieldValueOptions: Record<string, Array<{ value: string; label: string }>> = {
  "invoice.status": [
    { value: "unsent", label: "Unsent" },
    { value: "sent", label: "Sent" },
    { value: "paid", label: "Paid" },
    { value: "cancelled", label: "Cancelled" },
  ],
  "proposal.status": [
    { value: "CREATED", label: "Created" },
    { value: "SENT", label: "Sent" },
    { value: "ACCEPTED", label: "Accepted" },
    { value: "INVOICED", label: "Invoiced" },
    { value: "REJECTED", label: "Rejected" },
    { value: "EXPIRED", label: "Expired" },
  ],
  "lead.status": [
    { value: "new", label: "New" },
    { value: "viewed", label: "Viewed" },
    { value: "contacted", label: "Contacted" },
    { value: "converted", label: "Converted" },
    { value: "archived", label: "Archived" },
  ],
};

// Check if a field has predefined values
const hasPredefinedValues = (field: string): boolean => {
  return field in fieldValueOptions;
};

// Get predefined values for a field
const getFieldValues = (field: string): Array<{ value: string; label: string }> => {
  return fieldValueOptions[field] || [];
};

export function ConditionalBranchEditor({
  conditions,
  onConditionsChange,
  availableFields = defaultFields,
  className,
}: ConditionalBranchEditorProps) {
  const [logicOperator, setLogicOperator] = useState<"AND" | "OR">("AND");

  const addCondition = () => {
    const newCondition: WorkflowCondition = {
      field: "",
      operator: "equals",
      value: "",
    };
    onConditionsChange([...conditions, newCondition]);
  };

  const updateCondition = (index: number, updates: Partial<WorkflowCondition>) => {
    const updated = conditions.map((cond, i) =>
      i === index ? { ...cond, ...updates } : cond
    );
    onConditionsChange(updated);
  };

  const removeCondition = (index: number) => {
    onConditionsChange(conditions.filter((_, i) => i !== index));
  };

  const isValueRequired = (operator: WorkflowConditionOperator) => {
    return !["is_empty", "is_not_empty"].includes(operator);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-purple-500" />
          <div className="flex-1">
            <CardTitle>Conditional Branching</CardTitle>
            <CardDescription>
              Define conditions that determine workflow execution path
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Logic Operator */}
        {conditions.length > 1 && (
          <div className="flex items-center gap-2">
            <Label>Logic:</Label>
            <Select
              value={logicOperator}
              onValueChange={(value) => setLogicOperator(value as "AND" | "OR")}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">AND</SelectItem>
                <SelectItem value="OR">OR</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="ml-2">
              {conditions.length} condition{conditions.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        )}

        {/* Conditions List */}
        <div className="space-y-3">
          {conditions.map((condition, index) => (
            <Card key={index} className="p-4 border-2">
              <div className="flex items-start gap-3">
                <div className="flex-1 grid grid-cols-12 gap-3">
                  {/* Field */}
                  <div className="col-span-4">
                    <Label className="text-xs">Field</Label>
                    <Select
                      value={condition.field}
                      onValueChange={(value) =>
                        updateCondition(index, { field: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFields.map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Operator */}
                  <div className="col-span-3">
                    <Label className="text-xs">Operator</Label>
                    <Select
                      value={condition.operator}
                      onValueChange={(value) =>
                        updateCondition(index, {
                          operator: value as WorkflowConditionOperator,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {conditionOperators.map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Value */}
                  {isValueRequired(condition.operator) && (
                    <div className="col-span-4">
                      <Label className="text-xs">Value</Label>
                      {condition.field && hasPredefinedValues(condition.field) ? (
                        <Select
                          value={String(condition.value || "")}
                          onValueChange={(value) =>
                            updateCondition(index, { value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select value" />
                          </SelectTrigger>
                          <SelectContent>
                            {getFieldValues(condition.field).map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type={condition.field === "invoice.amount" || condition.field === "product.stock" ? "number" : "text"}
                          value={typeof condition.value === "boolean" ? String(condition.value) : (condition.value || "")}
                          onChange={(e) =>
                            updateCondition(index, { 
                              value: condition.field === "invoice.amount" || condition.field === "product.stock" 
                                ? parseFloat(e.target.value) || 0 
                                : e.target.value 
                            })
                          }
                          placeholder="Enter value"
                        />
                      )}
                    </div>
                  )}

                  {/* Remove Button */}
                  <div className="col-span-1 flex items-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0"
                      onClick={() => removeCondition(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Add Condition Button */}
        <Button
          variant="outline"
          onClick={addCondition}
          className="w-full border-dashed"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Condition
        </Button>

        {/* Preview */}
        {conditions.length > 0 && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-xs font-medium mb-2">Preview:</p>
            <p className="text-xs text-muted-foreground">
              {conditions
                .map(
                  (cond) =>
                    `${cond.field || "?"} ${conditionOperators.find((o) => o.value === cond.operator)?.label || cond.operator} ${isValueRequired(cond.operator) ? cond.value || "?" : ""}`
                )
                .join(` ${logicOperator} `)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
