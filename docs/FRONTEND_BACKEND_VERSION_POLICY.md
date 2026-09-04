# 단지온 Frontend ↔ Backend Version Policy

저장소: muphobia2/danjion (독립 저장소. skerishKang/02-danji-on과 혼동 금지)

이 문서는 백엔드 개발자가 저장소에 들어왔을 때
현재 프론트 기준, V2 정책, Git 운영, 복구 기준을 한 번에 이해하기 위한 것이다.

## 1. 현재 백엔드 개발 기준

현재 백엔드 구현은 현재 안정적인 프론트 통합 기준을 사용한다.

기본 기준:

- index.html
- app.html

백엔드 API / 인증 / DB / 권한 / E2E는
현재 안정 프론트의 기능 흐름을 기준으로 구현한다.

IMPORTANT:
“V2가 존재한다는 이유만으로 현재 백엔드 기준을 V2로 변경하지 않는다.”

## 2. V2 상태

V2 frontend는 현재 디자인 진행 중이다.

현재 제품 기준이 아니다.
최종 디자인 승인 전까지 main 기준으로 사용하지 않는다.

V2는:

design/frontend-v2-wip-20260905

에서 작업한다.

초기 보존본:

archive/frontend-v2-20260905

V2 핵심 파일:

- index2.html
- app2.html
- 01_이웃가게_발견_v2.html
- 03_주민혜택_쿠폰_v2.html
- README_AB_이웃가게_비교_20260905.md

## 3. V2 디자인 확정 후

V2가 최종 확정되면:

1. V2 화면 구조 확인
2. 기존 API contract와 비교
3. 필요한 API 변경 확인
4. 필요한 DB 변경 확인
5. 권한/인증 영향 확인
6. V2 frontend ↔ backend 연결
7. Local E2E
8. Production E2E
9. 검증 완료 후 main 승격

절대 원칙:
V2 전환 = backend 처음부터 재작성
이 아니다.

기존 검증된 backend를 최대한 유지하고
V2에 필요한 차이만 조정한다.

V2 확정 전 main merge 금지, backend 기준 변경 금지, production 배포 금지.

## 4. 복구 기준

stable/archive branch는 복구용이다.

frontend가 잘못 덮어써진 경우
작업본을 임의로 복원하지 않고
stable/archive branch와 비교한다.

archive branch 삭제 금지.

보존본:

- archive/frontend-v2-20260905 — V2 초기 보존본
- archive/phase3-local-0fc1796 — PHASE3 로컬 기준본
- archive/pre-integration-origin-main-38b1d17 — 통합 전 origin/main

## 5. Git branch 역할

main
= 검증 완료 제품 기준

feature/*
= 개발

design/*
= 디자인 작업

docs/*
= 문서

archive/*
= 복구용 보존본

main에는 미검증 디자인을 직접 반영하지 않는다.
force push 금지. rebase 금지.

## 6. Backend 팀 개발 규칙

현재 backend 개발자는
index.html + app.html 기준으로 개발한다.

frontend 변경을 이유로
backend API/DB/권한 계약을 임의 변경하지 않는다.

변경 필요 시:

- 변경 이유
- 영향을 받는 화면
- 영향을 받는 API
- DB 영향
- 권한 영향
- E2E 영향

을 기록한다.

Production 배포 전에는
현재 frontend와 backend의 실제 통합 E2E를 다시 수행한다.

## 7. Frontend 최신본 판단 원칙

파일명이나 Windows 수정 시각만으로
어떤 파일이 최신인지 판단하지 않는다.

실제 파일 내용과 Git commit을 기준으로 판단한다.

Drive와 GitHub가 다를 경우:

- 내용 비교
- 변경 의도 확인
- Git history 확인

후 반영한다.

무조건 Drive 전체 덮어쓰기 금지.

## 8. V2 작업 원칙

V2는 현재 디자인 WIP이다.

현재 backend 개발은
stable frontend 기준으로 계속한다.

V2 수정은 design branch에서만 수행한다.

V2가 최종 확정될 때까지
main에 직접 반영하지 않는다.

V2 확정 후 기존 backend와 통합검증한다.

V2 작업 위치:

design/frontend-v2-wip-20260905
