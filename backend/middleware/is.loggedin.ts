
import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { User } from "../entities/user.entity";
import { AppDataSource } from "../config/data.source";
import { AppError } from "../errors/app.error";

interface AuthTokenPayload extends JwtPayload {
  userId: string;
  organizationId?: string;
  role: string;
  type: string;
}

export const isLoggedIn = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    const token = req.cookies?.token || bearerToken;

    if (!token || typeof token !== "string") {
      throw new AppError("Authentication required. Please log in.", 401, "UNAUTHORIZED");
    }

    // 2. Ensure the JWT secret is configured
    const secret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET;

    if (!secret) {
      console.error("JWT_SECRET is not configured.");
      throw new AppError("Internal server error.", 500, "INTERNAL_SERVER_ERROR");
    }

    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] }) as any;

    if (
      !decoded ||
      typeof decoded === "string" ||
      typeof decoded.userId !== "string" ||
      decoded.userId.length === 0
    ) {
      throw new AppError("Invalid authentication token.", 401, "INVALID_TOKEN");
    }

    const payload = decoded as AuthTokenPayload;
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: payload.userId },
      select: { id: true, role: true, organizationId: true, status: true },
    });

    if (!user || user.status !== "ACTIVE") {
      throw new AppError("Invalid authentication token.", 401, "INVALID_TOKEN");
    }

    req.user = {
      id: user.id,
      role: user.role,
      organizationId: user.organizationId ?? undefined,
    };
    next();
  } catch (error: unknown) {
    if (
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.TokenExpiredError
    ) {
      next(new AppError("Invalid or expired authentication token.", 401, "INVALID_TOKEN"));
      return;
    }
    next(error);
  }
};
