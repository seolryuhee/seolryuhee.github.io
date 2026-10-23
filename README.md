# 배운 것과 지나온 날들

프로그래밍을 하며 배운 것과 일상에서 지나온 장면들을 남기는 개인 블로그입니다.
문제를 해결한 과정, 코드를 읽다가 알게 된 것, 나중에 다시 꺼내 보고 싶은 생각을 천천히 기록합니다.

**[블로그](https://seolryuhee.github.io/)** · [전체 글](https://seolryuhee.github.io/posts/) · [태그](https://seolryuhee.github.io/tags/) · [검색](https://seolryuhee.github.io/search/) · [RSS](https://seolryuhee.github.io/rss.xml)

첫 기록은 [한영키를 누르기 싫어서 모드를 만들었습니다](https://seolryuhee.github.io/posts/korean-ime-fix-mod/)입니다. Necesse의 한글 입력 문제를 계기로 Korean IME Fix Mod를 만들게 된 이야기를 담았습니다.

## 블로그 구성

Astro로 만드는 정적 사이트입니다. 글은 Markdown으로 작성하고, 컴포넌트가 필요한 글에는 MDX를 사용합니다. 제목·요약·본문 검색은 Pagefind가 맡고, 완성된 사이트는 GitHub Pages에 게시합니다.

태그별 글 모아보기, 목차, 코드 복사, 밝은 화면과 어두운 화면, 모바일 메뉴를 제공합니다. RSS로 새 글을 구독할 수도 있습니다. 별도 서버나 데이터베이스 없이 운영하며 광고·외부 댓글·방문자 추적은 사용하지 않습니다.

## 로컬에서 실행하기

[.node-version](.node-version)에 지정된 Node.js와 npm을 준비한 뒤 저장소 루트에서 실행합니다.

```sh
npm ci
npm run dev -- --port 4321
```

[http://127.0.0.1:4321/](http://127.0.0.1:4321/)에서 작성 중인 글을 볼 수 있습니다. 저장하면 화면에 반영되며, 개발 서버에는 초안도 표시됩니다. 검색은 아래의 정적 미리보기에서 확인합니다.

프로젝트 전용 Node를 사용하는 Windows 환경의 실행 방법은 [개발 안내](docs/DEVELOPMENT.md)에 정리했습니다.

## 글 작성하기

글마다 `src/content/posts/<slug>/` 폴더를 만들고 `index.md` 또는 `index.mdx`를 작성합니다. 이미지는 같은 폴더에 두고 상대 경로로 연결합니다.

```text
src/content/posts/my-note/
├── index.md
└── diagram.png
```

```markdown
---
title: "배운 것을 남기는 방법"
date: "2026-10-23"
summary: "나중에 다시 읽을 수 있도록 생각을 정리합니다."
slug: "my-note"
draft: true
tags: ["프로그래밍", "기록"]
---

글의 내용을 작성합니다.

![그림을 설명하는 대체 텍스트](./diagram.png)
```

폴더명과 `slug`는 일치해야 하며, 글 주소는 `/posts/<slug>/`가 됩니다. 날짜는 따옴표로 감싼 실제 날짜를 사용합니다. 글을 공개할 준비가 되면 `draft: false`로 바꿉니다. 자세한 작성 규칙은 [개발 안내](docs/DEVELOPMENT.md#글과-이미지)에 있습니다.

초안은 공개 빌드의 목록·상세·검색·RSS·사이트맵에서 제외됩니다. 다만 이 저장소는 공개되어 있으므로, 커밋·push한 초안의 원본까지 비공개가 되는 것은 아닙니다.

## 빌드와 정적 미리보기

```sh
npm test
npm run build
npm run preview -- --port 4322
```

[http://127.0.0.1:4322/](http://127.0.0.1:4322/)에서 게시할 결과물을 확인합니다. `build`는 콘텐츠 검증, Astro 빌드, 검색 인덱스 생성, 링크·자산·RSS·사이트맵 검증을 순서대로 실행합니다.

검색은 공개 글의 제목·요약·본문을 대상으로 합니다. 한국어 단어 분리와 C++·C# 같은 기호를 지원하지만, 조사·어미 변형이나 여러 단어의 정확한 문구 일치를 보장하지는 않습니다.

## GitHub Pages에 게시하기

변경을 검토하고 `main`에 커밋·push한 다음, GitHub Actions의 **Prepare or deploy Pages** 워크플로를 `publish: true`로 수동 실행합니다. push만으로는 사이트가 바뀌지 않습니다.

GitHub CLI를 사용하는 경우:

```sh
gh workflow run pages.yml --ref main -f publish=true
```

워크플로는 의존성 설치와 테스트, 최종 빌드를 거친 같은 결과물을 업로드하고 배포합니다. build와 deploy가 모두 성공한 뒤 공개 주소에서 글과 검색을 확인합니다.

상세 검증 명령, UTF-8 커밋 설정과 배포 확인 방법은 [개발 안내](docs/DEVELOPMENT.md)에 정리했습니다.
