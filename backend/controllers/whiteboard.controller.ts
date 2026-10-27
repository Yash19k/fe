import { Request, Response } from "express";
import * as service from "../services/whiteboard.service";

export async function createWhiteboard(req: Request, res: Response) {
  const data = await service.createWhiteboard(
    String(req.params.projectId),
    req.user!.id,
    req.user!.organizationId,
    req.body.name,
  );
  return res.status(201).json({ success: true, data });
}

export async function listWhiteboards(req: Request, res: Response) {
  const data = await service.listWhiteboards(
    String(req.params.projectId),
    req.user!.id,
    req.user!.organizationId,
    Number(req.query.page),
    Number(req.query.limit),
  );
  return res.json({ success: true, data });
}

export async function getWhiteboard(req: Request, res: Response) {
  const data = await service.getWhiteboard(String(req.params.whiteboardId), req.user!.id, req.user!.organizationId);
  return res.json({ success: true, data });
}

export async function listWhiteboardRevisions(req: Request, res: Response) {
  const data = await service.listWhiteboardRevisions(
    String(req.params.whiteboardId),
    req.user!.id,
    req.user!.organizationId,
    Number(req.query.page),
    Number(req.query.limit),
  );
  return res.json({ success: true, data });
}

export async function getWhiteboardRevision(req: Request, res: Response) {
  const data = await service.getWhiteboardRevision(
    String(req.params.whiteboardId),
    Number(req.params.revisionNumber),
    req.user!.id,
    req.user!.organizationId,
  );
  return res.json({ success: true, data });
}

export async function updateWhiteboard(req: Request, res: Response) {
  const data = await service.updateWhiteboard(
    String(req.params.whiteboardId),
    req.user!.id,
    req.user!.organizationId,
    req.body.sceneData,
    req.body.revision,
  );
  return res.json({ success: true, data });
}

export async function renameWhiteboard(req: Request, res: Response) {
  const data = await service.renameWhiteboard(
    String(req.params.whiteboardId),
    req.user!.id,
    req.user!.organizationId,
    req.body.name,
  );
  return res.json({ success: true, data });
}

export async function deleteWhiteboard(req: Request, res: Response) {
  await service.deleteWhiteboard(String(req.params.whiteboardId), req.user!.id, req.user!.organizationId);
  return res.json({ success: true, data: { id: req.params.whiteboardId } });
}
