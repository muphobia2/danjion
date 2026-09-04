import { getDb } from "../db/client.js";
import { verifyAuthToken } from "../auth/verify.js";
import { json } from "./hello.js";

const PILOT_COMPLEX_SLUG =
  "banglim-myeongji-roadhill";

const RESIDENT_LABEL =
  "로드힐 주민";

const PUBLIC_TYPES = new Set([
  "danjion_notice",
  "apartment_news",
  "resident_news",
]);

const SUBMISSION_REVIEWABLE = new Set([
  "submitted",
  "needs_more_info",
]);

function text(value) {
  return String(value ?? "").trim();
}

function nullableText(value) {
  const result = text(value);
  return result || null;
}

function pageParams(url) {
  const limit = Math.min(
    Math.max(
      Number(
        url.searchParams.get("limit") ?? 20
      ) || 20,
      1
    ),
    50
  );

  const offset = Math.max(
    Number(
      url.searchParams.get("offset") ?? 0
    ) || 0,
    0
  );

  return { limit, offset };
}

async function parseBody(request) {
  try {
    return {
      data: await request.json(),
    };
  } catch {
    return {
      error: json(
        {
          ok: false,
          error: "INVALID_JSON",
        },
        400
      ),
    };
  }
}


// ==========================================================
// VERIFIED RESIDENT (pilot complex)
// ==========================================================

async function requireResident(
  request,
  env
) {
  let auth;

  try {
    auth =
      await verifyAuthToken(
        request,
        env
      );
  } catch {
    auth = null;
  }

  if (!auth?.sub) {
    return {
      error: json(
        {
          ok: false,
          error: "UNAUTHORIZED",
        },
        401
      ),
    };
  }

  const sql =
    getDb(env.DATABASE_URL);

  const rows = await sql`
    SELECT
      u.id AS user_id,
      c.id AS complex_id

    FROM users u

    JOIN user_roles ur
      ON ur.user_id = u.id
     AND ur.role = 'resident'

    JOIN household_members hm
      ON hm.user_id = u.id
     AND hm.membership_status = 'verified'

    JOIN households h
      ON h.id = hm.household_id

    JOIN buildings b
      ON b.id = h.building_id

    JOIN complexes c
      ON c.id = b.complex_id

    WHERE u.auth_provider = 'neon_auth'
      AND u.auth_subject =
        ${String(auth.sub)}
      AND u.account_status = 'active'
      AND c.slug =
        ${PILOT_COMPLEX_SLUG}

    LIMIT 1
  `;

  if (rows.length === 0) {
    return {
      error: json(
        {
          ok: false,
          error:
            "VERIFIED_RESIDENT_REQUIRED",
        },
        403
      ),
    };
  }

  return {
    sql,
    userId:
      rows[0].user_id,
    complexId:
      rows[0].complex_id,
  };
}


// ==========================================================
// OPERATOR / ADMIN
// ==========================================================

async function requireOperator(
  request,
  env
) {
  let auth;

  try {
    auth =
      await verifyAuthToken(
        request,
        env
      );
  } catch {
    auth = null;
  }

  if (!auth?.sub) {
    return {
      error: json(
        {
          ok: false,
          error: "UNAUTHORIZED",
        },
        401
      ),
    };
  }

  const sql =
    getDb(env.DATABASE_URL);

  const rows = await sql`
    SELECT DISTINCT
      u.id AS user_id

    FROM users u

    JOIN user_roles ur
      ON ur.user_id = u.id

    WHERE u.auth_provider = 'neon_auth'
      AND u.auth_subject =
        ${String(auth.sub)}
      AND u.account_status = 'active'
      AND ur.role IN (
        'operator',
        'admin'
      )

    LIMIT 1
  `;

  if (rows.length === 0) {
    return {
      error: json(
        {
          ok: false,
          error:
            "OPERATOR_OR_ADMIN_REQUIRED",
        },
        403
      ),
    };
  }

  return {
    sql,
    userId:
      rows[0].user_id,
  };
}


// ==========================================================
// PUBLIC AUTHOR SHAPE
// Only nickname + resident label. Never building/unit/
// email/provider internals.
// ==========================================================

function publicAuthor(row) {
  if (
    row.author_type === "official"
  ) {
    return {
      type: "official",
      name:
        row.official_author_name ??
        "단지온 운영팀",
      title:
        row.official_author_title ??
        null,
    };
  }

  return {
    type: "resident",
    id: row.author_user_id,
    nickname:
      row.author_nickname ??
      "이웃 주민",
    label: RESIDENT_LABEL,
  };
}


// ==========================================================
// GUEST LANDING AGGREGATE
// GET /api/complex-content
// ==========================================================

export async function handleComplexLanding(
  request,
  env
) {
  if (request.method !== "GET") {
    return json(
      {
        ok: false,
        error:
          "METHOD_NOT_ALLOWED",
      },
      405
    );
  }

  const sql =
    getDb(env.DATABASE_URL);

  const complexRows = await sql`
    SELECT id, slug
    FROM complexes
    WHERE slug = ${PILOT_COMPLEX_SLUG}
    LIMIT 1
  `;

  if (complexRows.length === 0) {
    return json(
      {
        ok: false,
        error: "COMPLEX_NOT_FOUND",
      },
      404
    );
  }

  const complexId =
    complexRows[0].id;

  async function latest(type) {
    return sql`
      SELECT
        cc.id,
        cc.content_type,
        cc.slug,
        cc.title,
        LEFT(cc.body, 200) AS excerpt,
        cc.author_type,
        cc.author_user_id,
        cc.official_author_name,
        cc.official_author_title,
        u.display_name
          AS author_nickname,
        cc.published_at
      FROM complex_contents cc
      LEFT JOIN users u
        ON u.id = cc.author_user_id
      WHERE cc.complex_id = ${complexId}
        AND cc.content_type = ${type}
        AND cc.status = 'published'
      ORDER BY
        cc.published_at DESC,
        cc.id DESC
      LIMIT 5
    `;
  }

  const [notices, apartment, resident] =
    await Promise.all([
      latest("danjion_notice"),
      latest("apartment_news"),
      latest("resident_news"),
    ]);

  const talkRows = await sql`
    SELECT
      tp.id,
      tp.category,
      tp.title,
      LEFT(tp.body, 200) AS excerpt,
      tp.author_user_id,
      u.display_name
        AS author_nickname,
      tp.created_at,
      (
        SELECT COUNT(*)::INTEGER
        FROM talk_comments tc
        WHERE tc.post_id = tp.id
          AND tc.status = 'active'
      ) AS comment_count
    FROM talk_posts tp
    JOIN users u
      ON u.id = tp.author_user_id
    WHERE tp.complex_id = ${complexId}
      AND tp.status = 'active'
    ORDER BY
      tp.created_at DESC,
      tp.id DESC
    LIMIT 5
  `;

  function shapeContent(row) {
    return {
      id: row.id,
      content_type:
        row.content_type,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      author: publicAuthor(row),
      published_at:
        row.published_at,
    };
  }

  return json({
    ok: true,
    data: {
      complex: {
        id: complexRows[0].id,
        slug: complexRows[0].slug,
      },
      notices:
        notices.map(shapeContent),
      apartment_news:
        apartment.map(shapeContent),
      resident_news:
        resident.map(shapeContent),
      talk_latest:
        talkRows.map(row => ({
          id: row.id,
          category: row.category,
          title: row.title,
          excerpt: row.excerpt,
          author: {
            type: "resident",
            id: row.author_user_id,
            nickname:
              row.author_nickname ??
              "이웃 주민",
            label: RESIDENT_LABEL,
          },
          comment_count:
            row.comment_count,
          created_at:
            row.created_at,
        })),
    },
  });
}


// ==========================================================
// GUEST CONTENT LIST
// GET /api/notices | /api/apartment-news | /api/resident-news
// ==========================================================

export async function handlePublicContentList(
  request,
  env,
  contentType
) {
  if (request.method !== "GET") {
    return json(
      {
        ok: false,
        error:
          "METHOD_NOT_ALLOWED",
      },
      405
    );
  }

  if (!PUBLIC_TYPES.has(contentType)) {
    return json(
      {
        ok: false,
        error: "UNKNOWN_CONTENT_TYPE",
      },
      404
    );
  }

  const url =
    new URL(request.url);

  const { limit, offset } =
    pageParams(url);

  const sql =
    getDb(env.DATABASE_URL);

  const rows = await sql`
    SELECT
      cc.id,
      cc.content_type,
      cc.slug,
      cc.title,
      LEFT(cc.body, 200) AS excerpt,
      cc.author_type,
      cc.author_user_id,
      cc.official_author_name,
      cc.official_author_title,
      u.display_name
        AS author_nickname,
      cc.published_at,
      CASE
        WHEN cc.content_type = 'resident_news'
          AND cc.reactions_enabled
        THEN (
          SELECT COUNT(*)::INTEGER
          FROM reactions r
          WHERE r.target_kind = 'resident_news'
            AND r.target_id = cc.id
        )
        ELSE 0
      END AS reaction_count
    FROM complex_contents cc
    JOIN complexes c
      ON c.id = cc.complex_id
    LEFT JOIN users u
      ON u.id = cc.author_user_id
    WHERE c.slug = ${PILOT_COMPLEX_SLUG}
      AND cc.content_type = ${contentType}
      AND cc.status = 'published'
    ORDER BY
      cc.published_at DESC,
      cc.id DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  return json({
    ok: true,
    data: {
      content_type: contentType,
      count: rows.length,
      limit,
      offset,
      items: rows.map(row => ({
        id: row.id,
        content_type:
          row.content_type,
        slug: row.slug,
        title: row.title,
        excerpt: row.excerpt,
        author: publicAuthor(row),
        published_at:
          row.published_at,
        reaction_count:
          row.reaction_count,
      })),
    },
  });
}


// ==========================================================
// GUEST CONTENT DETAIL (id or slug)
// GET /api/notices/:key ...
// ==========================================================

export async function handlePublicContentDetail(
  request,
  env,
  contentType,
  key
) {
  if (request.method !== "GET") {
    return json(
      {
        ok: false,
        error:
          "METHOD_NOT_ALLOWED",
      },
      405
    );
  }

  if (!PUBLIC_TYPES.has(contentType)) {
    return json(
      {
        ok: false,
        error: "UNKNOWN_CONTENT_TYPE",
      },
      404
    );
  }

  const rawKey =
    text(key);

  if (!rawKey) {
    return json(
      {
        ok: false,
        error: "INVALID_CONTENT_KEY",
      },
      400
    );
  }

  const sql =
    getDb(env.DATABASE_URL);

  const isNumeric =
    /^\d+$/.test(rawKey);

  const rows =
    isNumeric
      ? await sql`
          SELECT
            cc.id,
            cc.content_type,
            cc.slug,
            cc.title,
            cc.body,
            cc.author_type,
            cc.author_user_id,
            cc.official_author_name,
            cc.official_author_title,
            u.display_name
              AS author_nickname,
            cc.published_at,
            CASE
              WHEN cc.content_type = 'resident_news'
                AND cc.reactions_enabled
              THEN (
                SELECT COUNT(*)::INTEGER
                FROM reactions r
                WHERE r.target_kind = 'resident_news'
                  AND r.target_id = cc.id
              )
              ELSE 0
            END AS reaction_count
          FROM complex_contents cc
          JOIN complexes c
            ON c.id = cc.complex_id
          LEFT JOIN users u
            ON u.id = cc.author_user_id
          WHERE c.slug = ${PILOT_COMPLEX_SLUG}
            AND cc.content_type = ${contentType}
            AND cc.status = 'published'
            AND cc.id = ${rawKey}
          LIMIT 1
        `
      : await sql`
          SELECT
            cc.id,
            cc.content_type,
            cc.slug,
            cc.title,
            cc.body,
            cc.author_type,
            cc.author_user_id,
            cc.official_author_name,
            cc.official_author_title,
            u.display_name
              AS author_nickname,
            cc.published_at,
            CASE
              WHEN cc.content_type = 'resident_news'
                AND cc.reactions_enabled
              THEN (
                SELECT COUNT(*)::INTEGER
                FROM reactions r
                WHERE r.target_kind = 'resident_news'
                  AND r.target_id = cc.id
              )
              ELSE 0
            END AS reaction_count
          FROM complex_contents cc
          JOIN complexes c
            ON c.id = cc.complex_id
          LEFT JOIN users u
            ON u.id = cc.author_user_id
          WHERE c.slug = ${PILOT_COMPLEX_SLUG}
            AND cc.content_type = ${contentType}
            AND cc.status = 'published'
            AND cc.slug = ${rawKey}
          LIMIT 1
        `;

  if (rows.length === 0) {
    return json(
      {
        ok: false,
        error: "CONTENT_NOT_FOUND",
      },
      404
    );
  }

  const row = rows[0];

  return json({
    ok: true,
    data: {
      id: row.id,
      content_type:
        row.content_type,
      slug: row.slug,
      title: row.title,
      body: row.body,
      author: publicAuthor(row),
      published_at:
        row.published_at,
      reaction_count:
        row.reaction_count,
    },
  });
}


// ==========================================================
// ADMIN: CREATE OFFICIAL CONTENT
// POST /api/admin/contents
// ==========================================================

const ADMIN_CREATABLE_TYPES = new Set([
  "danjion_notice",
  "apartment_news",
]);

const ADMIN_STATUSES = new Set([
  "draft",
  "published",
  "hidden",
]);

export async function handleAdminContentCreate(
  request,
  env
) {
  if (request.method !== "POST") {
    return json(
      {
        ok: false,
        error:
          "METHOD_NOT_ALLOWED",
      },
      405
    );
  }

  const operator =
    await requireOperator(
      request,
      env
    );

  if (operator.error) {
    return operator.error;
  }

  const parsed =
    await parseBody(request);

  if (parsed.error) {
    return parsed.error;
  }

  const body =
    parsed.data ?? {};

  const contentType =
    text(body.content_type);

  if (
    !ADMIN_CREATABLE_TYPES.has(
      contentType
    )
  ) {
    return json(
      {
        ok: false,
        error: "INVALID_CONTENT_TYPE",
      },
      400
    );
  }

  if (!text(body.title)) {
    return json(
      {
        ok: false,
        error: "TITLE_REQUIRED",
      },
      400
    );
  }

  if (!text(body.body)) {
    return json(
      {
        ok: false,
        error: "BODY_REQUIRED",
      },
      400
    );
  }

  const status =
    text(body.status) || "draft";

  if (!ADMIN_STATUSES.has(status)) {
    return json(
      {
        ok: false,
        error: "INVALID_STATUS",
      },
      400
    );
  }

  const complexRows =
    await operator.sql`
      SELECT id
      FROM complexes
      WHERE slug = ${PILOT_COMPLEX_SLUG}
      LIMIT 1
    `;

  const rows =
    await operator.sql`
      INSERT INTO complex_contents (
        complex_id,
        content_type,
        slug,
        title,
        body,
        author_type,
        official_author_name,
        official_author_title,
        status,
        reactions_enabled,
        comments_enabled,
        published_at
      )
      VALUES (
        ${complexRows[0].id},
        ${contentType},
        ${nullableText(body.slug)},
        ${text(body.title)},
        ${text(body.body)},
        'official',
        ${nullableText(
          body.official_author_name
        )},
        ${nullableText(
          body.official_author_title
        )},
        ${status},
        FALSE,
        FALSE,
        CASE
          WHEN ${status} = 'published'
          THEN NOW()
          ELSE NULL
        END
      )
      RETURNING
        id,
        content_type,
        slug,
        title,
        status,
        published_at,
        created_at
    `;

  return json(
    {
      ok: true,
      data: rows[0],
    },
    201
  );
}


// ==========================================================
// ADMIN: UPDATE OFFICIAL CONTENT (incl. publish/hide)
// PATCH /api/admin/contents/:id
// ==========================================================

export async function handleAdminContentUpdate(
  request,
  env,
  contentId
) {
  if (request.method !== "PATCH") {
    return json(
      {
        ok: false,
        error:
          "METHOD_NOT_ALLOWED",
      },
      405
    );
  }

  if (
    !/^\d+$/.test(
      String(contentId)
    )
  ) {
    return json(
      {
        ok: false,
        error: "INVALID_CONTENT_ID",
      },
      400
    );
  }

  const operator =
    await requireOperator(
      request,
      env
    );

  if (operator.error) {
    return operator.error;
  }

  const parsed =
    await parseBody(request);

  if (parsed.error) {
    return parsed.error;
  }

  const body =
    parsed.data ?? {};

  const existing =
    await operator.sql`
      SELECT *
      FROM complex_contents
      WHERE id = ${contentId}
      LIMIT 1
    `;

  if (existing.length === 0) {
    return json(
      {
        ok: false,
        error: "CONTENT_NOT_FOUND",
      },
      404
    );
  }

  const current = existing[0];

  const nextStatus =
    body.status === undefined
      ? current.status
      : text(body.status);

  const allowedNext = new Set([
    "draft",
    "published",
    "hidden",
    "rejected",
  ]);

  if (!allowedNext.has(nextStatus)) {
    return json(
      {
        ok: false,
        error: "INVALID_STATUS",
      },
      400
    );
  }

  const nextTitle =
    body.title === undefined
      ? current.title
      : text(body.title);

  const nextBody =
    body.body === undefined
      ? current.body
      : text(body.body);

  if (!nextTitle || !nextBody) {
    return json(
      {
        ok: false,
        error: "TITLE_BODY_REQUIRED",
      },
      400
    );
  }

  const rows =
    await operator.sql`
      UPDATE complex_contents
      SET
        title = ${nextTitle},
        body = ${nextBody},
        official_author_name = ${
          body.official_author_name === undefined
            ? current.official_author_name
            : nullableText(
                body.official_author_name
              )
        },
        official_author_title = ${
          body.official_author_title === undefined
            ? current.official_author_title
            : nullableText(
                body.official_author_title
              )
        },
        status = ${nextStatus},
        published_at = CASE
          WHEN ${nextStatus} = 'published'
            AND published_at IS NULL
          THEN NOW()
          ELSE published_at
        END,
        updated_at = NOW()
      WHERE id = ${contentId}
      RETURNING
        id,
        content_type,
        slug,
        title,
        status,
        published_at,
        updated_at
    `;

  return json({
    ok: true,
    data: rows[0],
  });
}


// ==========================================================
// RESIDENT: SUBMIT RESIDENT NEWS
// POST /api/resident-news-submissions
// No direct publish path exists.
// ==========================================================

export async function handleResidentNewsSubmit(
  request,
  env
) {
  if (request.method !== "POST") {
    return json(
      {
        ok: false,
        error:
          "METHOD_NOT_ALLOWED",
      },
      405
    );
  }

  const context =
    await requireResident(
      request,
      env
    );

  if (context.error) {
    return context.error;
  }

  const parsed =
    await parseBody(request);

  if (parsed.error) {
    return parsed.error;
  }

  const body =
    parsed.data ?? {};

  if (!text(body.title)) {
    return json(
      {
        ok: false,
        error: "TITLE_REQUIRED",
      },
      400
    );
  }

  if (!text(body.body)) {
    return json(
      {
        ok: false,
        error: "BODY_REQUIRED",
      },
      400
    );
  }

  const rows =
    await context.sql`
      INSERT INTO resident_news_submissions (
        submitter_user_id,
        complex_id,
        title,
        body,
        status,
        submitted_at
      )
      VALUES (
        ${context.userId},
        ${context.complexId},
        ${text(body.title)},
        ${text(body.body)},
        'submitted',
        NOW()
      )
      RETURNING
        id,
        title,
        status,
        submitted_at,
        created_at
    `;

  const submission = rows[0];

  await context.sql`
    INSERT INTO
      resident_news_submission_events (
        submission_id,
        actor_user_id,
        from_status,
        to_status
      )
    VALUES (
      ${submission.id},
      ${context.userId},
      NULL,
      'submitted'
    )
  `;

  return json(
    {
      ok: true,
      data: submission,
    },
    201
  );
}


// ==========================================================
// RESIDENT: MY SUBMISSIONS
// GET /api/me/resident-news-submissions
// ==========================================================

export async function handleMyResidentNewsSubmissions(
  request,
  env
) {
  if (request.method !== "GET") {
    return json(
      {
        ok: false,
        error:
          "METHOD_NOT_ALLOWED",
      },
      405
    );
  }

  const context =
    await requireResident(
      request,
      env
    );

  if (context.error) {
    return context.error;
  }

  const rows =
    await context.sql`
      SELECT
        s.id,
        s.title,
        s.status,
        s.reviewer_note_to_applicant,
        s.submitted_at,
        s.reviewed_at,
        s.created_at,
        s.published_content_id,
        cc.slug
          AS published_content_slug
      FROM resident_news_submissions s
      LEFT JOIN complex_contents cc
        ON cc.id =
          s.published_content_id
      WHERE s.submitter_user_id =
        ${context.userId}
      ORDER BY
        s.created_at DESC
    `;

  return json({
    ok: true,
    data: {
      count: rows.length,
      submissions: rows,
    },
  });
}


// ==========================================================
// ADMIN: LIST SUBMISSIONS
// GET /api/admin/resident-news-submissions
// ==========================================================

export async function handleAdminResidentNewsSubmissions(
  request,
  env
) {
  if (request.method !== "GET") {
    return json(
      {
        ok: false,
        error:
          "METHOD_NOT_ALLOWED",
      },
      405
    );
  }

  const operator =
    await requireOperator(
      request,
      env
    );

  if (operator.error) {
    return operator.error;
  }

  const url =
    new URL(request.url);

  const status =
    text(
      url.searchParams.get("status")
    );

  const rows =
    await operator.sql`
      SELECT
        s.*,
        u.display_name
          AS submitter_display_name
      FROM resident_news_submissions s
      JOIN users u
        ON u.id = s.submitter_user_id
      WHERE (
        ${status} = ''
        OR s.status = ${status}
      )
      ORDER BY
        CASE s.status
          WHEN 'submitted'
            THEN 1
          WHEN 'needs_more_info'
            THEN 2
          ELSE 3
        END,
        s.created_at DESC
    `;

  return json({
    ok: true,
    data: {
      count: rows.length,
      submissions: rows,
    },
  });
}


// ==========================================================
// ADMIN: REVIEW SUBMISSION
// POST .../:id/needs-more-info | reject | approve
// approve: submission -> published resident_news, atomic.
// Duplicate publish guarded.
// ==========================================================

export async function handleAdminResidentNewsAction(
  request,
  env,
  submissionId,
  action
) {
  if (request.method !== "POST") {
    return json(
      {
        ok: false,
        error:
          "METHOD_NOT_ALLOWED",
      },
      405
    );
  }

  if (
    !/^\d+$/.test(
      String(submissionId)
    )
  ) {
    return json(
      {
        ok: false,
        error: "INVALID_SUBMISSION_ID",
      },
      400
    );
  }

  const operator =
    await requireOperator(
      request,
      env
    );

  if (operator.error) {
    return operator.error;
  }

  const existing =
    await operator.sql`
      SELECT *
      FROM resident_news_submissions
      WHERE id = ${submissionId}
      LIMIT 1
    `;

  if (existing.length === 0) {
    return json(
      {
        ok: false,
        error: "SUBMISSION_NOT_FOUND",
      },
      404
    );
  }

  const submission = existing[0];

  if (
    String(submission.submitter_user_id) ===
    String(operator.userId)
  ) {
    return json(
      {
        ok: false,
        error: "SELF_REVIEW_FORBIDDEN",
      },
      403
    );
  }

  const parsed =
    await parseBody(request);

  if (parsed.error) {
    return parsed.error;
  }

  const body =
    parsed.data ?? {};


  if (action === "needs-more-info") {
    const message =
      text(body.message);

    if (!message) {
      return json(
        {
          ok: false,
          error: "MESSAGE_REQUIRED",
        },
        400
      );
    }

    if (
      submission.status !== "submitted"
    ) {
      return json(
        {
          ok: false,
          error: "SUBMISSION_NOT_SUBMITTED",
        },
        409
      );
    }

    const rows =
      await operator.sql`
        UPDATE resident_news_submissions
        SET
          status = 'needs_more_info',
          reviewer_note_to_applicant =
            ${message},
          reviewer_note_private =
            ${nullableText(
              body.note_private
            )},
          reviewed_by_user_id =
            ${operator.userId},
          reviewed_at = NOW(),
          updated_at = NOW()
        WHERE id = ${submissionId}
        RETURNING
          id,
          status,
          reviewer_note_to_applicant,
          reviewed_at
      `;

    await operator.sql`
      INSERT INTO
        resident_news_submission_events (
          submission_id,
          actor_user_id,
          from_status,
          to_status,
          note_private
        )
      VALUES (
        ${submissionId},
        ${operator.userId},
        'submitted',
        'needs_more_info',
        ${nullableText(
          body.note_private
        )}
      )
    `;

    return json({
      ok: true,
      data: rows[0],
    });
  }


  if (action === "reject") {
    if (
      !SUBMISSION_REVIEWABLE.has(
        submission.status
      )
    ) {
      return json(
        {
          ok: false,
          error:
            "SUBMISSION_NOT_REVIEWABLE",
        },
        409
      );
    }

    const message =
      text(body.message);

    if (!message) {
      return json(
        {
          ok: false,
          error: "MESSAGE_REQUIRED",
        },
        400
      );
    }

    const rows =
      await operator.sql`
        UPDATE resident_news_submissions
        SET
          status = 'rejected',
          reviewer_note_to_applicant =
            ${message},
          reviewer_note_private =
            ${nullableText(
              body.note_private
            )},
          reviewed_by_user_id =
            ${operator.userId},
          reviewed_at = NOW(),
          updated_at = NOW()
        WHERE id = ${submissionId}
        RETURNING
          id,
          status,
          reviewer_note_to_applicant,
          reviewed_at
      `;

    await operator.sql`
      INSERT INTO
        resident_news_submission_events (
          submission_id,
          actor_user_id,
          from_status,
          to_status,
          note_private
        )
      VALUES (
        ${submissionId},
        ${operator.userId},
        ${submission.status},
        'rejected',
        ${nullableText(
          body.note_private
        )}
      )
    `;

    return json({
      ok: true,
      data: rows[0],
    });
  }


  if (action === "approve") {
    if (
      submission.status !== "submitted"
    ) {
      return json(
        {
          ok: false,
          error: "SUBMISSION_NOT_SUBMITTED",
        },
        409
      );
    }

    if (
      submission.published_content_id !=
      null
    ) {
      return json(
        {
          ok: false,
          error: "ALREADY_PUBLISHED",
        },
        409
      );
    }

    const published =
      await operator.sql`
        WITH new_content AS (
          INSERT INTO complex_contents (
            complex_id,
            content_type,
            title,
            body,
            author_type,
            author_user_id,
            status,
            reactions_enabled,
            comments_enabled,
            published_at
          )
          SELECT
            ${submission.complex_id},
            'resident_news',
            ${submission.title},
            ${submission.body},
            'resident',
            ${submission.submitter_user_id},
            'published',
            TRUE,
            FALSE,
            NOW()
          RETURNING
            id
        ),
        submission_update AS (
          UPDATE resident_news_submissions s
          SET
            status = 'published',
            reviewed_by_user_id =
              ${operator.userId},
            reviewed_at = NOW(),
            reviewer_note_private =
              ${nullableText(
                body.note_private
              )},
            reviewer_note_to_applicant =
              NULL,
            published_content_id =
              nc.id,
            updated_at = NOW()
          FROM new_content nc
          WHERE s.id = ${submissionId}
            AND s.status = 'submitted'
            AND s.published_content_id
              IS NULL
          RETURNING
            s.id,
            s.status,
            s.published_content_id
        )
        SELECT
          nc.id AS content_id,
          su.id AS submission_id,
          su.status
            AS submission_status,
          su.published_content_id
        FROM new_content nc
        CROSS JOIN submission_update su
      `;

    if (published.length === 0) {
      return json(
        {
          ok: false,
          error:
            "RESIDENT_NEWS_PUBLICATION_FAILED",
        },
        500
      );
    }

    await operator.sql`
      INSERT INTO
        resident_news_submission_events (
          submission_id,
          actor_user_id,
          from_status,
          to_status,
          note_private
        )
      VALUES (
        ${submissionId},
        ${operator.userId},
        'submitted',
        'published',
        ${nullableText(
          body.note_private
        )}
      )
    `;

    return json({
      ok: true,
      data: published[0],
    });
  }


  return json(
    {
      ok: false,
      error: "UNKNOWN_REVIEW_ACTION",
    },
    404
  );
}


// ==========================================================
// RESIDENT: REACT TO RESIDENT NEWS (empathy only)
// PUT /api/resident-news/:id/reactions
// DELETE /api/resident-news/:id/reactions
// ==========================================================

export async function handleResidentNewsReaction(
  request,
  env,
  contentId
) {
  if (
    request.method !== "PUT" &&
    request.method !== "DELETE"
  ) {
    return json(
      {
        ok: false,
        error:
          "METHOD_NOT_ALLOWED",
      },
      405
    );
  }

  if (
    !/^\d+$/.test(
      String(contentId)
    )
  ) {
    return json(
      {
        ok: false,
        error: "INVALID_CONTENT_ID",
      },
      400
    );
  }

  const context =
    await requireResident(
      request,
      env
    );

  if (context.error) {
    return context.error;
  }

  const rows =
    await context.sql`
      SELECT
        id,
        reactions_enabled
      FROM complex_contents
      WHERE id = ${contentId}
        AND content_type = 'resident_news'
        AND status = 'published'
      LIMIT 1
    `;

  if (rows.length === 0) {
    return json(
      {
        ok: false,
        error: "CONTENT_NOT_FOUND",
      },
      404
    );
  }

  if (!rows[0].reactions_enabled) {
    return json(
      {
        ok: false,
        error: "REACTIONS_DISABLED",
      },
      403
    );
  }

  if (request.method === "PUT") {
    const parsed =
      await parseBody(request);

    if (parsed.error) {
      return parsed.error;
    }

    const reactionType =
      text(
        parsed.data?.reaction_type ??
          "empathy"
      );

    if (reactionType !== "empathy") {
      return json(
        {
          ok: false,
          error:
            "INVALID_REACTION_TYPE",
        },
        400
      );
    }

    await context.sql`
      INSERT INTO reactions (
        target_kind,
        target_id,
        user_id,
        reaction_type
      )
      VALUES (
        'resident_news',
        ${contentId},
        ${context.userId},
        'empathy'
      )
      ON CONFLICT (
        user_id,
        target_kind,
        target_id,
        reaction_type
      )
      DO NOTHING
    `;
  } else {
    const url =
      new URL(request.url);

    const reactionType =
      text(
        url.searchParams.get(
          "reaction_type"
        ) ?? "empathy"
      );

    await context.sql`
      DELETE FROM reactions
      WHERE target_kind = 'resident_news'
        AND target_id = ${contentId}
        AND user_id = ${context.userId}
        AND reaction_type =
          ${reactionType}
    `;
  }

  const counts =
    await context.sql`
      SELECT
        COUNT(*)::INTEGER AS empathy_count
      FROM reactions
      WHERE target_kind = 'resident_news'
        AND target_id = ${contentId}
        AND reaction_type = 'empathy'
    `;

  return json({
    ok: true,
    data: {
      content_id: Number(contentId),
      empathy_count:
        counts[0].empathy_count,
    },
  });
}
