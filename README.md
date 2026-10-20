# 기록용 블로그

Astro로 만드는 정적 개인 블로그입니다. Markdown과 필요한 글의 MDX를 사용하며, 공개 사이트는 GitHub Pages에서 실행할 수 있습니다. 별도 서버·DB·댓글·시각 편집기는 사용하지 않습니다.

설계와 실제 진행 상태는 [docs/PLAN.md](docs/PLAN.md)에 정리합니다. 현재 공개 글은 **0개**이며 두 샘플은 계속 초안입니다. 현재 디자인은 2026-10-20 사용자 검토를 통해 채택했습니다.

## 준비와 실행

Node는 `.node-version`의 **22.23.3**을 권장합니다(최소 22.19). npm과 lockfile로 의존성을 고정합니다.

```sh
npm ci
npm run dev -- --port 4321
```

홈은 http://127.0.0.1:4321/ 입니다. 작성 미리보기는 초안을 포함합니다. `/posts/sample-programming/`과 `/posts/sample-everyday/`에서 본문·코드·표·이미지와 MDX를 확인할 수 있습니다. 검색은 작성 서버가 아니라 아래 **최종 정적 결과물**에서 사용합니다.

이 작업 PC의 시스템 Node가 이전 버전일 경우, 이미 설치한 로컬 런타임으로 실행할 수 있습니다. 시스템 Node를 변경할 필요는 없습니다.

```powershell
& .local/runtime/node_modules/node/bin/node.exe node_modules/astro/bin/astro.mjs dev --host 127.0.0.1 --port 4321
& .local/runtime/node_modules/node/bin/node.exe scripts/build.mjs
& .local/runtime/node_modules/node/bin/node.exe node_modules/astro/bin/astro.mjs preview --host 127.0.0.1 --port 4322
```

이 `.local` 런타임은 Git에 포함하지 않으므로 다른 PC에서는 `.node-version`에 맞는 Node를 준비하세요.

## 새 글과 이미지

`src/content/posts/<slug>/index.md` 또는 `index.mdx`를 만듭니다. 사이트 코드를 바꿀 필요는 없습니다. 두 형식에 동일한 규칙을 적용합니다.

```markdown
---
title: "새로운 기록"
date: "2026-10-20"
summary: "어떤 글인지 알려 주는 짧은 설명입니다."
slug: "my-first-post"
draft: true
tags: ["프로그래밍", "Java"]
---

## 첫 번째 이야기

본문을 작성합니다.

![이미지를 설명하는 대체 텍스트](./image.png)
```

- 필수값: title, date, summary, slug, draft. tags는 생략하면 빈 목록입니다.
- 날짜는 따옴표로 감싼 실제 YYYY-MM-DD 날짜를 사용합니다. 날짜는 표시·최신순 정렬 기준이며 예약 발행 기능이 아닙니다.
- 폴더명과 slug를 일치시킵니다. slug는 영문 소문자·숫자·하이픈이며 모든 Markdown/MDX에 걸쳐 고유해야 합니다. 같은 폴더에 index.md와 index.mdx를 동시에 만들지 마세요.
- 상세 주소는 `/posts/<slug>/`입니다. 제목을 바꾸어도 이미 게시한 slug는 유지하세요.
- 이미지는 같은 글 폴더에 저장하고 상대 경로로 참조합니다. 대체 텍스트를 작성하세요. 이미지와 MDX 상대 import의 파일 존재 여부는 초안에서도 검증합니다.
- 내부 글 링크는 `/posts/other-slug/`, 태그는 사이트에서 제공하는 링크를 사용합니다. 파일 시스템 경로인 `../other/index.md`로 연결하지 마세요. 프로젝트 사이트로 옮긴다면 작성한 절대 내부 링크에도 base 경로가 필요합니다.
- 외부 HTTP 이미지/링크의 원격 가용성은 빌드에서 검사하지 않습니다. 재현 가능한 검증을 위해 이미지는 로컬 파일 사용을 권장합니다.
- 태그는 한국어·영어·공백과 C++·C# 같은 이름을 사용할 수 있습니다. 파일 경로 구분 문자와 `? % < > : " | *`는 사용하지 않습니다. 기호는 안전한 태그 주소로 변환하며 화면에는 원래 이름을 표시합니다.

로컬 미리보기 → 정보/이미지 검증 → `draft: false`로 공개 지정 → 최종 빌드와 정적 확인 → 승인된 게시 브랜치에 반영하는 순서로 작성합니다. 최초 공개 글은 아직 정하지 않았습니다.

**공개 저장소에 커밋한 초안 원본은 비공개가 아닙니다.** 사이트에서 제외하는 것과 원본 비공개는 다릅니다. 비공개 원본은 커밋하지 않은 로컬 폴더에 보관하세요. 초안은 공개 상세 HTML·목록·태그·검색·RSS·사이트맵에서 제외됩니다. 샘플도 draft:true만 사용하며 별도 샘플 상태는 없습니다.

## 최종 빌드와 정적 확인

```sh
npm run validate:content
npm run build
npm run preview -- --port 4322
```

`npm run build`는 로컬과 CI에서 다음 절차를 동일하게 실행합니다.

1. 이전 `dist` 제거 후 메타데이터·실제 날짜·고유 주소·폴더 규칙·이미지·MDX 문법 검증.
2. Astro 정적 HTML과 자산 생성.
3. Pagefind extended로 공개 글의 검색 인덱스 생성.
4. 최종 HTML 경로, lang/canonical/공유 메타데이터, 내부 링크와 앵커, 로컬 자산과 CSS 글꼴, RSS·사이트맵 XML/공개 글 수, 검색 인덱스 수 검증.

어느 단계든 실패하면 명령이 실패하고 `dist`를 제거합니다. 검증되지 않은 결과물이나 이전 빌드가 배포 대상으로 남지 않습니다. 업로드 뒤에 검색 파일을 만들지 않습니다.

정적 미리보기는 http://127.0.0.1:4322/ 입니다. 초안은 나오지 않습니다. 현재는 홈·전체 글·태그·검색이 빈 상태이고, RSS의 항목도 비어 있습니다. 사이트맵에는 고정 화면만 포함됩니다. 공개 글이 0개인 것은 정상입니다.

화면·주소: `/`, `/posts/`, `/posts/<slug>/`, `/tags/`, `/tags/<태그>/`, `/about/`, `/search/`, `/rss.xml`, `/sitemap.xml`. 존재하지 않는 주소는 404 화면으로 처리하며 SPA 경로 우회를 사용하지 않습니다.

## 검색과 지원 범위

Pagefind **1.5.2**를 lockfile로 고정했습니다. Node API가 배포 패키지의 `pagefind_extended` 실행 파일을 사용하며, 인덱스 언어는 `ko`, 사이트·상세·검색 화면은 `lang="ko"`입니다. UI는 블로그에 맞춰 한국어로 작성했습니다.

공개 글의 **제목·요약·본문**만 검색합니다. 메뉴·날짜·태그 장식·접이식/옆 목차·푸터·복사 버튼은 제외합니다. 제목과 요약도 인덱싱 영역에 포함되며 검색 결과의 제목·설명으로 사용합니다. `includeCharacters: '+#'`로 C++와 C#의 기호를 보존합니다.

한국어 단어 분리는 사용하지만 어간 처리는 지원하지 않습니다. 조사·어미·띄어쓰기 변형이 모두 일치한다고 보장하지 않습니다. 여러 단어의 검색에서도 정확한 문구 일치를 보장하지 않습니다(검증 중 `한국어 검증` 검색이 본문에 `검증`만 있는 글을 반환한 사례를 확인했습니다). 실제로 확인한 검색어와 결과는 `npm run test:acceptance`가 생성하는 `.local/final-review/report.json`에 기록합니다.

공식 근거: [언어/extended 지원](https://pagefind.app/docs/multilingual/), [기호 보존](https://pagefind.app/docs/config-options/#include-characters), [Node API](https://pagefind.app/docs/node-api/).

## 재현 가능한 검증

```sh
npm test
npx playwright install chromium
npm run test:acceptance
```

이미 설치한 Chrome을 쓸 경우 PowerShell에서 `$env:BROWSER_EXECUTABLE='C:\Program Files\Google\Chrome\Application\chrome.exe'`를 지정할 수 있습니다. Playwright도 개발 의존성으로 고정했습니다.

- 단위 검증: Markdown/MDX 공통 규칙, 누락 필드·잘못된 형식, 실제 날짜, 중복 주소, 폴더명, 누락 이미지·대체 텍스트·MDX import/문법.
- 통합 검증: `.local/build-acceptance`에 소스와 의존성을 복사하고 임시 글을 생성하여 같은 최종 빌드를 실행합니다. 실제 글 폴더나 샘플의 draft 값을 변경하지 않습니다. 별도 서버/저장소를 사용하는 기능이 아니라 로컬 테스트용 정적 서버입니다.
- 공개 글 0개와 공개 Markdown/MDX 글, 제목/요약/본문 고유 단어, 한국어 기술 용어·영문 식별자, C++/C#, 빈 결과·초안/샘플/공통 UI 제외를 실제 검색 화면에서 검사합니다.
- 모바일/데스크톱 × 밝은/어두운 테마에서 메뉴 키보드 조작·태그 탐색·직접 상세와 새로고침·코드 복사·목차·이미지·가로 스크롤을 검사합니다.
- 잘못된 내부 링크와 검색 생성 실패가 빌드를 실패시키고 dist를 남기지 않는지, 공개 글을 제거한 후 이전 HTML/검색 잔재가 사라지는지 확인합니다.
- `BLOG_BASE=/test-blog/` 구성에서 최종 검증과 실제 검색 결과 링크·상세 새로고침·이미지를 검사합니다.

로그·검색어/기대/실제 결과·스크린샷은 `.local/final-review/`에 생성하며 Git에서 제외합니다. 검증용 공개 글이 들어 있는 임시 산출물은 실제 배포할 `dist`와 다릅니다. 실제 작업 폴더의 최종 결과물은 `npm run build`로 별도로 생성하세요.

프로젝트 사이트 검증 예시:

```powershell
$env:BLOG_BASE='/repository-name/'
npm run build
npm run preview -- --port 4322
# 확인 후 이 터미널에서 제거하고 실제 사용자 사이트 빌드를 다시 생성
Remove-Item Env:BLOG_BASE
npm run build
```

## 배포 설정 준비와 실제 게시

현재 원격 Pages는 **main 브랜치, 루트(`/`), legacy Jekyll 게시**입니다(2026-10-20 API로 읽기 확인). 로컬 작업 브랜치는 `codex/blog-redesign`입니다. **별도 공개 요청 전에는 어떤 브랜치에도 push하지 않고 main 반영·Pages 설정 변경·배포 실행을 하지 않습니다.** 새 수동 워크플로만으로 기존 자동 게시 경로가 통제되었다고 판단하지 않습니다.

`.github/workflows/pages.yml`은 수동 실행만 지원하며 `publish` 기본값은 false입니다. 로컬과 같은 `npm ci`/`npm run build` 후 **검증한 동일 dist**를 Pages artifact로 업로드합니다. publish가 true이고 main에서 실행한 경우에만 배포 job이 실행되도록 준비했습니다. 로컬에서 워크플로 구조를 검사했으며 GitHub 실행은 하지 않았습니다.

공개 요청을 받으면 다음 순서로 진행합니다.

1. 원격 게시 경로·설정을 재확인하고 로컬 최종 검증을 다시 수행합니다.
2. **main에 변경을 반영하기 전에** Pages Source를 GitHub Actions로 전환하여 기존 브랜치 자동 게시를 중단합니다. 기존 공개 사이트가 새 배포 전까지 유지되는지 확인합니다. 전환할 수 없으면 원격 반영을 중단합니다.
3. 승인된 변경을 main에 반영하고 수동 워크플로의 publish:true로 검증·업로드·배포합니다. 다시 빌드한 별도 결과물을 배포하지 않습니다.
4. 실제 공개 주소에서 링크·이미지·검색·RSS·사이트맵·상세 직접 접속을 확인합니다. 자동 배포 전환은 별도 공개 단계에서만 수행합니다.

상태는 **로컬 검증 완료 / 배포 설정 준비 완료 / 공개 사이트 확인 완료**로 나누어 보고합니다. 지금은 원격 반영과 실제 공개 배포를 수행하지 않습니다.

## 유지보수

소개 문구는 `src/pages/about.astro`, 사이트 공통 정보와 경로는 `src/lib/site.mjs`, 색상·폭·글꼴 크기는 `src/styles/global.css`에서 관리합니다. 평소 글 작성에는 이 파일들을 수정하지 않습니다. 소개 문구는 기존에 확인한 블로그 목적을 바탕으로 작성했으며 상세 프로필은 아직 없습니다.

의존성 변경은 lockfile을 함께 반영하고 단위/최종 빌드/필요한 통합 검증을 실행합니다. 현재 Astro/MDX 조합의 `use astro:head-inject` 빌드 경고는 숨기지 않고 기록합니다. 실제 공개 MDX를 포함한 로컬 검증 결과는 계획 문서의 최신 실행 기록을 확인하세요. 광고·외부 댓글·방문자 추적은 포함하지 않습니다.
