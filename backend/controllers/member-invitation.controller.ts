// import { InvitedMember } from './user.controller';
// import { Request, Response, NextFunction } from "express";
// import Joi from "joi";
// import {
//   inviteOrganizationMembers,
//   acceptOrganizationInvitation,
// } from "../services/member-invitation.service";

// export async function inviteMembersController(
//   req: Request,
//   res: Response,
//   next: NextFunction,
// ) {
//   try {
//     const { error, value } = invitedMembers.validate(req.body, {
//       abortEarly: false,
//       stripUnknown: true,
//     });

//     if (error) {
//       return res.status(400).json({
//         message: "Validation failed",
//         errors: error.details.map((detail) => detail.message),
//       });
//     }

//     const authenticatedUser = req.user;

//     if (!authenticatedUser) {
//       return res.status(401).json({
//         message: "Authentication required",
//       });
//     }

//     if (authenticatedUser.role !== "ADMIN") {
//       return res.status(403).json({
//         message: "Only organization admins can invite members",
//       });
//     }

//     if (!authenticatedUser.organizationId) {
//       return res.status(400).json({
//         message: "Your account is not associated with an organization",
//       });
//     }

//     const result = await inviteOrganizationMembers(
//       authenticatedUser.organizationId,
//       value,
//     );

//     return res.status(200).json(result);
//   } catch (error) {
//     if (error instanceof Error) {
//       if (
//         error.message === "Organization not found" ||
//         error.message === "Duplicate email addresses are not allowed"
//       ) {
//         return res.status(400).json({
//           message: error.message,
//         });
//       }

//       if (error.message.startsWith("These email addresses already exist:")) {
//         return res.status(409).json({
//           message: error.message,
//         });
//       }
//     }

//     next(error);
//   }
// }

// export async function acceptInvitationController(
//   req: Request,
//   res: Response,
//   next: NextFunction,
// ) {
//   try {
//     const { error, value } = acceptInvitationSchema.validate(req.body, {
//       abortEarly: false,
//       stripUnknown: true,
//     });

//     if (error) {
//       return res.status(400).json({
//         message: "Validation failed",
//         errors: error.details.map((detail:any) => detail.message),
//       });
//     }

//     const result = await acceptOrganizationInvitation(
//       value.token,
//       value.fullName,
//       value.password,
//     );

//     return res.status(200).json(result);
//   } catch (error) {
//     if (error instanceof Error) {
//       const clientErrors = [
//         "Invalid invitation token",
//         "Invitation has expired",
//         "Invitation has already been accepted or is invalid",
//         "Invitation is invalid, expired, or already used",
//       ];

//       if (clientErrors.includes(error.message)) {
//         return res.status(400).json({
//           message: error.message,
//         });
//       }
//     }

//     next(error);
//   }
// }
