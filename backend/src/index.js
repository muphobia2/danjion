import { handleHello } from "./routes/hello.js";
import { handleTestUsers } from "./routes/test-users.js";
import { handleComplexes } from "./routes/complexes.js";

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

    return new Response("Danjion API Dev", {
      headers: {
        "Content-Type": "text/plain; charset=UTF-8",
      },
    });
  },
};