import { handleHello } from "./routes/hello.js";
import { handleTestUsers } from "./routes/test-users.js";
import { handleComplexes } from "./routes/complexes.js";
import { handleBuildings } from "./routes/buildings.js";
import { handleMe } from "./routes/me.js";
import { handleResidentVerification } from "./routes/resident-verifications.js";
import { handleMyResidentVerification } from "./routes/my-resident-verification.js";
import { handleAdminResidentVerificationList } from "./routes/admin-resident-verification-list.js";
import { handleApproveResidentVerification } from "./routes/admin-resident-verifications.js";

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

    if (url.pathname === "/api/me/resident-verification") {
      return handleMyResidentVerification(request, env);
    }

    if (url.pathname === "/api/resident-verifications") {
      return handleResidentVerification(request, env);
    }

    if (url.pathname === "/api/admin/resident-verifications") {
      return handleAdminResidentVerificationList(request, env);
    }

    const approveMatch = url.pathname.match(
      /^\/api\/admin\/resident-verifications\/(\d+)\/approve$/
    );

    if (approveMatch) {
      const verificationId = approveMatch[1];

      return handleApproveResidentVerification(
        request,
        env,
        verificationId
      );
    }

    return new Response("Danjion API Dev", {
      headers: {
        "Content-Type": "text/plain; charset=UTF-8",
      },
    });
  },
};