import { handleHello } from "./routes/hello.js";
import { handleTestUsers } from "./routes/test-users.js";
import { handleComplexes } from "./routes/complexes.js";
import { handleBuildings } from "./routes/buildings.js";
import { handleMe } from "./routes/me.js";

import {
  handleResidentVerification,
} from "./routes/resident-verifications.js";

import {
  handleMyResidentVerification,
} from "./routes/my-resident-verification.js";

import {
  handleAdminResidentVerificationList,
} from "./routes/admin-resident-verification-list.js";

import {
  handleApproveResidentVerification,
} from "./routes/admin-resident-verifications.js";

import {
  handleBusinesses,
} from "./routes/businesses.js";

import {
  handleAdminBusinessList,
  handleApproveBusiness,
} from "./routes/admin-businesses.js";

import {
  handleBusinessCategories,
  handleMyBusinesses,
  handleBusinessDetail,
  handleUpdateMyBusiness,
  handleBusinessHours,
  handleBusinessBenefits,
} from "./routes/business-management.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/hello") {
      return handleHello();
    }

    if (url.pathname === "/api/test-users") {
      return handleTestUsers(env);
    }

    if (url.pathname === "/api/complexes") {
      return handleComplexes(env);
    }

    if (url.pathname === "/api/buildings") {
      return handleBuildings(env);
    }

    if (url.pathname === "/api/me") {
      return handleMe(request, env);
    }

    if (
      url.pathname ===
      "/api/me/resident-verification"
    ) {
      return handleMyResidentVerification(
        request,
        env
      );
    }

    if (
      url.pathname ===
      "/api/resident-verifications"
    ) {
      return handleResidentVerification(
        request,
        env
      );
    }

    if (
      url.pathname ===
      "/api/admin/resident-verifications"
    ) {
      return handleAdminResidentVerificationList(
        request,
        env
      );
    }

    const residentApproveMatch =
      url.pathname.match(
        /^\/api\/admin\/resident-verifications\/(\d+)\/approve$/
      );

    if (residentApproveMatch) {
      return handleApproveResidentVerification(
        request,
        env,
        residentApproveMatch[1]
      );
    }

    // ==================================================
    // 이웃가게
    // ==================================================

    if (
      url.pathname ===
      "/api/business-categories"
    ) {
      return handleBusinessCategories(
        request,
        env
      );
    }

    if (
      url.pathname ===
      "/api/businesses"
    ) {
      return handleBusinesses(
        request,
        env
      );
    }

    if (
      url.pathname ===
      "/api/me/businesses"
    ) {
      return handleMyBusinesses(
        request,
        env
      );
    }

    const myBusinessHoursMatch =
      url.pathname.match(
        /^\/api\/me\/businesses\/(\d+)\/hours$/
      );

    if (myBusinessHoursMatch) {
      return handleBusinessHours(
        request,
        env,
        myBusinessHoursMatch[1]
      );
    }

    const myBusinessBenefitsMatch =
      url.pathname.match(
        /^\/api\/me\/businesses\/(\d+)\/benefits$/
      );

    if (myBusinessBenefitsMatch) {
      return handleBusinessBenefits(
        request,
        env,
        myBusinessBenefitsMatch[1]
      );
    }

    const myBusinessMatch =
      url.pathname.match(
        /^\/api\/me\/businesses\/(\d+)$/
      );

    if (myBusinessMatch) {
      return handleUpdateMyBusiness(
        request,
        env,
        myBusinessMatch[1]
      );
    }

    const businessDetailMatch =
      url.pathname.match(
        /^\/api\/businesses\/(\d+)$/
      );

    if (businessDetailMatch) {
      return handleBusinessDetail(
        request,
        env,
        businessDetailMatch[1]
      );
    }

    if (
      url.pathname ===
      "/api/admin/businesses"
    ) {
      return handleAdminBusinessList(
        request,
        env
      );
    }

    const businessApproveMatch =
      url.pathname.match(
        /^\/api\/admin\/businesses\/(\d+)\/approve$/
      );

    if (businessApproveMatch) {
      return handleApproveBusiness(
        request,
        env,
        businessApproveMatch[1]
      );
    }

    return new Response(
      "Danjion API Dev",
      {
        headers: {
          "Content-Type":
            "text/plain; charset=UTF-8",
        },
      }
    );
  },
};