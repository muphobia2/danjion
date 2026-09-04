-- =========================================================
-- PHASE 4 SEED (seed only, not a migration)
--
-- 적용 방법: migrations/007 적용 이후 1회 실행.
-- complex_contents는 slug 기준 ON CONFLICT DO NOTHING.
-- talk/reaction/comment seed는 최초 1회만 실행한다.
-- 실제 주민 계정(user 1/7)을 작성자로 사용한다.
-- =========================================================

BEGIN;

-- =========================================================
-- 1. 단지온 공지 8건 (reactions OFF, comments OFF)
-- =========================================================

INSERT INTO complex_contents (
  complex_id, content_type, slug, title, body,
  author_type, official_author_name, official_author_title,
  status, reactions_enabled, comments_enabled, published_at
)
SELECT
  c.id, 'danjion_notice', v.slug, v.title, v.body,
  'official', '단지온 운영팀', '단지온 운영팀',
  'published', FALSE, FALSE,
  NOW() - (v.days_ago || ' days')::INTERVAL
FROM complexes c
CROSS JOIN (VALUES
  (
    'danjion-notice-d01',
    'D-01 단지온은 어떤 서비스인가요?',
    '단지온은 같은 단지에 사는 이웃이 가게·소식·대화를 나누는 주민 생활 서비스입니다. 가입 후 주민인증을 마치면 이웃대화와 주민소식 신청을 이용할 수 있습니다.',
    30
  ),
  (
    'danjion-notice-d02',
    'D-02 단지온은 이렇게 운영합니다',
    '단지온은 주민 인증을 거친 이웃만 글을 쓸 수 있습니다. 광고·비방·개인정보 노출은 운영팀이 가리고, 반복되면 이용이 제한될 수 있습니다.',
    27
  ),
  (
    'danjion-notice-d03',
    'D-03 우리주민가게는 이렇게 등록·확인합니다',
    '가게를 직접 운영하면 내 가게 등록을 신청하고, 좋은 가게를 알면 이웃가게로 제보할 수 있습니다. 점주 신청은 증빙 확인을 거쳐 공개되며, 사진은 최대 3장까지 올릴 수 있습니다.',
    24
  ),
  (
    'danjion-notice-d04',
    'D-04 이웃활동 레벨은 어떻게 올라가나요?',
    '이웃활동 레벨 기능은 아직 준비 중입니다. 공개 범위와 조건이 정해지면 이 공지로 먼저 안내하겠습니다.',
    21
  ),
  (
    'danjion-notice-d05',
    'D-05 이번 단지온 업데이트 안내',
    '이번 업데이트에서는 내 가게 등록 신청과 이웃가게 제보, 관리자 심사(수정요청·승인·거절), 신청 사진과 증빙 파일 관리가 동작합니다. 검증된 기능부터 순서대로 열고 있습니다.',
    18
  ),
  (
    'danjion-notice-d06',
    'D-06 이웃대화 이용 안내',
    '이웃대화에는 궁금해요·단지이야기·가입인사·같이해요 네 가지 주제가 있습니다. 궁금한 것은 궁금해요에, 같이하고 싶은 일은 같이해요에 올려주세요. 답글은 한 단계까지 달 수 있습니다.',
    15
  ),
  (
    'danjion-notice-d07',
    'D-07 주민소식 신청과 게시 기준',
    '주민소식은 바로 게시되지 않고 신청을 거쳐 운영진이 확인한 뒤 게시됩니다. 사실과 다른 내용이나 특정 개인을 비방하는 글은 게시되지 않습니다. 공감 1종으로 응원할 수 있습니다.',
    12
  ),
  (
    'danjion-notice-d08',
    'D-08 문의·제보·신고는 이렇게 이용해 주세요',
    '궁금한 점은 이웃대화 궁금해요에, 좋은 가게는 이웃가게 제보에 올려주세요. 문제가 되는 글은 운영팀이 확인 후 가립니다.',
    9
  )
) AS v(slug, title, body, days_ago)
WHERE c.slug = 'banglim-myeongji-roadhill'
ON CONFLICT (slug) DO NOTHING;


-- =========================================================
-- 2. 아파트소식 4건 (reactions OFF, comments OFF)
-- =========================================================

INSERT INTO complex_contents (
  complex_id, content_type, slug, title, body,
  author_type, official_author_name, official_author_title,
  status, reactions_enabled, comments_enabled, published_at
)
SELECT
  c.id, 'apartment_news', v.slug, v.title, v.body,
  'official', v.author_name, v.author_title,
  'published', FALSE, FALSE,
  NOW() - (v.days_ago || ' days')::INTERVAL
FROM complexes c
CROSS JOIN (VALUES
  (
    'apartment-news-a01',
    '김경애 회장 인사 — 단지온을 시작하며',
    '안녕하세요. 제5기 입주자대표회의 회장 김경애입니다. 우리 단지 이웃이 서로 얼굴을 알고 돕는 곳이 되길 바라며 단지온을 시작합니다. 좋은 가게와 소식을 이웃과 나눠주세요.',
    '김경애',
    '제5기 입주자대표회의 회장',
    20
  ),
  (
    'apartment-news-a02',
    '관리사무소 안내 — 음식물 쓰레기 배출 시간',
    '음식물 쓰레기는 저녁 8시 이후에 전용 수거함에 배출해 주세요. 낮 시간대 배출은 악취 민원의 원인이 됩니다.',
    '관리사무소',
    '관리사무소',
    14
  ),
  (
    'apartment-news-a03',
    '단지 내 어린이놀이터 이용 안내',
    '어린이놀이터는 오전 9시부터 저녁 8시까지 이용할 수 있습니다. 밤 시간대에는 소음에 유의해 주세요.',
    '관리사무소',
    '관리사무소',
    10
  ),
  (
    'apartment-news-a04',
    '주차장 외부 차량 단속 안내',
    '등록되지 않은 외부 차량의 장기 주차는 단속 대상입니다. 방문 차량은 관리사무소에 미리 알려주세요.',
    '관리사무소',
    '관리사무소',
    6
  )
) AS v(slug, title, body, author_name, author_title, days_ago)
WHERE c.slug = 'banglim-myeongji-roadhill'
ON CONFLICT (slug) DO NOTHING;


-- =========================================================
-- 3. 주민소식 published 5건 (reaction ON, comments OFF)
-- residents direct publish 경로가 아닌 seed 게시.
-- =========================================================

INSERT INTO complex_contents (
  complex_id, content_type, slug, title, body,
  author_type, author_user_id,
  status, reactions_enabled, comments_enabled, published_at
)
SELECT
  c.id, 'resident_news', v.slug, v.title, v.body,
  'resident', v.author_id,
  'published', TRUE, FALSE,
  NOW() - (v.days_ago || ' days')::INTERVAL
FROM complexes c
CROSS JOIN (VALUES
  (
    'resident-news-r01',
    '주말에 단지 앞 공원에서 플로깅해요',
    '지난 주말 아이들과 공원 한 바퀴를 돌며 쓰레기를 주웠습니다. 다음에는 함께하실 분을 모집해 보려 합니다.',
    7,
    8
  ),
  (
    'resident-news-r02',
    '분리수거장 이용 후기',
    '새로 바뀐 분리수거장 표시가 알아보기 쉬워졌습니다. 페트병 라벨 떼는 곳도 깔끔해졌네요.',
    1,
    7
  ),
  (
    'resident-news-r03',
    '엘리베이터에 붙은 손글씨 감사 인사',
    '누군가 엘리베이터에 고마웠던 일을 손글씨로 붙여 두셨더라고요. 작은 메모인데 하루가 좋아졌습니다.',
    7,
    5
  ),
  (
    'resident-news-r04',
    '저녁 산책 모임 첫 모임 후기',
    '가볍게 30분 산책 모임을 시작했습니다. 다음 모임은 같이해요 게시판에 올리겠습니다.',
    1,
    4
  ),
  (
    'resident-news-r05',
    '자전거 보관소 정리 봉사 후기',
    '버려진 자전거를 정리하는 봉사에 다녀왔습니다. 보관소가 한결 넓어졌습니다.',
    7,
    2
  )
) AS v(slug, title, body, author_id, days_ago)
WHERE c.slug = 'banglim-myeongji-roadhill'
ON CONFLICT (slug) DO NOTHING;


-- =========================================================
-- 4. 이웃대화 26건
-- 궁금해요 7 / 단지이야기 7 / 가입인사 6 / 같이해요 6
-- =========================================================

INSERT INTO talk_posts (
  complex_id, author_user_id, category, title, body, status
)
SELECT
  c.id, v.author_id, v.category, v.title, v.body, 'active'
FROM complexes c
CROSS JOIN (VALUES
  ('question', '택배 분실됐을 때 어디에 먼저 문의하나요?', '경비실에 여쭤보니 보관함 확인부터 하라고 하시네요. 비슷한 경험 있으신 분 계신가요?', 7),
  ('question', '인터넷 업체 바꾸신 분 계세요?', '약정이 끝나서 바꾸려는데 단지에서 잘 터지는 곳이 궁금합니다.', 1),
  ('question', '베란다 결로 해결 방법 공유해요', '겨울마다 베란다가 축축해지는데 효과 본 방법 있으시면 알려주세요.', 7),
  ('question', '주차 등록은 어디서 하나요?', '이사 온 지 얼마 안 돼서 절차를 모르겠습니다. 관리사무소 방문이 맞나요?', 1),
  ('question', '분리수거 스티커는 어디서 사나요?', '대형 폐기물 스티커 구매처가 궁금합니다.', 7),
  ('question', '엘리베이터 고장 신고는 어디로 하나요?', '어젯밤에 잠깐 멈칫했는데 신고해야 할지 모르겠어요.', 1),
  ('question', '아이 돌봄 품앗이 하시는 분 있나요?', '주말 오전에 돌봄을 나누고 싶은데 관심 있으신 분 계실까요?', 7),
  ('complex_story', '벚꽃 필 때 단지 산책로가 예뻐요', '매년 봄이면 산책로가 분홍빛으로 물듭니다. 사진 찍기 좋습니다.', 1),
  ('complex_story', '고양이 집사가 된 사연', '주차장에서 구조한 고양이를 입양했습니다. 동물병원 정보 나눠요.', 7),
  ('complex_story', '10년 살며 느낀 우리 단지의 장점', '역과 가깝고 공원이 있는 게 가장 좋습니다. 이웃들도 정이 많아요.', 1),
  ('complex_story', '옥상 텃밭 첫 수확했어요', '상추와 방울토마토를 처음 수확했습니다. 나눔도 하고 싶어요.', 7),
  ('complex_story', '새벽 운동 모임 100일째', '매일 새벽 6시에 모여 걷고 있습니다. 꾸준히 하니 몸이 가벼워졌어요.', 1),
  ('complex_story', '반려견 산책 코스 추천', '공원에서 강변까지 이어지는 코스가 한적하고 좋습니다.', 7),
  ('complex_story', '이사 첫날 도와주신 이웃 감사합니다', '무거운 짐을 함께 들어주신 윗집 분께 다시 한번 감사드립니다.', 1),
  ('introduction', '이번 달에 이사 왔어요. 잘 부탁드립니다', '아이 둘과 함께 이사 왔습니다. 동네 정보를 많이 배우고 싶어요.', 7),
  ('introduction', '신혼부부입니다. 인사드려요', '결혼하고 처음 마련한 집입니다. 잘 지내보아요.', 1),
  ('introduction', '부모님 댁 근처로 이사 왔습니다', '왕래가 편해져서 좋습니다. 이웃으로 잘 부탁드립니다.', 7),
  ('introduction', '자취 첫 시작 인사드려요', '혼자 살기는 처음이라 떨리네요. 맛집 정보 환영합니다.', 1),
  ('introduction', '복직맘 인사드립니다', '육아휴직 끝나고 복직했습니다. 같은 고민 나누고 싶어요.', 7),
  ('introduction', '은퇴 후 이사 왔어요', '조용한 곳을 찾다가 왔습니다. 바둑 두실 분 환영해요.', 1),
  ('together', '주말 아침 러닝 같이 하실 분', '토요일 7시에 정문에서 만나요. 속도는 천천히 갑니다.', 7),
  ('together', '독서 모임 인원 모집해요', '한 달에 한 권씩 읽고 이야기 나눠요. 첫 책은 같이 정해요.', 1),
  ('together', ' Seasonal 김장 같이 하실 분', '김장 양이 많아서 나누실 분 찾습니다. 재료는 함께 준비해요.', 7),
  ('together', '등산 동호회 만드실 분 계세요?', '근교 낮은 산부터 시작하려 합니다. 초보 환영이에요.', 1),
  ('together', '악기 합주하실 분 찾아요', '기타 치는데 피아노나 다른 악기 하시는 분과 합주하고 싶어요.', 7),
  ('together', '반찬 나눔 시작해요', '많이 만들었을 때 나눠요. 알레르기 정보는 꼭 적어주세요.', 1)
) AS v(category, title, body, author_id)
WHERE c.slug = 'banglim-myeongji-roadhill'
  AND NOT EXISTS (
    SELECT 1 FROM talk_posts tp
    JOIN complexes cc ON cc.id = tp.complex_id
    WHERE cc.slug = 'banglim-myeongji-roadhill'
  );


-- =========================================================
-- 5. 반응 seed (불균등: 일부만, 개수 다양)
-- =========================================================

INSERT INTO reactions (target_kind, target_id, user_id, reaction_type)
SELECT 'talk_post', tp.id, 1, 'empathy'
FROM talk_posts tp
JOIN complexes c ON c.id = tp.complex_id
WHERE c.slug = 'banglim-myeongji-roadhill'
  AND tp.title IN (
    '택배 분실됐을 때 어디에 먼저 문의하나요?',
    '벚꽃 필 때 단지 산책로가 예뻐요',
    '주말 아침 러닝 같이 하실 분'
  )
ON CONFLICT DO NOTHING;

INSERT INTO reactions (target_kind, target_id, user_id, reaction_type)
SELECT 'talk_post', tp.id, 7, 'empathy'
FROM talk_posts tp
JOIN complexes c ON c.id = tp.complex_id
WHERE c.slug = 'banglim-myeongji-roadhill'
  AND tp.title IN (
    '택배 분실됐을 때 어디에 먼저 문의하나요?',
    '벚꽃 필 때 단지 산책로가 예뻐요'
  )
ON CONFLICT DO NOTHING;

INSERT INTO reactions (target_kind, target_id, user_id, reaction_type)
SELECT 'talk_post', tp.id, 7, 'helpful'
FROM talk_posts tp
JOIN complexes c ON c.id = tp.complex_id
WHERE c.slug = 'banglim-myeongji-roadhill'
  AND tp.title = '베란다 결로 해결 방법 공유해요'
ON CONFLICT DO NOTHING;

INSERT INTO reactions (target_kind, target_id, user_id, reaction_type)
SELECT 'talk_post', tp.id, 1, 'cheer'
FROM talk_posts tp
JOIN complexes c ON c.id = tp.complex_id
WHERE c.slug = 'banglim-myeongji-roadhill'
  AND tp.title = '새벽 운동 모임 100일째'
ON CONFLICT DO NOTHING;

INSERT INTO reactions (target_kind, target_id, user_id, reaction_type)
SELECT 'resident_news', cc.id, 1, 'empathy'
FROM complex_contents cc
JOIN complexes c ON c.id = cc.complex_id
WHERE cc.slug = 'resident-news-r01'
ON CONFLICT DO NOTHING;

INSERT INTO reactions (target_kind, target_id, user_id, reaction_type)
SELECT 'resident_news', cc.id, 7, 'empathy'
FROM complex_contents cc
JOIN complexes c ON c.id = cc.complex_id
WHERE cc.slug IN ('resident-news-r01', 'resident-news-r03')
ON CONFLICT DO NOTHING;


-- =========================================================
-- 6. 댓글/답글 seed (불균등: 일부만, 1단 답글 포함)
-- =========================================================

INSERT INTO talk_comments (post_id, author_user_id, parent_comment_id, body, status)
SELECT tp.id, 1, NULL, '저도 같은 일 있었어요. 관리사무소에 CCTV 확인 요청했더니 해결됐습니다.', 'active'
FROM talk_posts tp
JOIN complexes c ON c.id = tp.complex_id
WHERE c.slug = 'banglim-myeongji-roadhill'
  AND tp.title = '택배 분실됐을 때 어디에 먼저 문의하나요?'
  AND NOT EXISTS (
    SELECT 1 FROM talk_comments tc WHERE tc.post_id = tp.id
  );

INSERT INTO talk_comments (post_id, author_user_id, parent_comment_id, body, status)
SELECT
  tc.post_id, 7, tc.id,
  'CCTV 확인은 생각 못 했네요. 감사합니다.',
  'active'
FROM talk_comments tc
JOIN talk_posts tp ON tp.id = tc.post_id
JOIN complexes c ON c.id = tp.complex_id
WHERE c.slug = 'banglim-myeongji-roadhill'
  AND tp.title = '택배 분실됐을 때 어디에 먼저 문의하나요?'
  AND tc.parent_comment_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM talk_comments reply
    WHERE reply.parent_comment_id = tc.id
  );

INSERT INTO talk_comments (post_id, author_user_id, parent_comment_id, body, status)
SELECT tp.id, 7, NULL, '저도 참여하고 싶어요. 준비물은 있나요?', 'active'
FROM talk_posts tp
JOIN complexes c ON c.id = tp.complex_id
WHERE c.slug = 'banglim-myeongji-roadhill'
  AND tp.title = '주말 아침 러닝 같이 하실 분'
  AND NOT EXISTS (
    SELECT 1 FROM talk_comments tc WHERE tc.post_id = tp.id
  );

INSERT INTO talk_comments (post_id, author_user_id, parent_comment_id, body, status)
SELECT tp.id, 1, NULL, '환영합니다. 궁금한 거 있으시면 편하게 물어보세요.', 'active'
FROM talk_posts tp
JOIN complexes c ON c.id = tp.complex_id
WHERE c.slug = 'banglim-myeongji-roadhill'
  AND tp.title = '이번 달에 이사 왔어요. 잘 부탁드립니다'
  AND NOT EXISTS (
    SELECT 1 FROM talk_comments tc WHERE tc.post_id = tp.id
  );

COMMIT;
