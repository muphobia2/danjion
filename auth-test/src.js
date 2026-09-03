import { createAuthClient } from "@neondatabase/auth";

const AUTH_URL =
  "https://ep-old-boat-azi7guqq.neonauth.c-3.ap-southeast-1.aws.neon.tech/neondb/auth";

const auth = createAuthClient(AUTH_URL);

const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const loginButton = document.querySelector("#loginButton");
const result = document.querySelector("#result");

const buildingInput = document.querySelector("#building");
const unitInput = document.querySelector("#unit");
const verificationButton = document.querySelector("#verificationButton");
const verificationResult = document.querySelector("#verificationResult");

let currentJwt = null;

loginButton.addEventListener("click", async () => {
  let stage = "signIn";

  result.textContent = "로그인 확인 중...";
  verificationResult.textContent = "";
  verificationButton.disabled = true;
  currentJwt = null;

  try {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    const loginResult = await auth.signIn.email({
      email,
      password,
    });

    if (loginResult?.error) {
      throw loginResult.error;
    }

    stage = "getSession";

    const sessionResult = await auth.getSession();
    const session = sessionResult?.data ?? sessionResult;

    const jwt = session?.session?.token ?? null;

    if (!jwt || jwt.split(".").length !== 3) {
      throw new Error("JWT를 가져오지 못했습니다.");
    }

    currentJwt = jwt;

    stage = "apiMe";

    const meResponse = await fetch("/api/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${currentJwt}`,
      },
    });

    const me = await meResponse.json();

    if (!meResponse.ok) {
      throw new Error(
        me?.error || `API /me 실패: HTTP ${meResponse.status}`
      );
    }

    verificationButton.disabled = false;

    result.textContent = JSON.stringify(
      {
        login_ok: true,
        email_verified: session?.user?.emailVerified ?? null,
        jwt_present: true,
        jwt_format_ok: true,
        api_me_ok: me?.ok ?? false,
        danjion_user_id: me?.data?.user?.id ?? null,
        account_status: me?.data?.user?.account_status ?? null,
      },
      null,
      2
    );
  } catch (error) {
    result.textContent = JSON.stringify(
      {
        login_ok: false,
        failed_stage: stage,
        error: error?.message ?? String(error),
        status: error?.status ?? null,
        code: error?.code ?? null,
      },
      null,
      2
    );
  }
});

verificationButton.addEventListener("click", async () => {
  verificationResult.textContent = "주민인증 신청 중...";

  try {
    if (!currentJwt) {
      throw new Error("먼저 로그인해야 합니다.");
    }

    const buildingLabel = buildingInput.value.trim();
    const unitNumber = unitInput.value.trim();

    const response = await fetch("/api/resident-verifications", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${currentJwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        building_label: buildingLabel,
        unit_number: unitNumber,
      }),
    });

    const data = await response.json();

    verificationResult.textContent = JSON.stringify(
      {
        http_status: response.status,
        ...data,
      },
      null,
      2
    );
  } catch (error) {
    verificationResult.textContent = JSON.stringify(
      {
        ok: false,
        error: error?.message ?? String(error),
      },
      null,
      2
    );
  }
});