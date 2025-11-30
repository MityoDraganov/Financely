import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CreateWorkflowInput, WorkflowActionType, WorkflowData } from "@/core";
import { useCreateWorkflow, useUpdateWorkflow } from "@/hooks/repository-hooks/use-workflows";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import { toast } from "sonner";
import { WorkflowBuilderProps, WorkflowStep } from "./types";
import { WorkflowHeader } from "./components/workflow-header";
import { WorkflowSteps } from "./components/workflow-steps";
import { WorkflowActions } from "./components/workflow-actions";
import { validateWorkflowRealTime } from "@/utils/workflow-validation";
import { StepTemplates, StepTemplate } from "./components/step-templates";
import {
	WorkflowTemplates,
	WorkflowTemplate,
} from "./components/workflow-templates";
import { ExecutionPreview } from "./components/execution-preview";
import { StepEditorDialog } from "./components/step-editor-dialog";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

export default function WorkflowBuilder(props: WorkflowBuilderProps = {}) {
	const { t } = useTranslation();
	const { editingWorkflow, onCancelEdit, onPreview } = props;
	const { currentOrganization } = useOrganizationContext();
	const createWorkflow = useCreateWorkflow();
	const updateWorkflow = useUpdateWorkflow();

	const [workflow, setWorkflow] = useState<Partial<CreateWorkflowInput>>({
		name: "",
		description: "",
		trigger: { type: "manual.trigger" },
		steps: [],
		status: "active",
		tags: [],
		category: "general",
	});

	const [showTemplates, setShowTemplates] = useState(false);
	const [showStepTemplates, setShowStepTemplates] = useState(false);
	const [showExecutionPreview, setShowExecutionPreview] = useState(false);
	const [isExecuting, setIsExecuting] = useState(false);
	const [executionStepId, setExecutionStepId] = useState<
		string | undefined
	>();
	const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
	const [showStepEditor, setShowStepEditor] = useState(false);

	// Real-time validation
	const validationResult = useMemo(() => {
		return validateWorkflowRealTime(workflow as Partial<WorkflowData>);
	}, [workflow]);

	// Populate form when editing a workflow
	useEffect(() => {
		if (editingWorkflow) {
			setWorkflow({
				name: editingWorkflow.name,
				description: editingWorkflow.description,
				trigger: editingWorkflow.trigger,
				steps: editingWorkflow.steps,
				tags: editingWorkflow.tags,
				n8nEnabled: editingWorkflow.n8nEnabled,
				status: editingWorkflow.status,
				category: editingWorkflow.category,
			});
		} else {
			// Reset form when not editing
			setWorkflow({
				name: "",
				description: "",
				trigger: { type: "manual.trigger" },
				steps: [],
				status: "active",
				tags: [],
				category: "general",
				n8nEnabled: false,
			});
		}
	}, [editingWorkflow]);

	const validateWorkflowData = (
		workflowData: Record<string, unknown>
	): string[] => {
		const errors: string[] = [];

		// Check for undefined values
		const checkForUndefined = (
			obj: Record<string, unknown>,
			path: string = ""
		) => {
			for (const [key, value] of Object.entries(obj)) {
				const currentPath = path ? `${path}.${key}` : key;

				if (value === undefined) {
					errors.push(`Undefined value found at ${currentPath}`);
				} else if (
					value &&
					typeof value === "object" &&
					!Array.isArray(value)
				) {
					checkForUndefined(
						value as Record<string, unknown>,
						currentPath
					);
				} else if (Array.isArray(value)) {
					value.forEach((item, index) => {
						if (item === undefined) {
							errors.push(
								`Undefined value found at ${currentPath}[${index}]`
							);
						} else if (item && typeof item === "object") {
							checkForUndefined(
								item as Record<string, unknown>,
								`${currentPath}[${index}]`
							);
						}
					});
				}
			}
		};

		checkForUndefined(workflowData);
		return errors;
	};

	const handleSaveWorkflow = async () => {
		if (!currentOrganization?.id) {
			toast.error(t("workflows.builder.toast.noOrg"));
			return;
		}

		if (
			!workflow.name ||
			!workflow.trigger ||
			workflow.steps?.length === 0
		) {
			toast.error(t("workflows.builder.toast.requiredFields"));
			return;
		}

		// Validate workflow actions before saving
		for (const step of workflow.steps || []) {
			for (const action of step.actions || []) {
				if (action.type === "send.email") {
					const emailConfig = action.config as any;
					if (!emailConfig.recipients || emailConfig.recipients.length === 0) {
						toast.error(t("workflows.builder.toast.emailNoRecipients", { stepName: step.name || "Step" }));
						return;
					}
					// Filter out empty recipient strings
					const validRecipients = emailConfig.recipients.filter((email: string) => email && email.trim().length > 0);
					if (validRecipients.length === 0) {
						toast.error(t("workflows.builder.toast.emailNoValidRecipients", { stepName: step.name || "Step" }));
						return;
					}
					if (!emailConfig.subject || emailConfig.subject.trim().length === 0) {
						toast.error(t("workflows.builder.toast.emailNoSubject", { stepName: step.name || "Step" }));
						return;
					}
					if (!emailConfig.body || emailConfig.body.trim().length === 0) {
						toast.error(t("workflows.builder.toast.emailNoBody", { stepName: step.name || "Step" }));
						return;
					}
				}
			}
		}

		try {
			if (editingWorkflow) {
				// Update existing workflow
				const workflowData = {
					name: workflow.name,
					description: workflow.description || "",
					trigger: workflow.trigger,
					steps: workflow.steps || [],
					status: workflow.status || "draft",
					tags: workflow.tags || [],
					category: workflow.category || "general",
					settings: editingWorkflow.settings || {
						maxRetries: 3,
						timeoutSeconds: 300,
						notifyOnFailure: true,
						notifyOnSuccess: false,
						maxConcurrentExecutions: 10,
					},
				};

				// Validate for undefined values
				const validationErrors = validateWorkflowData(workflowData);
				if (validationErrors.length > 0) {
					console.error("Validation errors:", validationErrors);
					toast.error(
						t("workflows.builder.toast.validationFailed", {
							errors: validationErrors.join(", "),
						})
					);
					return;
				}

				// Update existing workflow
				await updateWorkflow.mutateAsync({
					id: editingWorkflow.id,
					data: workflowData,
				});
				toast.success(t("workflows.builder.toast.updateSuccess"));

				// Reset form and exit edit mode
				setWorkflow({
					name: "",
					description: "",
					trigger: { type: "manual.trigger" },
					steps: [],
					status: "draft",
					tags: [],
					category: "general",
					n8nEnabled: false,
				});

				if (onCancelEdit) {
					onCancelEdit();
				}
			} else {
				// Create new workflow
				const workflowData = {
					orgId: currentOrganization.id,
					name: workflow.name,
					description: workflow.description || "",
					trigger: workflow.trigger,
					steps: workflow.steps || [],
					status: "active" as const,
					tags: workflow.tags || [],
					category: workflow.category || "general",
					version: 1,
					settings: {
						maxRetries: 3,
						timeoutSeconds: 300,
						notifyOnFailure: true,
						notifyOnSuccess: false,
						maxConcurrentExecutions: 10,
					},
					n8nEnabled: workflow.n8nEnabled || false,
				};

				console.log(
					"Sending workflow data:",
					JSON.stringify(workflowData, null, 2)
				);
				await createWorkflow.mutateAsync(workflowData);
				toast.success(t("workflows.builder.toast.createSuccess"));

				// Reset form
				setWorkflow({
					name: "",
					description: "",
					trigger: { type: "manual.trigger" },
					steps: [],
					status: "active",
					tags: [],
					category: "general",
					n8nEnabled: false,
				});
			}
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error
					? error.message
					: "Unknown error occurred";
			toast.error(
				`${editingWorkflow ? t("workflows.builder.toast.updateSuccess") : t("workflows.builder.toast.createSuccess")}: ${errorMessage}`
			);
		}
	};

	const handleUpdateWorkflow = (updates: Partial<CreateWorkflowInput>) => {
		setWorkflow({ ...workflow, ...updates });
	};

	const addStep = () => {
		const newStep: WorkflowStep = {
			id: `step_${Date.now()}`,
			name: "",
			type: "action",
			actions: [],
			order: workflow.steps?.length || 0,
		};

		const updatedSteps = [...(workflow.steps || []), newStep];
		setWorkflow({ ...workflow, steps: updatedSteps });
	};

	const updateStep = (stepId: string, updates: Partial<WorkflowStep>) => {
		const updatedSteps = (workflow.steps || []).map((step) =>
			step.id === stepId ? { ...step, ...updates } : step
		);
		setWorkflow({ ...workflow, steps: updatedSteps });
	};

	const deleteStep = (stepId: string) => {
		const updatedSteps = (workflow.steps || []).filter(
			(step) => step.id !== stepId
		);
		setWorkflow({ ...workflow, steps: updatedSteps });
	};

	const addAction = (
		stepId: string,
		actionType: WorkflowActionType = "call.webhook"
	) => {
		const step = workflow.steps?.find((s) => s.id === stepId);
		if (!step) return;

		const newAction =
			actionType === "call.webhook" || actionType === "http_request"
				? {
						id: `action_${Date.now()}`,
						type:
							actionType === "http_request"
								? "call.webhook"
								: actionType,
						name: "",
						config: {
							method: "POST" as const,
							url: "",
						},
					}
				: {
						id: `action_${Date.now()}`,
						type: actionType,
						name: "",
						config: {
							recipients: [],
							subject: "",
							body: "",
							isHtml: false,
						},
					};

		const updatedStep = {
			...step,
			actions: [...step.actions, newAction],
		};

		const updatedSteps = (workflow.steps || []).map((s) =>
			s.id === stepId ? updatedStep : s
		);
		setWorkflow({ ...workflow, steps: updatedSteps });
	};

	const updateAction = (
		stepId: string,
		actionIndex: number,
		updates: Record<string, unknown>
	) => {
		const updatedSteps = (workflow.steps || []).map((step) => {
			if (step.id === stepId) {
				const updatedActions = [...step.actions];
				updatedActions[actionIndex] = {
					...updatedActions[actionIndex],
					...updates,
				};
				return { ...step, actions: updatedActions };
			}
			return step;
		});
		setWorkflow({ ...workflow, steps: updatedSteps });
	};

	const deleteAction = (stepId: string, actionIndex: number) => {
		const updatedSteps = (workflow.steps || []).map(
			(step: WorkflowStep) => {
				if (step.id === stepId) {
					const updatedActions = step.actions.filter(
						(_: import("@/core").WorkflowAction, idx: number) =>
							idx !== actionIndex
					);
					return { ...step, actions: updatedActions };
				}
				return step;
			}
		);
		setWorkflow({ ...workflow, steps: updatedSteps });
	};

	const reorderSteps = (fromIndex: number, toIndex: number) => {
		const steps = [...(workflow.steps || [])];
		const [moved] = steps.splice(fromIndex, 1);
		steps.splice(toIndex, 0, moved);

		// Update order values
		const reorderedSteps = steps.map((step, index) => ({
			...step,
			order: index,
		}));

		setWorkflow({ ...workflow, steps: reorderedSteps });
	};

	const handleSelectStepTemplate = (template: StepTemplate) => {
		const newStep: WorkflowStep = {
			id: `step_${Date.now()}`,
			name: template.step.name || "",
			type: template.step.type || "action",
			actions: template.step.actions || [],
			conditions: template.step.conditions,
			delaySeconds: template.step.delaySeconds,
			parallelSteps: template.step.parallelSteps,
			trueBranchSteps: template.step.trueBranchSteps,
			falseBranchSteps: template.step.falseBranchSteps,
			order: workflow.steps?.length || 0,
		};
		setWorkflow({
			...workflow,
			steps: [...(workflow.steps || []), newStep],
		});
		setShowStepTemplates(false);
		toast.success(`Added "${template.name}" step template`);
	};

	const handleSelectWorkflowTemplate = (template: WorkflowTemplate) => {
		setWorkflow({
			...template.workflow,
			name: template.workflow.name,
			description: template.workflow.description,
		});
		setShowTemplates(false);
		toast.success(`Loaded "${template.name}" workflow template`);
	};

	const handleStartExecution = () => {
		setIsExecuting(true);
		setExecutionStepId(undefined);
		// Execution logic will be handled by ExecutionPreview component
	};

	const handleStopExecution = () => {
		setIsExecuting(false);
		setExecutionStepId(undefined);
	};

	const handleEditStep = (step: WorkflowStep) => {
		setEditingStep(step);
		setShowStepEditor(true);
	};

	const handleSaveStep = (updatedStep: WorkflowStep) => {
		// Check if this is a branch step by searching through all condition steps
		let isBranchStep = false;
		let parentConditionStep: WorkflowStep | undefined;
		let branch: "true" | "false" | undefined;

		for (const step of workflow.steps || []) {
			if (step.type === "condition") {
				// Check true branch
				if (
					step.trueBranchSteps?.some(
						(s: WorkflowStep) => s.id === updatedStep.id
					)
				) {
					isBranchStep = true;
					parentConditionStep = step;
					branch = "true";
					break;
				}
				// Check false branch
				if (
					step.falseBranchSteps?.some(
						(s: WorkflowStep) => s.id === updatedStep.id
					)
				) {
					isBranchStep = true;
					parentConditionStep = step;
					branch = "false";
					break;
				}
			}
		}

		if (isBranchStep && parentConditionStep && branch) {
			// Update branch step through parent condition step
			updateBranchStep(
				parentConditionStep.id,
				branch,
				updatedStep.id,
				updatedStep
			);
		} else {
			// Regular step update
			updateStep(updatedStep.id, updatedStep);
		}

		setEditingStep(null);
		setShowStepEditor(false);
	};

	const addBranchStep = (
		conditionStepId: string,
		branch: "true" | "false"
	) => {
		const conditionStep = workflow.steps?.find(
			(s) => s.id === conditionStepId
		);
		if (!conditionStep || conditionStep.type !== "condition") return;

		const newBranchStep: WorkflowStep = {
			id: `branch_step_${Date.now()}`,
			name: `New ${branch === "true" ? "True" : "False"} Branch Step`,
			type: "action",
			actions: [],
			order:
				branch === "true"
					? conditionStep.trueBranchSteps?.length || 0
					: conditionStep.falseBranchSteps?.length || 0,
		};

		const updatedStep = {
			...conditionStep,
			[branch === "true" ? "trueBranchSteps" : "falseBranchSteps"]: [
				...(branch === "true"
					? conditionStep.trueBranchSteps || []
					: conditionStep.falseBranchSteps || []),
				newBranchStep,
			],
		};

		updateStep(conditionStepId, updatedStep);
	};

	const updateBranchStep = (
		conditionStepId: string,
		branch: "true" | "false",
		branchStepId: string,
		updates: Partial<WorkflowStep>
	) => {
		const conditionStep = workflow.steps?.find(
			(s) => s.id === conditionStepId
		);
		if (!conditionStep || conditionStep.type !== "condition") return;

		const branchSteps =
			branch === "true"
				? conditionStep.trueBranchSteps || []
				: conditionStep.falseBranchSteps || [];

		const updatedBranchSteps = branchSteps.map((step: WorkflowStep) =>
			step.id === branchStepId ? { ...step, ...updates } : step
		);

		const updatedStep = {
			...conditionStep,
			[branch === "true" ? "trueBranchSteps" : "falseBranchSteps"]:
				updatedBranchSteps,
		};

		updateStep(conditionStepId, updatedStep);
	};

	const deleteBranchStep = (
		conditionStepId: string,
		branch: "true" | "false",
		branchStepId: string
	) => {
		const conditionStep = workflow.steps?.find(
			(s) => s.id === conditionStepId
		);
		if (!conditionStep || conditionStep.type !== "condition") return;

		const branchSteps =
			branch === "true"
				? conditionStep.trueBranchSteps || []
				: conditionStep.falseBranchSteps || [];

		const updatedBranchSteps = branchSteps.filter(
			(step: WorkflowStep) => step.id !== branchStepId
		);

		const updatedStep = {
			...conditionStep,
			[branch === "true" ? "trueBranchSteps" : "falseBranchSteps"]:
				updatedBranchSteps,
		};

		updateStep(conditionStepId, updatedStep);
	};

	return (
		<div className="space-y-6">
			<WorkflowHeader
				workflow={workflow as any}
				editingWorkflow={editingWorkflow}
				onUpdateWorkflow={handleUpdateWorkflow}
				onCancelEdit={onCancelEdit}
			/>

			{/* Validation Errors Summary */}
			{!validationResult.valid && (
				<div className="p-4 bg-destructive/10 border border-destructive rounded-lg">
					<p className="text-sm font-medium text-destructive mb-2">
						Please fix the following errors:
					</p>
					<ul className="text-sm text-destructive/80 space-y-1 list-disc list-inside">
						{validationResult.errors
							.slice(0, 5)
							.map((error, index) => (
								<li key={index}>{error.message}</li>
							))}
						{validationResult.errors.length > 5 && (
							<li>
								... and {validationResult.errors.length - 5}{" "}
								more errors
							</li>
						)}
					</ul>
				</div>
			)}

			<WorkflowSteps
				steps={workflow.steps || []}
				onAddStep={addStep}
				onUpdateStep={updateStep}
				onDeleteStep={deleteStep}
				onAddAction={addAction}
				onUpdateAction={updateAction}
				onDeleteAction={deleteAction}
				onReorderSteps={reorderSteps}
				onAddBranchStep={addBranchStep}
				onUpdateBranchStep={updateBranchStep}
				onDeleteBranchStep={deleteBranchStep}
				workflow={workflow}
				validationErrors={validationResult.stepErrors}
				isExecuting={isExecuting}
				executionStepId={executionStepId}
				onStartExecution={handleStartExecution}
				onStopExecution={handleStopExecution}
				onEditStep={handleEditStep}
			/>

			<WorkflowActions
				workflow={workflow as any}
				onSave={handleSaveWorkflow}
				onPreview={onPreview}
				isSaving={createWorkflow.isPending || updateWorkflow.isPending}
				isValid={validationResult.valid}
			/>

			{/* Workflow Templates Dialog */}
			<Dialog open={showTemplates} onOpenChange={setShowTemplates}>
				<DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Workflow Templates</DialogTitle>
					</DialogHeader>
					<WorkflowTemplates
						onSelectTemplate={handleSelectWorkflowTemplate}
					/>
				</DialogContent>
			</Dialog>

			{/* Step Templates Dialog */}
			<Dialog
				open={showStepTemplates}
				onOpenChange={setShowStepTemplates}
			>
				<DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Step Templates</DialogTitle>
					</DialogHeader>
					<StepTemplates
						onSelectTemplate={handleSelectStepTemplate}
					/>
				</DialogContent>
			</Dialog>

			{/* Execution Preview Dialog */}
			<Dialog
				open={showExecutionPreview}
				onOpenChange={setShowExecutionPreview}
			>
				<DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Execution Preview</DialogTitle>
					</DialogHeader>
					<ExecutionPreview
						workflow={workflow as Partial<WorkflowData>}
						onClose={() => setShowExecutionPreview(false)}
					/>
				</DialogContent>
			</Dialog>

			{/* Step Editor Dialog */}
      <StepEditorDialog
        step={editingStep}
        open={showStepEditor}
        onOpenChange={setShowStepEditor}
        onSave={handleSaveStep}
      />
		</div>
	);
}
