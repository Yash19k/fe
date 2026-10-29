"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWhiteboard = createWhiteboard;
exports.listWhiteboards = listWhiteboards;
exports.getWhiteboard = getWhiteboard;
exports.listWhiteboardRevisions = listWhiteboardRevisions;
exports.getWhiteboardRevision = getWhiteboardRevision;
exports.updateWhiteboard = updateWhiteboard;
exports.renameWhiteboard = renameWhiteboard;
exports.deleteWhiteboard = deleteWhiteboard;
const service = __importStar(require("../services/whiteboard.service"));
async function createWhiteboard(req, res) {
    const data = await service.createWhiteboard(String(req.params.projectId), req.user.id, req.user.organizationId, req.body.name);
    return res.status(201).json({ success: true, data });
}
async function listWhiteboards(req, res) {
    const data = await service.listWhiteboards(String(req.params.projectId), req.user.id, req.user.organizationId, Number(req.query.page), Number(req.query.limit));
    return res.json({ success: true, data });
}
async function getWhiteboard(req, res) {
    const data = await service.getWhiteboard(String(req.params.whiteboardId), req.user.id, req.user.organizationId);
    return res.json({ success: true, data });
}
async function listWhiteboardRevisions(req, res) {
    const data = await service.listWhiteboardRevisions(String(req.params.whiteboardId), req.user.id, req.user.organizationId, Number(req.query.page), Number(req.query.limit));
    return res.json({ success: true, data });
}
async function getWhiteboardRevision(req, res) {
    const data = await service.getWhiteboardRevision(String(req.params.whiteboardId), Number(req.params.revisionNumber), req.user.id, req.user.organizationId);
    return res.json({ success: true, data });
}
async function updateWhiteboard(req, res) {
    const data = await service.updateWhiteboard(String(req.params.whiteboardId), req.user.id, req.user.organizationId, req.body.sceneData, req.body.revision);
    return res.json({ success: true, data });
}
async function renameWhiteboard(req, res) {
    const data = await service.renameWhiteboard(String(req.params.whiteboardId), req.user.id, req.user.organizationId, req.body.name);
    return res.json({ success: true, data });
}
async function deleteWhiteboard(req, res) {
    await service.deleteWhiteboard(String(req.params.whiteboardId), req.user.id, req.user.organizationId);
    return res.json({ success: true, data: { id: req.params.whiteboardId } });
}
