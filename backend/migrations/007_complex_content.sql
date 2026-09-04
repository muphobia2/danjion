BEGIN;

-- =========================================================
-- PHASE 4
-- 우리단지 콘텐츠: 단지온 공지 / 아파트소식 / 주민소식 /
-- 이웃대화 / 댓글 / 반응
--
-- 명칭 규칙:
-- '공지'는 단지온 공지(danjion_notice)에만 사용한다.
-- 기존 PHASE 1~3 테이블과 중복 없음 (신규 테이블만 생성).
-- Additive only. 기존 테이블 변경 없음.
-- =========================================================

-- =========================================================
-- 1. 공식/승인 콘텐츠 (공지 + 아파트소식 + 주민소식 published)
-- =========================================================

CREATE TABLE IF NOT EXISTS complex_contents (
  id BIGSERIAL PRIMARY KEY,

  complex_id BIGINT NOT NULL
    REFERENCES complexes(id)
    ON DELETE CASCADE,

  content_type TEXT NOT NULL
    CHECK (
      content_type IN (
        'danjion_notice',
        'apartment_news',
        'resident_news'
      )
    ),

  -- 공식글 안정 식별자 (seed/프론트 연결용)
  slug TEXT UNIQUE,

  title TEXT NOT NULL,

  body TEXT NOT NULL,

  author_type TEXT NOT NULL DEFAULT 'official'
    CHECK (
      author_type IN (
        'official',
        'resident',
        'system'
      )
    ),

  author_user_id BIGINT
    REFERENCES users(id)
    ON DELETE SET NULL,

  -- 공식 작성자 표기 (예: 입주자대표회의 회장)
  -- term-scoped. 자동 승계 로직 없음.
  official_author_name TEXT,

  official_author_title TEXT,

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (
      status IN (
        'draft',
        'submitted',
        'needs_more_info',
        'published',
        'rejected',
        'hidden'
      )
    ),

  reactions_enabled BOOLEAN NOT NULL DEFAULT FALSE,

  comments_enabled BOOLEAN NOT NULL DEFAULT FALSE,

  published_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS
idx_complex_contents_complex_type_status
ON complex_contents(
  complex_id,
  content_type,
  status,
  published_at DESC,
  id DESC
);


CREATE INDEX IF NOT EXISTS
idx_complex_contents_slug
ON complex_contents(slug)
WHERE slug IS NOT NULL;


-- =========================================================
-- 2. 주민소식 신청/제보 + 심사
--
-- 주민 direct publish 불가.
-- published 행은 complex_contents에만 존재한다.
-- =========================================================

CREATE TABLE IF NOT EXISTS resident_news_submissions (
  id BIGSERIAL PRIMARY KEY,

  submitter_user_id BIGINT NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  complex_id BIGINT NOT NULL
    REFERENCES complexes(id)
    ON DELETE CASCADE,

  title TEXT NOT NULL,

  body TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (
      status IN (
        'draft',
        'submitted',
        'needs_more_info',
        'approved',
        'rejected',
        'published'
      )
    ),

  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  reviewed_at TIMESTAMPTZ,

  reviewed_by_user_id BIGINT
    REFERENCES users(id)
    ON DELETE SET NULL,

  reviewer_note_to_applicant TEXT,

  reviewer_note_private TEXT,

  published_content_id BIGINT
    REFERENCES complex_contents(id)
    ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS
idx_resident_news_submissions_submitter
ON resident_news_submissions(
  submitter_user_id,
  created_at DESC
);


CREATE INDEX IF NOT EXISTS
idx_resident_news_submissions_complex_status
ON resident_news_submissions(
  complex_id,
  status,
  created_at DESC
);


-- =========================================================
-- 3. 주민소식 심사 이력
-- =========================================================

CREATE TABLE IF NOT EXISTS resident_news_submission_events (
  id BIGSERIAL PRIMARY KEY,

  submission_id BIGINT NOT NULL
    REFERENCES resident_news_submissions(id)
    ON DELETE CASCADE,

  actor_user_id BIGINT
    REFERENCES users(id)
    ON DELETE SET NULL,

  from_status TEXT,

  to_status TEXT NOT NULL,

  note_private TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS
idx_resident_news_submission_events_submission
ON resident_news_submission_events(
  submission_id,
  created_at
);


-- =========================================================
-- 4. 이웃대화 글
--
-- soft delete: status='deleted'.
-- =========================================================

CREATE TABLE IF NOT EXISTS talk_posts (
  id BIGSERIAL PRIMARY KEY,

  complex_id BIGINT NOT NULL
    REFERENCES complexes(id)
    ON DELETE CASCADE,

  author_user_id BIGINT NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  category TEXT NOT NULL
    CHECK (
      category IN (
        'question',
        'complex_story',
        'introduction',
        'together'
      )
    ),

  title TEXT NOT NULL,

  body TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'active'
    CHECK (
      status IN (
        'active',
        'hidden',
        'deleted'
      )
    ),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS
idx_talk_posts_complex_status
ON talk_posts(
  complex_id,
  status,
  created_at DESC,
  id DESC
);


CREATE INDEX IF NOT EXISTS
idx_talk_posts_author
ON talk_posts(
  author_user_id,
  created_at DESC
);


-- =========================================================
-- 5. 이웃대화 댓글/답글
--
-- 1단 답글까지만 허용 (서버에서 강제).
-- 답글의 답글(2단 이상) 거부.
-- =========================================================

CREATE TABLE IF NOT EXISTS talk_comments (
  id BIGSERIAL PRIMARY KEY,

  post_id BIGINT NOT NULL
    REFERENCES talk_posts(id)
    ON DELETE CASCADE,

  author_user_id BIGINT NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  parent_comment_id BIGINT
    REFERENCES talk_comments(id)
    ON DELETE CASCADE,

  body TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'active'
    CHECK (
      status IN (
        'active',
        'hidden',
        'deleted'
      )
    ),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS
idx_talk_comments_post
ON talk_comments(
  post_id,
  status,
  created_at,
  id
);


CREATE INDEX IF NOT EXISTS
idx_talk_comments_author
ON talk_comments(
  author_user_id,
  created_at DESC
);


-- =========================================================
-- 6. 반응
--
-- 중복 방지 UNIQUE (user/target/kind/type).
-- target은 polymorphic이므로 FK 없음.
-- target_kind:
--   talk_post / talk_comment / resident_news
-- reaction_type:
--   empathy(공감) / helpful(도움돼요) / cheer(응원해요)
-- 주민소식은 empathy만 허용 (서버에서 강제).
-- =========================================================

CREATE TABLE IF NOT EXISTS reactions (
  id BIGSERIAL PRIMARY KEY,

  target_kind TEXT NOT NULL
    CHECK (
      target_kind IN (
        'talk_post',
        'talk_comment',
        'resident_news'
      )
    ),

  target_id BIGINT NOT NULL,

  user_id BIGINT NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  reaction_type TEXT NOT NULL
    CHECK (
      reaction_type IN (
        'empathy',
        'helpful',
        'cheer'
      )
    ),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (
    user_id,
    target_kind,
    target_id,
    reaction_type
  )
);


CREATE INDEX IF NOT EXISTS
idx_reactions_target
ON reactions(
  target_kind,
  target_id
);


COMMIT;
