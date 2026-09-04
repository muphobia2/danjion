import { getDb } from "../db/client.js";
import { verifyAuthToken } from "../auth/verify.js";
import { json } from "./hello.js";

const PILOT_COMPLEX_SLUG =
  "banglim-myeongji-roadhill";

const RESIDENT_LABEL =
  "로드힐 주민";

const TALK_CATEGORIES = new Set([
  "question",
  "complex_story",
  "introduction",
  "together",
]);

const TALK_REACTIONS = new Set([
  "empathy",
  "helpful",
  "cheer",
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


function publicTalkAuthor(row) {
  return {
    type: "resident",
    id: row.author_user_id,
    nickname:
      row.author_nickname ??
      "이웃 주민",
    label: RESIDENT_LABEL,
  };
}


async function reactionCounts(
  sql,
  postId
) {
  const rows = await sql`
    SELECT
      reaction_type,
      COUNT(*)::INTEGER AS count
    FROM reactions
    WHERE target_kind = 'talk_post'
      AND target_id = ${postId}
    GROUP BY reaction_type
  `;

  const counts = {
    empathy: 0,
    helpful: 0,
    cheer: 0,
  };

  for (const row of rows) {
    if (
      Object.hasOwn(counts, row.reaction_type)
    ) {
      counts[row.reaction_type] =
        row.count;
    }
  }

  return counts;
}


// ==========================================================
// GUEST TALK LIST
// GET /api/talk
// ==========================================================

export async function handleTalkList(
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

  const url =
    new URL(request.url);

  const { limit, offset } =
    pageParams(url);

  const category =
    text(
      url.searchParams.get("category")
    );

  if (
    category &&
    !TALK_CATEGORIES.has(category)
  ) {
    return json(
      {
        ok: false,
        error: "INVALID_CATEGORY",
      },
      400
    );
  }

  const sql =
    getDb(env.DATABASE_URL);

  const rows = await sql`
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
    JOIN complexes c
      ON c.id = tp.complex_id
    JOIN users u
      ON u.id = tp.author_user_id
    WHERE c.slug = ${PILOT_COMPLEX_SLUG}
      AND tp.status = 'active'
      AND (
        ${category} = ''
        OR tp.category = ${category}
      )
    ORDER BY
      tp.created_at DESC,
      tp.id DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  const items = [];

  for (const row of rows) {
    items.push({
      id: row.id,
      category: row.category,
      title: row.title,
      excerpt: row.excerpt,
      author: publicTalkAuthor(row),
      comment_count:
        row.comment_count,
      reactions:
        await reactionCounts(
          sql,
          row.id
        ),
      created_at: row.created_at,
    });
  }

  return json({
    ok: true,
    data: {
      count: items.length,
      limit,
      offset,
      posts: items,
    },
  });
}


// ==========================================================
// RESIDENT TALK DETAIL
// GET /api/talk/:id
// ==========================================================

export async function handleTalkDetail(
  request,
  env,
  postId
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

  if (
    !/^\d+$/.test(
      String(postId)
    )
  ) {
    return json(
      {
        ok: false,
        error: "INVALID_POST_ID",
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
        tp.id,
        tp.category,
        tp.title,
        tp.body,
        tp.author_user_id,
        u.display_name
          AS author_nickname,
        tp.created_at,
        tp.updated_at
      FROM talk_posts tp
      JOIN complexes c
        ON c.id = tp.complex_id
      JOIN users u
        ON u.id = tp.author_user_id
      WHERE tp.id = ${postId}
        AND c.slug = ${PILOT_COMPLEX_SLUG}
        AND tp.status = 'active'
      LIMIT 1
    `;

  if (rows.length === 0) {
    return json(
      {
        ok: false,
        error: "POST_NOT_FOUND",
      },
      404
    );
  }

  const row = rows[0];

  return json({
    ok: true,
    data: {
      id: row.id,
      category: row.category,
      title: row.title,
      body: row.body,
      author: publicTalkAuthor(row),
      mine:
        String(row.author_user_id) ===
        String(context.userId),
      reactions:
        await reactionCounts(
          context.sql,
          row.id
        ),
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
  });
}


// ==========================================================
// RESIDENT TALK CREATE
// POST /api/talk
// ==========================================================

export async function handleTalkCreate(
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

  const category =
    text(body.category);

  if (!TALK_CATEGORIES.has(category)) {
    return json(
      {
        ok: false,
        error: "INVALID_CATEGORY",
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

  const rows =
    await context.sql`
      INSERT INTO talk_posts (
        complex_id,
        author_user_id,
        category,
        title,
        body,
        status
      )
      VALUES (
        ${context.complexId},
        ${context.userId},
        ${category},
        ${text(body.title)},
        ${text(body.body)},
        'active'
      )
      RETURNING
        id,
        category,
        title,
        status,
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
// RESIDENT TALK UPDATE (own only)
// PATCH /api/talk/:id
// ==========================================================

export async function handleTalkUpdate(
  request,
  env,
  postId
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
      String(postId)
    )
  ) {
    return json(
      {
        ok: false,
        error: "INVALID_POST_ID",
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

  const existing =
    await context.sql`
      SELECT *
      FROM talk_posts
      WHERE id = ${postId}
      LIMIT 1
    `;

  if (
    existing.length === 0 ||
    existing[0].status !== "active"
  ) {
    return json(
      {
        ok: false,
        error: "POST_NOT_FOUND",
      },
      404
    );
  }

  if (
    String(
      existing[0].author_user_id
    ) !== String(context.userId)
  ) {
    return json(
      {
        ok: false,
        error: "FORBIDDEN",
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

  if (
    body.category !== undefined &&
    !TALK_CATEGORIES.has(
      text(body.category)
    )
  ) {
    return json(
      {
        ok: false,
        error: "INVALID_CATEGORY",
      },
      400
    );
  }

  const nextTitle =
    body.title === undefined
      ? existing[0].title
      : text(body.title);

  const nextBody =
    body.body === undefined
      ? existing[0].body
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
    await context.sql`
      UPDATE talk_posts
      SET
        category = ${
          body.category === undefined
            ? existing[0].category
            : text(body.category)
        },
        title = ${nextTitle},
        body = ${nextBody},
        updated_at = NOW()
      WHERE id = ${postId}
      RETURNING
        id,
        category,
        title,
        updated_at
    `;

  return json({
    ok: true,
    data: rows[0],
  });
}


// ==========================================================
// RESIDENT TALK DELETE (own only, soft delete)
// DELETE /api/talk/:id
// ==========================================================

export async function handleTalkDelete(
  request,
  env,
  postId
) {
  if (request.method !== "DELETE") {
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
      String(postId)
    )
  ) {
    return json(
      {
        ok: false,
        error: "INVALID_POST_ID",
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

  const existing =
    await context.sql`
      SELECT
        id,
        author_user_id,
        status
      FROM talk_posts
      WHERE id = ${postId}
      LIMIT 1
    `;

  if (
    existing.length === 0 ||
    existing[0].status !== "active"
  ) {
    return json(
      {
        ok: false,
        error: "POST_NOT_FOUND",
      },
      404
    );
  }

  if (
    String(
      existing[0].author_user_id
    ) !== String(context.userId)
  ) {
    return json(
      {
        ok: false,
        error: "FORBIDDEN",
      },
      403
    );
  }

  await context.sql`
    UPDATE talk_posts
    SET
      status = 'deleted',
      updated_at = NOW()
    WHERE id = ${postId}
  `;

  return json({
    ok: true,
    data: {
      deleted_post_id: Number(postId),
    },
  });
}


// ==========================================================
// RESIDENT COMMENT LIST (1-level nested)
// GET /api/talk/:id/comments
// ==========================================================

export async function handleTalkComments(
  request,
  env,
  postId
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

  if (
    !/^\d+$/.test(
      String(postId)
    )
  ) {
    return json(
      {
        ok: false,
        error: "INVALID_POST_ID",
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

  const posts =
    await context.sql`
      SELECT id
      FROM talk_posts
      WHERE id = ${postId}
        AND status = 'active'
      LIMIT 1
    `;

  if (posts.length === 0) {
    return json(
      {
        ok: false,
        error: "POST_NOT_FOUND",
      },
      404
    );
  }

  const rows =
    await context.sql`
      SELECT
        tc.id,
        tc.post_id,
        tc.parent_comment_id,
        tc.body,
        tc.author_user_id,
        u.display_name
          AS author_nickname,
        tc.created_at,
        tc.updated_at
      FROM talk_comments tc
      JOIN users u
        ON u.id = tc.author_user_id
      WHERE tc.post_id = ${postId}
        AND tc.status = 'active'
      ORDER BY
        tc.created_at,
        tc.id
    `;

  const byParent = new Map();

  for (const row of rows) {
    const key =
      row.parent_comment_id == null
        ? "root"
        : String(row.parent_comment_id);

    if (!byParent.has(key)) {
      byParent.set(key, []);
    }

    byParent.get(key).push({
      id: row.id,
      body: row.body,
      author: {
        type: "resident",
        id: row.author_user_id,
        nickname:
          row.author_nickname ??
          "이웃 주민",
        label: RESIDENT_LABEL,
      },
      mine:
        String(row.author_user_id) ===
        String(context.userId),
      created_at: row.created_at,
      updated_at: row.updated_at,
      replies: [],
    });
  }

  const roots =
    byParent.get("root") ?? [];

  for (const root of roots) {
    root.replies =
      byParent.get(String(root.id)) ??
      [];
  }

  return json({
    ok: true,
    data: {
      post_id: Number(postId),
      count: rows.length,
      comments: roots,
    },
  });
}


// ==========================================================
// RESIDENT COMMENT CREATE
// POST /api/talk/:id/comments
// 2nd-level replies rejected.
// ==========================================================

export async function handleTalkCommentCreate(
  request,
  env,
  postId
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
      String(postId)
    )
  ) {
    return json(
      {
        ok: false,
        error: "INVALID_POST_ID",
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

  const posts =
    await context.sql`
      SELECT id
      FROM talk_posts
      WHERE id = ${postId}
        AND status = 'active'
      LIMIT 1
    `;

  if (posts.length === 0) {
    return json(
      {
        ok: false,
        error: "POST_NOT_FOUND",
      },
      404
    );
  }

  const parsed =
    await parseBody(request);

  if (parsed.error) {
    return parsed.error;
  }

  const body =
    parsed.data ?? {};

  if (!text(body.body)) {
    return json(
      {
        ok: false,
        error: "BODY_REQUIRED",
      },
      400
    );
  }

  let parentId = null;

  if (
    body.parent_comment_id !==
      undefined &&
    body.parent_comment_id !== null &&
    String(
      body.parent_comment_id
    ) !== ""
  ) {
    if (
      !/^\d+$/.test(
        String(
          body.parent_comment_id
        )
      )
    ) {
      return json(
        {
          ok: false,
          error: "INVALID_PARENT_COMMENT",
        },
        400
      );
    }

    const parents =
      await context.sql`
        SELECT
          id,
          parent_comment_id,
          status
        FROM talk_comments
        WHERE id = ${String(
          body.parent_comment_id
        )}
          AND post_id = ${postId}
        LIMIT 1
      `;

    if (
      parents.length === 0 ||
      parents[0].status !== "active"
    ) {
      return json(
        {
          ok: false,
          error: "PARENT_COMMENT_NOT_FOUND",
        },
        404
      );
    }

    if (
      parents[0].parent_comment_id !=
      null
    ) {
      return json(
        {
          ok: false,
          error:
            "NESTED_REPLY_NOT_ALLOWED",
        },
        400
      );
    }

    parentId = parents[0].id;
  }

  const rows =
    await context.sql`
      INSERT INTO talk_comments (
        post_id,
        author_user_id,
        parent_comment_id,
        body,
        status
      )
      VALUES (
        ${postId},
        ${context.userId},
        ${parentId},
        ${text(body.body)},
        'active'
      )
      RETURNING
        id,
        post_id,
        parent_comment_id,
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
// RESIDENT COMMENT UPDATE/DELETE (own only)
// PATCH | DELETE /api/comments/:id
// ==========================================================

export async function handleTalkCommentMutation(
  request,
  env,
  commentId
) {
  if (
    request.method !== "PATCH" &&
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
      String(commentId)
    )
  ) {
    return json(
      {
        ok: false,
        error: "INVALID_COMMENT_ID",
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

  const existing =
    await context.sql`
      SELECT
        tc.id,
        tc.author_user_id,
        tc.status,
        tp.status AS post_status
      FROM talk_comments tc
      JOIN talk_posts tp
        ON tp.id = tc.post_id
      WHERE tc.id = ${commentId}
      LIMIT 1
    `;

  if (
    existing.length === 0 ||
    existing[0].status !== "active"
  ) {
    return json(
      {
        ok: false,
        error: "COMMENT_NOT_FOUND",
      },
      404
    );
  }

  if (
    String(
      existing[0].author_user_id
    ) !== String(context.userId)
  ) {
    return json(
      {
        ok: false,
        error: "FORBIDDEN",
      },
      403
    );
  }

  if (request.method === "DELETE") {
    await context.sql`
      UPDATE talk_comments
      SET
        status = 'deleted',
        updated_at = NOW()
      WHERE id = ${commentId}
    `;

    return json({
      ok: true,
      data: {
        deleted_comment_id:
          Number(commentId),
      },
    });
  }

  const parsed =
    await parseBody(request);

  if (parsed.error) {
    return parsed.error;
  }

  if (!text(parsed.data?.body)) {
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
      UPDATE talk_comments
      SET
        body = ${text(
          parsed.data.body
        )},
        updated_at = NOW()
      WHERE id = ${commentId}
      RETURNING
        id,
        updated_at
    `;

  return json({
    ok: true,
    data: rows[0],
  });
}


// ==========================================================
// RESIDENT TALK REACTIONS (empathy/helpful/cheer)
// PUT /api/talk/:id/reactions (idempotent add)
// DELETE /api/talk/:id/reactions?reaction_type=
// ==========================================================

export async function handleTalkReaction(
  request,
  env,
  postId
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
      String(postId)
    )
  ) {
    return json(
      {
        ok: false,
        error: "INVALID_POST_ID",
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

  const posts =
    await context.sql`
      SELECT id
      FROM talk_posts
      WHERE id = ${postId}
        AND status = 'active'
      LIMIT 1
    `;

  if (posts.length === 0) {
    return json(
      {
        ok: false,
        error: "POST_NOT_FOUND",
      },
      404
    );
  }

  let reactionType = "empathy";

  if (request.method === "PUT") {
    const parsed =
      await parseBody(request);

    if (parsed.error) {
      return parsed.error;
    }

    reactionType = text(
      parsed.data?.reaction_type ??
        "empathy"
    );
  } else {
    const url =
      new URL(request.url);

    reactionType = text(
      url.searchParams.get(
        "reaction_type"
      ) ?? "empathy"
    );
  }

  if (!TALK_REACTIONS.has(reactionType)) {
    return json(
      {
        ok: false,
        error:
          "INVALID_REACTION_TYPE",
      },
      400
    );
  }

  if (request.method === "PUT") {
    await context.sql`
      INSERT INTO reactions (
        target_kind,
        target_id,
        user_id,
        reaction_type
      )
      VALUES (
        'talk_post',
        ${postId},
        ${context.userId},
        ${reactionType}
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
    await context.sql`
      DELETE FROM reactions
      WHERE target_kind = 'talk_post'
        AND target_id = ${postId}
        AND user_id = ${context.userId}
        AND reaction_type =
          ${reactionType}
    `;
  }

  return json({
    ok: true,
    data: {
      post_id: Number(postId),
      reactions:
        await reactionCounts(
          context.sql,
          postId
        ),
    },
  });
}


// ==========================================================
// ADMIN TALK MODERATION (hide/show)
// POST /api/admin/talk-posts/:id/hide | show
// ==========================================================

export async function handleAdminTalkModeration(
  request,
  env,
  postId,
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
      String(postId)
    )
  ) {
    return json(
      {
        ok: false,
        error: "INVALID_POST_ID",
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

  const nextStatus =
    action === "hide"
      ? "hidden"
      : action === "show"
        ? "active"
        : null;

  if (!nextStatus) {
    return json(
      {
        ok: false,
        error: "UNKNOWN_MODERATION_ACTION",
      },
      404
    );
  }

  const rows =
    await operator.sql`
      UPDATE talk_posts
      SET
        status = ${nextStatus},
        updated_at = NOW()
      WHERE id = ${postId}
        AND status IN (
          'active',
          'hidden'
        )
      RETURNING
        id,
        status,
        updated_at
    `;

  if (rows.length === 0) {
    return json(
      {
        ok: false,
        error: "POST_NOT_MODERATABLE",
      },
      404
    );
  }

  return json({
    ok: true,
    data: rows[0],
  });
}
