남촌축산백화점 GitHub Pages 홈페이지 (기존 Supabase 프로젝트용 수정본)

1. Supabase SQL Editor에서 supabase/migration-for-existing-project.sql 전체를 실행합니다.
2. js/config.js를 메모장으로 열고 Project URL, Publishable key를 입력합니다.
3. index.html, admin.html, css/, js/ 폴더를 GitHub Pages 저장소 루트에 업로드합니다.
4. https://사용자명.github.io/admin.html 에서 관리자 이메일과 비밀번호로 로그인합니다.
5. 상품, 매장 정보, 공지사항, 팝업을 편집합니다.

이미지 업로드는 기존 공개 버킷 product-images를 사용합니다.
주의: 비밀번호 및 secret/service_role 키는 config.js에 입력하지 마세요.
주의: 로컬 file:// 경로로 직접 열면 JS 모듈 실행이 제한될 수 있으니 GitHub Pages에서 테스트하세요.
