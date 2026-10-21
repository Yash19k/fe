
import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { User, UserStatus } from "../entities/user.entity";
import { AppDataSource } from "../config/data.source";
import { config } from "../config/config";
import { AppError } from "../errors/app.error";

interface AuthTokenPayload extends JwtPayload {
  userId: string;
  type: "ACCESS";
}

export const isLoggedIn = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken =
      authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : undefined;

    const cookieToken =
      typeof req.cookies?.token === "string" ? req.cookies.token : undefined;

    const candidateTokens: string[] = [];
    if (bearerToken) candidateTokens.push(bearerToken);
    if (cookieToken && cookieToken !== bearerToken) candidateTokens.push(cookieToken);

    if (candidateTokens.length === 0) {
      throw new AppError(
        "Authentication required. Please log in.",
        401,
        "UNAUTHORIZED",
      );
    }

    let decoded: any = null;
    let lastError: any = null;
    for (const token of candidateTokens) {
      try {
        const candidate = jwt.verify(
          token,
          config.accessTokenSecret,
          { algorithms: ["HS256"] },
        );
        if (
          typeof candidate !== "string" &&
          typeof candidate?.userId === "string" &&
          candidate.userId.length > 0 &&
          candidate.type === "ACCESS"
        ) {
          decoded = candidate;
          lastError = null;
          break;
        }
      } catch (err) {
        lastError = err;
        decoded = null;
      }
    }

    if (!decoded || typeof decoded.userId !== "string" || decoded.userId.length === 0) {
      if (lastError instanceof jwt.JsonWebTokenError) {
        throw new AppError(
          "Invalid or expired authentication token.",
          401,
          "INVALID_TOKEN",
        );
      }
      throw new AppError(
        "Invalid authentication token.",
        401,
        "INVALID_TOKEN",
      );
    }

    const payload = decoded as AuthTokenPayload;
    const userRepository = AppDataSource.getRepository(User);

    const user = await userRepository.findOne({
      where: { id: payload.userId },
      select: {
        id: true,
        role: true,
        organizationId: true,
        status: true,
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new AppError(
        "Invalid authentication token.",
        401,
        "INVALID_TOKEN",
      );
    }

    req.user = {
      id: user.id,
      role: user.role,
      organizationId: user.organizationId ?? undefined,
    };

    next();
  } catch (error: unknown) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(
        new AppError(
          "Invalid or expired authentication token.",
          401,
          "INVALID_TOKEN",
        ),
      );
      return;
    }

    next(error);
  }
};
