---
title:  "카테고리 에러 해결"
excerpt: "카테고리 링크 클릭시 에러 발생 및 그에 대한 해결"

categories:
  - Practice
tags:
  - [Practice, jekyll, Github, Git]

toc: true
toc_sticky: true
 
date: 2023-09-05
last_modified_at: 2023-09-05
---

# Category 클릭시 404 Not Found 에러가 발생함
<span style="font-size:17px;">github 블로그 만들기를 따라서 Category 부분을 적용했으나 404 Not Found 에러가 발생.  </span>
<span style="font-size:17px;">뭐 때문인지 파악하기 위해 이것저것 적용해보다가  </span>
<span style="font-size:17px;">bundle exec jekyll serve를 실행하니  </span>
<span style="font-size:17px;">Liquid Exception could not locate the included file 에러가 발생.  </span>
<span style="font-size:17px;">해당 파일이 없어서 문제였던 것.  </span>
<span style="font-size:17px;">해당 파일은 post__taxonomy.html이고 post__taxonomy를 page__taxonomy와 착각해서 일어난 이슈였음.  </span>
<span style="font-size:17px;">흔한 Human Error였다.  </span>
<span style="font-size:17px;">page__taxonomy를 원래대로 돌리고 post__taxonomy를 새로 생성하여 추가하니 문제 해결.  </span>
<span style="font-size:17px;">오늘의 교훈 : 파일명은 똑바로 읽자.  </span>