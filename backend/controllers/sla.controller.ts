import { Request, Response } from "express";
import { AppDataSource } from "../config/data.source";
import { OrganizationSla } from "../entities/organization.sla.entity";
import { UserRole } from "../entities/user.entity";
import { AppError } from "../errors/app.error";

const DEFAULT_SLA = {
  urgentHours: 4,
  highHours: 8,
  mediumHours: 24,
  lowHours: 72,
  escalateHours: 8,
};

export async function getOrganizationSla(req: Request, res: Response) {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new AppError("Organization not found.", 404, "ORGANIZATION_NOT_FOUND");
  }

  const repo = AppDataSource.getRepository(OrganizationSla);
  let slaPolicy = await repo.findOne({
    where: { organizationId },
  });

  if (!slaPolicy) {
    slaPolicy = await repo.save(
      repo.create({
        organizationId,
        ...DEFAULT_SLA,
      }),
    );
  }

  return res.json({
    success: true,
    data: {
      id: slaPolicy.id,
      organizationId: slaPolicy.organizationId,
      urgentHours: slaPolicy.urgentHours,
      highHours: slaPolicy.highHours,
      mediumHours: slaPolicy.mediumHours,
      lowHours: slaPolicy.lowHours,
      escalateHours: slaPolicy.escalateHours,
      warningThresholdHours: slaPolicy.escalateHours,
      createdAt: slaPolicy.createdAt,
      updatedAt: slaPolicy.updatedAt,
    },
  });
}

export async function updateOrganizationSla(req: Request, res: Response) {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new AppError("Organization not found.", 404, "ORGANIZATION_NOT_FOUND");
  }

  if (req.user?.role !== UserRole.ADMIN && req.user?.role !== UserRole.MANAGER) {
    throw new AppError(
      "Only organization administrators or managers can update SLA settings.",
      403,
      "FORBIDDEN",
    );
  }

  const body = req.body || {};
  const urgent = body.urgentHours !== undefined ? Number(body.urgentHours) : (body.urgent !== undefined ? Number(body.urgent) : undefined);
  const high = body.highHours !== undefined ? Number(body.highHours) : (body.high !== undefined ? Number(body.high) : undefined);
  const medium = body.mediumHours !== undefined ? Number(body.mediumHours) : (body.medium !== undefined ? Number(body.medium) : undefined);
  const low = body.lowHours !== undefined ? Number(body.lowHours) : (body.low !== undefined ? Number(body.low) : undefined);
  const escalate = body.escalateHours !== undefined
    ? Number(body.escalateHours)
    : (body.warningThreshold !== undefined
      ? Number(body.warningThreshold)
      : (body.warningThresholdHours !== undefined
        ? Number(body.warningThresholdHours)
        : (body.escalationHours !== undefined ? Number(body.escalationHours) : undefined)));

  const fieldsToCheck = [
    { name: "urgentHours", val: urgent },
    { name: "highHours", val: high },
    { name: "mediumHours", val: medium },
    { name: "lowHours", val: low },
    { name: "escalateHours", val: escalate },
  ];

  for (const field of fieldsToCheck) {
    if (field.val !== undefined && (!Number.isFinite(field.val) || field.val <= 0)) {
      throw new AppError(
        `${field.name} must be a positive number greater than 0.`,
        400,
        "VALIDATION_ERROR",
      );
    }
  }

  const repo = AppDataSource.getRepository(OrganizationSla);
  let slaPolicy = await repo.findOne({
    where: { organizationId },
  });

  if (!slaPolicy) {
    slaPolicy = repo.create({
      organizationId,
      ...DEFAULT_SLA,
    });
  }

  if (urgent !== undefined) slaPolicy.urgentHours = Math.round(urgent);
  if (high !== undefined) slaPolicy.highHours = Math.round(high);
  if (medium !== undefined) slaPolicy.mediumHours = Math.round(medium);
  if (low !== undefined) slaPolicy.lowHours = Math.round(low);
  if (escalate !== undefined) slaPolicy.escalateHours = Math.round(escalate);

  const saved = await repo.save(slaPolicy);

  return res.json({
    success: true,
    message: "SLA policy updated successfully.",
    data: {
      id: saved.id,
      organizationId: saved.organizationId,
      urgentHours: saved.urgentHours,
      highHours: saved.highHours,
      mediumHours: saved.mediumHours,
      lowHours: saved.lowHours,
      escalateHours: saved.escalateHours,
      warningThresholdHours: saved.escalateHours,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    },
  });
}
