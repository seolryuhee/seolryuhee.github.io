# 개발 안내

블로그의 로컬 실행, 콘텐츠 작성과 검증, 수동 배포 방법을 정리합니다. 의존성 버전은 `package.json`과 `package-lock.json`, Node 버전은 `.node-version`을 기준으로 합니다.

## 실행 환경

Node.js 22.23.3과 npm을 사용합니다. 의존성은 `npm ci`로 설치하며 별도 서버·DB·인증용 `.env` 파일은 필요하지 않습니다.

Windows에서 저장소 안에 설치한 전용 런타임을 사용하는 경우, PowerShell 창을 열고 저장소 루트에서 다음을 실행합니다. 전용 런타임이 없는 환경에서는 `.node-version`에 맞는 Node와 npm을 준비하면 됩니다.

```powershell
$nodeVersion = (Get-Content .node-version -Raw).Trim()
$runtimeDir = (Resolve-Path ".local/runtime/node-v$nodeVersion-win-x64").Path
$nodeExe = Join-Path $runtimeDir 'node.exe'
$npmCli = Join-Path $runtimeDir 'node_modules/npm/bin/npm-cli.js'
$env:Path = $runtimeDir + ';' + (($env:Path -split ';' | Where-Object { $_ -ne $runtimeDir }) -join ';')

& $nodeExe --version
& $nodeExe $npmCli ci
if ($LASTEXITCODE -ne 0) { throw '의존성 설치 실패' }
& $nodeExe $npmCli run dev -- --port 4321
```

이 환경에서는 아래 예시의 `npm`을 `& $nodeExe $npmCli`로 바꿔 실행할 수 있습니다. 설정은 현재 PowerShell 창에만 적용됩니다. 개발 서버는 `http://127.0.0.1:4321/`, 정적 미리보기는 `http://127.0.0.1:4322/`이며 종료는 `Ctrl+C`입니다. 런타임·의존성·산출물은 Git에서 제외합니다.

## 글과 이미지

- 글은 `src/content/posts/<slug>/index.md` 또는 `index.mdx`에 작성합니다. 같은 폴더에 두 형식을 동시에 만들지 않습니다.
- 필수 메타데이터는 `title`, `date`, `summary`, `slug`, `draft`입니다. `tags`는 생략하면 빈 목록입니다.
- `date`는 따옴표로 감싼 실제 `YYYY-MM-DD` 날짜이며 예약 발행 기능이 아닙니다.
- 폴더명과 slug는 같아야 합니다. slug는 영문 소문자·숫자·하이픈으로 만들고 중복하지 않습니다. 이미 게시한 글의 slug는 유지합니다.
- 태그에는 한국어·영어·공백·C++·C#을 사용할 수 있습니다. 경로 구분 문자와 `? % < > : " | *`는 사용할 수 없습니다.
- 이미지는 글 폴더에 두고 `![대체 텍스트](./image.png)`로 연결합니다. 누락 이미지·대체 텍스트·MDX 상대 import는 초안도 검증합니다.
- 다른 글에는 `/posts/other-slug/`와 같은 사이트 주소로 연결합니다. 원본 Markdown 파일 경로를 사용하지 않습니다.

개발 서버는 초안을 포함하지만 공개 빌드에서는 초안을 제외합니다. 공개 저장소에 push한 파일 원본은 열람할 수 있으므로 비공개 자료는 커밋하지 않습니다. 기존 샘플 두 글은 초안 상태로 유지합니다.

## 빌드와 검색 검증

```sh
npm run validate:content
npm test
npm run build
npm run preview -- --port 4322
```

최종 빌드는 기존 `dist`를 정리하고 콘텐츠 검증 → Astro → Pagefind → 최종 결과물 검증 순서로 실행합니다. 오류가 나면 실패한 `dist`를 제거합니다. 검색은 이 정적 미리보기에서 확인합니다.

```sh
npm run test:acceptance
```

통합 검증은 `.local/build-acceptance`에 독립된 소스·의존성 복사본을 만들고 실제 글의 복사본만 초안으로 전환합니다. 공개 글 0개와 Markdown/MDX 테스트 글, 검색, 이미지, MDX CSS 전달, 목차·코드 복사·모바일 메뉴·테마, 빌드 실패 처리와 하위 경로를 검사합니다. 원본 글이나 게시 상태는 바꾸지 않습니다.

Playwright가 관리하는 브라우저 대신 설치된 Chrome을 쓸 때는 `BROWSER_EXECUTABLE`을 지정합니다. 아래 경로는 설치 위치에 맞게 바꾸세요.

```powershell
$env:BROWSER_EXECUTABLE = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
& $nodeExe $npmCli run test:acceptance
```

통합 검증의 로그·검색 결과·스크린샷은 `.local/final-review/`에 생성합니다. 테스트 폴더의 결과물을 배포에 사용하지 않고 저장소 루트의 `npm run build`로 생성한 `dist`를 사용합니다.

기본 사이트 경로는 `/`입니다. 프로젝트 경로를 시험할 때만 `BLOG_BASE`를 지정하고, 확인 후 환경 변수를 제거한 뒤 기본 빌드를 다시 생성합니다.

```powershell
$env:BLOG_BASE = '/test-blog/'
& $nodeExe $npmCli run build
Remove-Item Env:BLOG_BASE
& $nodeExe $npmCli run build
```

## UTF-8 커밋

파일과 커밋 메시지는 UTF-8로 작성합니다. 다른 문자 인코딩을 사용하는 전역 설정이 있더라도 이 저장소의 커밋을 UTF-8로 표시하도록 최초 한 번 설정합니다.

```sh
git config --local i18n.commitEncoding utf-8
git config --local i18n.logOutputEncoding utf-8
```

메시지 파일을 사용할 때도 실제 파일 인코딩을 UTF-8로 저장합니다. 메시지 바이트와 Git의 인코딩 설정이 다르면 GitHub에서 글자가 깨질 수 있습니다.

## 수동 배포와 공개 확인

GitHub Pages의 게시 소스는 GitHub Actions입니다. `.github/workflows/pages.yml`은 수동 실행만 지원하고, `publish=true`이면서 `main`에서 실행할 때 배포합니다. GitHub CLI 사용 전에는 본인 계정으로 인증합니다.

```sh
git status
git push origin main
gh workflow run pages.yml --ref main -f publish=true
```

요청한 커밋의 실행을 조회하고 build와 deploy가 모두 성공하는지 확인합니다. 실행 번호가 조회되기 전에는 잠시 후 다시 조회합니다.

```powershell
$commit = git rev-parse HEAD
$runId = gh run list --workflow pages.yml --branch main --commit $commit --event workflow_dispatch --limit 1 --json databaseId --jq '.[0].databaseId'
if (-not $runId) { throw '배포 실행 번호를 다시 조회하세요.' }
gh run watch $runId --exit-status
if ($LASTEXITCODE -ne 0) { throw 'Actions 로그를 확인하세요.' }
```

공개 검증은 해당 실행의 `github-pages` artifact를 내려받아 수행합니다. ZIP과 `artifact.tar`의 경로를 확인한 뒤 별도 폴더에 추출하고, 그 폴더를 `DEPLOY_ARTIFACT_DIR`로 지정합니다. 로컬에서 다시 빌드한 결과물로 대신하지 않습니다.

```powershell
$env:DEPLOY_ARTIFACT_DIR = (Resolve-Path '.local/deployment/ci-dist').Path
$env:DEPLOY_COMMIT = $commit
& $nodeExe $npmCli run verify:live
```

공개 파일의 SHA-256, 초안 제외, 글·목차·링크·RSS·사이트맵, 실제 검색창의 결과와 상세 이동, 화면 크기·테마별 동작을 확인합니다. 보고서·스크린샷은 `.local/deployment/`에 저장하며 Git에서 제외합니다.

## 주요 파일

| 위치 | 역할 |
| --- | --- |
| `src/lib/site.mjs` | 사이트 이름·설명·공통 경로 |
| `src/layouts/Base.astro` | 공통 머리글·꼬리글·메타데이터 |
| `src/styles/global.css` | 색상·레이아웃·반응형 스타일 |
| `src/pages/about.astro` | 소개 문구 |
| `src/content/posts/` | 글과 이미지 |

Astro 7.3.6은 [공식 수정 #18088](https://github.com/withastro/astro/pull/18088)을 포함하여 오래된 `use astro:head-inject` 지시문 경고를 해결합니다. 별도 경고 필터는 사용하지 않습니다. 이전 구현·배포 기록은 [설계 문서](PLAN.md)에 보관합니다.
