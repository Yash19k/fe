"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_WORKFLOW_STATUSES = exports.DEFAULT_WORKFLOW_NAME = void 0;
exports.validateWorkflowConfiguration = validateWorkflowConfiguration;
exports.validateWorkItemStatusTransition = validateWorkItemStatusTransition;
exports.assertWorkItemStatusTransition = assertWorkItemStatusTransition;
const project_workflow_entity_1 = require("../entities/project.workflow.entity");
const app_error_1 = require("../errors/app.error");
exports.DEFAULT_WORKFLOW_NAME = "TaskFlow Pro — Final Statuses";
exports.DEFAULT_WORKFLOW_STATUSES = [
    { id: "st-backlog", name: "Backlog", category: "unstarted", color: "#6B7280", allowedTransitions: ["In Progress"] },
    { id: "st-inprogress", name: "In Progress", category: "active", color: "#3B82F6", allowedTransitions: ["In Review", "Testing / QA", "Blocked", "On Hold"] },
    { id: "st-inreview", name: "In Review", category: "active", color: "#A855F7", allowedTransitions: ["Testing / QA", "In Progress", "Blocked", "On Hold"] },
    { id: "st-testingqa", name: "Testing / QA", category: "active", color: "#06B6D4", allowedTransitions: ["Done", "In Progress", "Blocked", "On Hold"], roleRestrictions: { Done: ["Manager", "Admin"] } },
    { id: "st-blocked", name: "Blocked", category: "impediment", color: "#EF4444", allowedTransitions: ["Backlog", "In Progress", "In Review", "Testing / QA"] },
    { id: "st-onhold", name: "On Hold", category: "impediment", color: "#F97316", allowedTransitions: ["Backlog", "In Progress", "In Review", "Testing / QA"] },
    { id: "st-done", name: "Done", category: "completed", color: "#22C55E", allowedTransitions: ["In Progress"] },
];
function normalizeStatus(value) {
    return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}
function normalizeWorkflowName(value) {
    return value.trim().replace(/\s+/g, " ").toLowerCase();
}
function isWorkflowStage(value) {
    return typeof value === "object" && value !== null &&
        "name" in value && typeof value.name === "string";
}
function validateWorkflowConfiguration(value) {
    if (!Array.isArray(value) || value.length === 0) {
        throw new app_error_1.AppError("Workflow stages or statuses array is required and must not be empty.", 400, "VALIDATION_ERROR");
    }
    const stages = value.map((item, index) => {
        if (typeof item !== "object" || item === null || Array.isArray(item)) {
            throw new app_error_1.AppError(`Workflow stage ${index + 1} is invalid.`, 400, "VALIDATION_ERROR");
        }
        const stage = item;
        const id = typeof stage.id === "string" ? stage.id.trim() : "";
        const name = typeof stage.name === "string" ? stage.name.trim().replace(/\s+/g, " ") : "";
        const color = typeof stage.color === "string" ? stage.color.trim() : "";
        if (!id || !name || name.length > 150 || !/^#[0-9a-f]{6}$/i.test(color)) {
            throw new app_error_1.AppError(`Workflow stage ${index + 1} must have an ID, a name of at most 150 characters, and a valid hex color.`, 400, "VALIDATION_ERROR");
        }
        if (stage.allowedTransitions !== undefined && !Array.isArray(stage.allowedTransitions)) {
            throw new app_error_1.AppError(`Allowed transitions for "${name}" must be an array.`, 400, "VALIDATION_ERROR");
        }
        return { ...stage, id, name, color };
    });
    const names = new Set();
    const ids = new Set();
    for (const stage of stages) {
        const normalizedName = normalizeWorkflowName(stage.name);
        const normalizedId = stage.id.toLowerCase();
        if (names.has(normalizedName)) {
            throw new app_error_1.AppError(`Workflow stage "${stage.name}" duplicates another stage name.`, 400, "VALIDATION_ERROR");
        }
        if (ids.has(normalizedId)) {
            throw new app_error_1.AppError(`Workflow stage ID "${stage.id}" is duplicated.`, 400, "VALIDATION_ERROR");
        }
        names.add(normalizedName);
        ids.add(normalizedId);
    }
    const stagesByName = new Map(stages.map((stage) => [normalizeWorkflowName(stage.name), stage]));
    const stagesById = new Map(stages.map((stage) => [stage.id.toLowerCase(), stage]));
    return stages.map((stage) => {
        const transitions = (stage.allowedTransitions || []);
        const transitionTargets = new Set();
        const allowedTransitions = transitions.map((transition) => {
            if (typeof transition !== "string" || !transition.trim()) {
                throw new app_error_1.AppError(`Allowed transitions for "${stage.name}" must reference workflow stages.`, 400, "VALIDATION_ERROR");
            }
            const target = stagesByName.get(normalizeWorkflowName(transition)) ||
                stagesById.get(transition.trim().toLowerCase());
            if (!target) {
                throw new app_error_1.AppError(`Allowed transition "${transition}" for "${stage.name}" does not reference a workflow stage.`, 400, "VALIDATION_ERROR");
            }
            const targetId = target.id.toLowerCase();
            if (transitionTargets.has(targetId)) {
                throw new app_error_1.AppError(`Allowed transitions for "${stage.name}" contain a duplicate stage.`, 400, "VALIDATION_ERROR");
            }
            transitionTargets.add(targetId);
            return target.name;
        });
        return { ...stage, allowedTransitions };
    });
}
function validateWorkItemStatusTransition(currentStatus, nextStatus, actorRole, configuredStages) {
    if (currentStatus === nextStatus)
        return;
    const stages = Array.isArray(configuredStages) && configuredStages.every(isWorkflowStage)
        ? configuredStages
        : [];
    const currentStage = stages.find((stage) => normalizeStatus(stage.name) === normalizeStatus(currentStatus));
    const nextStage = stages.find((stage) => normalizeStatus(stage.name) === normalizeStatus(nextStatus));
    if (!currentStage || !nextStage || !Array.isArray(currentStage.allowedTransitions)) {
        throw new app_error_1.AppError("This status transition is not configured for the project workflow.", 409, "INVALID_STATUS_TRANSITION");
    }
    const allowedTransitions = currentStage.allowedTransitions.filter((transition) => typeof transition === "string");
    const canTransition = allowedTransitions.some((transition) => normalizeStatus(transition) === normalizeStatus(nextStage.name) ||
        (nextStage.id !== undefined &&
            normalizeStatus(transition) === normalizeStatus(nextStage.id)));
    if (!canTransition) {
        throw new app_error_1.AppError("This status transition is not allowed by the project workflow.", 409, "INVALID_STATUS_TRANSITION");
    }
    const restrictions = currentStage.roleRestrictions;
    if (typeof restrictions === "object" && restrictions !== null) {
        const targetRestriction = Object.entries(restrictions).find(([status]) => normalizeStatus(status) === normalizeStatus(nextStage.name))?.[1];
        if (targetRestriction !== undefined) {
            const allowedRoles = Array.isArray(targetRestriction)
                ? targetRestriction.filter((role) => typeof role === "string")
                : [];
            if (!allowedRoles.some((role) => normalizeStatus(role) === normalizeStatus(actorRole))) {
                throw new app_error_1.AppError("Your role is not permitted to move this work item to that status.", 403, "FORBIDDEN");
            }
        }
    }
}
async function assertWorkItemStatusTransition(manager, projectId, currentStatus, nextStatus, actorRole) {
    if (currentStatus === nextStatus)
        return;
    const workflow = await manager.getRepository(project_workflow_entity_1.ProjectWorkflow).findOne({
        where: { projectId },
        select: { statuses: true },
    });
    validateWorkItemStatusTransition(currentStatus, nextStatus, actorRole, workflow ? workflow.statuses : exports.DEFAULT_WORKFLOW_STATUSES);
}
