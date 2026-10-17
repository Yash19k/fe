
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

    const token = req.cookies?.token || bearerToken;

    if (!token || typeof token !== "string") {
      throw new AppError(
        "Authentication required. Please log in.",
        401,
        "UNAUTHORIZED",
      );
    }

    const decoded = jwt.verify(
      token,
      config.accessTokenSecret,
      { algorithms: ["HS256"] },
    );

    if (
      typeof decoded === "string" ||
      typeof decoded.userId !== "string" ||
      decoded.userId.length === 0 ||
      decoded.type !== "ACCESS"
    ) {
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
