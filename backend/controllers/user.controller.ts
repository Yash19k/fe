import { Request, Response } from "express";
import * as bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/data.source";
import { User, UserRole, UserStatus } from "../entities/user.entity";
import { Organization } from "../entities/organization.entity";
import { loginSchema, onboardingSchema } from "../validations/user.validator";
import { AppError } from "../errors/app.error";

const userRepository = AppDataSource.getRepository(User);
const organizationRepository = AppDataSource.getRepository(Organization);

export interface InvitedMember {
  email: string;
  role: UserRole;
}

function issueAuthCookie(
  res: Response,
  user: { id: string; role?: string; organizationId?: string | null }
): string {
  const secret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError("Internal server error.", 500, "INTERNAL_SERVER_ERROR");
  }
  const token = jwt.sign(
    {
      userId: user.id,
      role: user.role || "ADMIN",
      organizationId: user.organizationId || undefined,
      type: "ACCESS",
    },
    secret,
    { algorithm: "HS256", expiresIn: "7d" }
  );
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return token;
}

export interface RegisterOrganizationPayload {
  fullName: string;
  email: string;
  passwordHash: string;
  orgName: string;
  slug: string;
  invitedMembers?: InvitedMember[];
}


export async function registerOrganization(req: Request, res: Response) {

   const { error, value } = onboardingSchema.validate(req.body, {
     abortEarly: false, // return all errors, not just the first
     stripUnknown: true, // drop fields you didn't define
   });

   if (error) {
     throw new AppError(
       error.details.map((d) => `${d.path.join(".")}: ${d.message}`).join(", "),
       400,
       "VALIDATION_ERROR",
     );
    }
    const { user, organization } = value;

  try {
    // hash before the transaction so the DB connection isn't held while hashing
    const passwordHash = await bcrypt.hash(user.password, 12);

    const result = await AppDataSource.transaction(async (m) => {
      // step 2 data: organization
      const org = await m.save(Organization, {
        name: organization.name,
        slug: organization.slug.toLowerCase(),
      });

      // step 1 data: user, linked to the organization
      const newUser = await m.save(User, {
        organizationId: org.id,
        fullName: user.fullName,
        email: user.email.toLowerCase(),
        passwordHash,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      });

      return { org, newUser };
    });

    const token = issueAuthCookie(res, {
      id: result.newUser.id,
      role: result.newUser.role,
      organizationId: result.org.id,
    });

    return res.status(201).json({
      success: true,
      token,
      organizationId: result.org.id,
      userId: result.newUser.id,
      data: {
        organizationId: result.org.id,
        userId: result.newUser.id,
      },
      user: {
        id: result.newUser.id,
        name: result.newUser.fullName,
        email: result.newUser.email,
        role: result.newUser.role,
        companyId: result.org.id,
        companyName: result.org.name,
        onboardingCompleted: false,
      },
      organization: {
        id: result.org.id,
        name: result.org.name,
        createdByUserId: result.newUser.id,
        createdAt: result.org.createdAt,
      },
    });
  } catch (err: unknown) {
    // Postgres unique violation: email or slug already exists
    if (typeof err === "object" && err !== null && "code" in err && err.code === "23505") {
      throw new AppError("Email or workspace URL already in use", 409, "CONFLICT");
    }
    throw err;
  }
}

export async function login(req: Request, res: Response) {
  const { error, value } = loginSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new AppError(
      error.details.map((detail) => `${detail.path.join(".")}: ${detail.message}`).join(", "),
      400,
      "VALIDATION_ERROR",
    );
  }

  const user = await userRepository.findOne({ where: { email: value.email } });
  if (!user || user.status !== UserStatus.ACTIVE || !(await bcrypt.compare(value.password, user.passwordHash))) {
    throw new AppError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
  }

  if (!user.organizationId) {
    throw new AppError("Organization not found.", 404, "ORGANIZATION_NOT_FOUND");
  }

  const organization = await organizationRepository.findOne({ where: { id: user.organizationId } });
  if (!organization) {
    throw new AppError("Organization not found.", 404, "ORGANIZATION_NOT_FOUND");
  }

  const token = issueAuthCookie(res, {
    id: user.id,
    role: user.role,
    organizationId: user.organizationId,
  });

  return res.json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.fullName,
      email: user.email,
      role: user.role,
      companyId: organization.id,
      companyName: organization.name,
      onboardingCompleted: true,
    },
    organization: {
      id: organization.id,
      name: organization.name,
      createdByUserId: user.id,
      createdAt: organization.createdAt,
    },
  });
}

export async function currentUser(req: Request, res: Response) {
  const userRepository = AppDataSource.getRepository(User);
  const organizationRepository = AppDataSource.getRepository(Organization);
  const user = await userRepository.findOne({ where: { id: req.user!.id } });

  if (!user || user.status !== UserStatus.ACTIVE) {
    throw new AppError("Invalid authentication token.", 401, "INVALID_TOKEN");
  }

  if (!user.organizationId) {
    throw new AppError("Organization not found.", 404, "ORGANIZATION_NOT_FOUND");
  }

  const organization = await organizationRepository.findOne({ where: { id: user.organizationId } });
  if (!organization) {
    throw new AppError("Organization not found.", 404, "ORGANIZATION_NOT_FOUND");
  }

  return res.json({
    user: {
      id: user.id,
      name: user.fullName,
      email: user.email,
      role: user.role,
      companyId: organization.id,
      companyName: organization.name,
      onboardingCompleted: true,
    },
    organization: {
      id: organization.id,
      name: organization.name,
      createdByUserId: user.id,
      createdAt: organization.createdAt,
    },
  });
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res.json({ success: true });
}
