"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPaginationMeta = exports.getPagination = void 0;
const getPagination = ({ page, limit, }) => {
    return {
        skip: (page - 1) * limit,
        take: limit,
    };
};
exports.getPagination = getPagination;
const getPaginationMeta = ({ page, limit, total, }) => {
    return {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
    };
};
exports.getPaginationMeta = getPaginationMeta;
