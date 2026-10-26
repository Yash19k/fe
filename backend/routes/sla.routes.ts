import { Router } from "express";
import { getOrganizationSla, updateOrganizationSla } from "../controllers/sla.controller";
import { isLoggedIn } from "../middleware/is.loggedin";
import { asyncHandler } from "../middleware/async.handler";

const router = Router();

router.use(isLoggedIn);

router.get("/", asyncHandler(getOrganizationSla));
router.put("/", asyncHandler(updateOrganizationSla));
router.patch("/", asyncHandler(updateOrganizationSla));

export default router;
