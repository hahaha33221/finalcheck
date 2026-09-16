# 명동 선착순 승차 확인

버스 좌석(선착순 탑승) 배정을 실시간으로 확인하는 앱입니다. 관리자 1명이 명단에서 번호를 배정하거나 차량 출발을 확정하면, 링크를 가진 모든 사람의 화면에 실시간으로 반영됩니다.

- `client/` — React(Vite) 프런트엔드
- `server/` — Node.js(Express) + SQLite 백엔드, 실시간 갱신은 Server-Sent Events
- `deploy/` — VPS(Ubuntu/Debian) 배포용 systemd·nginx 설정과 스크립트
- `index.html` — 이전에 Claude Artifact로 만들었던 단일 파일 버전 (참고용으로 남겨둠, 이후 배포와는 무관)

## 로컬에서 실행

두 개의 터미널이 필요합니다.

```bash
# 1) 백엔드
cd server
cp .env.example .env
# .env 열어서 ADMIN_PASSWORD, SESSION_SECRET 값을 채워주세요
npm install
npm run dev        # http://localhost:4000

# 2) 프런트엔드
cd client
npm install
npm run dev         # http://localhost:5173 (자동으로 /api 요청을 4000번으로 프록시합니다)
```

브라우저에서 `http://localhost:5173` 접속 → 우측 상단 "관리자"로 로그인(.env의 `ADMIN_PASSWORD`) → 배정/취소/출발 확인 테스트.

## 데이터 모델

- `server/src/data/roster.js` — 명단(311명)·조 색상(8개)·버스 수(8)·좌석 수(44). 인원이 바뀌면 이 파일만 고치면 됩니다.
- `server/data/board.db` — SQLite. 배정(`assignments`)과 출발(`departures`) 기록. 서버 실행 중 자동 생성됩니다.
- `server/data/admin.json` — 관리자 비밀번호의 bcrypt 해시. 최초 실행 시 `.env`의 `ADMIN_PASSWORD`로 한 번 생성되고, 그 뒤로는 이 파일이 진실의 원천입니다. 비밀번호를 바꾸려면 이 파일을 지우고 `.env`의 `ADMIN_PASSWORD`를 새 값으로 바꾼 뒤 재시작하세요.

## 인증 모델

- 관리자는 한 명(비밀번호 하나)만 존재합니다. 로그인하면 서버가 토큰을 발급하고, 프런트엔드가 이를 `localStorage`에 저장해 이후 모든 쓰기 요청에 `Authorization: Bearer <token>` 헤더로 실어 보냅니다(12시간 만료). 쿠키를 쓰지 않기 때문에 프런트엔드와 API가 서로 다른 도메인(예: Vercel + VPS)이어도 그대로 동작합니다.
- 관리자만 쓰기 API(`/api/assign`, `/api/cancel`, `/api/depart`, `/api/undepart`, `/api/reset`)를 호출할 수 있습니다. 로그인하지 않은 사람은 명단·좌석 조회만 가능합니다(`/api/state`, `/api/roster`, `/api/events`).
- 세션이 만료되면 다음 쓰기 시도에서 401이 오고, 프런트엔드가 자동으로 보기 전용으로 전환합니다.

## 실시간 갱신

`GET /api/events`가 Server-Sent Events 스트림입니다. 관리자가 저장할 때마다 서버가 최신 상태를 모든 연결된 브라우저에 즉시 보냅니다(폴링 없음). 연결이 끊기면 프런트엔드가 8초 간격 폴링으로 자동 전환하고, status 표시줄에 상태(실시간 연결됨 / 자동 갱신 / 연결 끊김)가 보입니다.

## VPS 배포

`deploy/deploy.sh`가 Ubuntu/Debian 서버에서 필요한 걸 전부 설치·빌드·서비스 등록까지 합니다 (Node.js 20, nginx, systemd 서비스, 방금 만든 GitHub 브랜치 clone/pull).

서버에 SSH로 접속한 뒤:

```bash
curl -fsSL https://raw.githubusercontent.com/hahaha33221/finalcheck/claude/2pm-first-come-ride-check-pq8qnw/deploy/deploy.sh -o deploy.sh
chmod +x deploy.sh
sudo ./deploy.sh
```

최초 실행 시 관리자 비밀번호와 (선택) 공개 URL을 물어봅니다. 이후 코드를 업데이트하려면 서버에서 `sudo ./deploy.sh`를 다시 실행하면 됩니다(최신 브랜치를 pull하고 다시 빌드·재시작).

기본은 HTTP입니다. 도메인이 있다면 배포 후:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.example
```

구성 요소:
- `deploy/finalcheck-api.service` — Node 서버를 관리하는 systemd 유닛 (`systemctl status finalcheck-api`, `journalctl -u finalcheck-api -f`)
- `deploy/nginx.conf.example` — React 정적 빌드 서빙 + `/api`를 Node로 프록시(SSE용 버퍼링 비활성화 포함)

## 프런트엔드를 Vercel 등 다른 곳에서 서빙하기 (VPS는 API만)

프런트엔드와 API를 서로 다른 곳에 배포할 수도 있습니다 (예: 화면은 Vercel, 데이터는 VPS). 인증이 토큰 방식이라 쿠키의 same-origin 제약이 없어 그대로 됩니다. 다만 **API가 HTTPS여야 합니다** — HTTPS 프런트엔드가 HTTP API를 호출하는 건 브라우저가 막습니다(Mixed Content).

- **API를 HTTPS로 만드는 방법**: 가장 안정적인 건 도메인 구매 + certbot(위 섹션). 도메인 없이 임시로 하려면 `deploy/cloudflared-finalcheck.service`로 Cloudflare Quick Tunnel을 띄우면 `https://xxxx.trycloudflare.com` 같은 무료 HTTPS 주소가 생깁니다 — 단, 이 주소는 VPS 재부팅 등으로 터널이 재시작되면 바뀌므로, 바뀔 때마다 아래 프런트엔드 설정을 다시 맞춰줘야 합니다.
- **프런트엔드 쪽 설정**: 빌드/배포 환경에 `VITE_API_BASE=https://<API 주소>/api` 환경 변수를 설정합니다 (Vercel이면 프로젝트 Settings → Environment Variables). 비워두면 지금처럼 같은 origin의 `/api`를 씁니다.
- **API(VPS) 쪽 설정**: `server/.env`의 `CORS_ORIGIN`에 프런트엔드 주소를 추가합니다. 여러 개면 쉼표로 구분: `CORS_ORIGIN=http://31.97.71.87,https://your-project.vercel.app` 후 `systemctl restart finalcheck-api`.

## 알려진 사항

- `npm audit`이 `vite`/`esbuild`에 대해 경고를 띄울 수 있는데, 이는 **개발 서버**(`vite dev`)에만 해당하는 이슈입니다. 배포본은 `npm run build`로 만든 정적 파일을 nginx가 서빙하므로 영향이 없습니다.
- 참석자 311명의 실명(일부 성별 정보 포함)이 `server/src/data/roster.js`와 `index.html`에 그대로 들어 있습니다. 이 저장소를 공개로 전환하거나 다른 사람과 공유하기 전에 이 점을 고려해 주세요.
