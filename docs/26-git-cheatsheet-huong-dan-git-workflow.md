---
aliases:
  - Hướng dẫn câu lệnh Git
  - Git Cheat Sheet MediCore
artifact_type: git-cheatsheet
status: ACCEPTED
---
# Sổ tay Hướng dẫn & Câu lệnh Git (MediCore Git Cheat Sheet)

Tài liệu này tổng hợp toàn bộ các câu lệnh Git chuẩn được sử dụng trong dự án **MediCore** theo đúng quy trình phân nhánh (Branching), Staging và Commit chuẩn Conventional Commits.

---

## 1. Quy tắc Đặt tên Nhánh & Luồng Làm việc (Branching Rules)

| Loại công việc | Cấu trúc tên nhánh | Ví dụ |
|---|---|---|
| Tính năng mới (Feature) | `feat/<ma-backlog>-<ten-ngan-gon>` | `feat/r1-02-authentication` |
| Sửa lỗi (Bugfix) | `fix/<ma-issue>-<ten-ngan-gon>` | `fix/r1-02-csrf-validation` |
| Tái cấu trúc (Refactor) | `refactor/<ten-chuc-nang>` | `refactor/backend-layered-architecture` |
| Tài liệu (Docs) | `docs/<ten-tai-lieu>` | `docs/update-architecture-adr` |

---

## 2. Danh mục Câu lệnh Git Thường dùng

### A. Kiểm tra Trạng thái & Lịch sử
```bash
# 1. Kiểm tra trạng thái các file thay đổi (staged, unstaged, untracked)
git status

# 2. Xem lịch sử commit ngắn gọn (10 commit gần nhất)
git log --oneline -n 10

# 3. Xem danh sách tất cả các nhánh (Local & Remote)
git branch -a

# 4. Xem chi tiết các thay đổi code chưa staged
git diff

# 5. Xem chi tiết các thay đổi code ĐÃ staged (chuẩn bị commit)
git diff --staged
```

### B. Tạo & Thao tác trên Nhánh (Branch Operations)
```bash
# 1. Cập nhật nhánh main mới nhất trước khi làm tính năng mới
git checkout main
git pull origin main

# 2. Tạo và chuyển sang nhánh tính năng mới
git checkout -b feat/r1-02-authentication

# 3. Chuyển đổi giữa các nhánh có sẵn
git checkout feat/r1-02-authentication

# 4. Xóa một nhánh local (sau khi đã gộp/merge)
git branch -d feat/r1-02-authentication

# 5. Ép xóa một nhánh local
git branch -D feat/r1-02-authentication
```

### C. Staging (`git add`) & Commit (`git commit`)
```bash
# 1. Add từng file cụ thể (Khuyên dùng để tránh add file rác)
git add backend/src/main/java/vn/medicore/controller/IdentityAccessController.java

# 2. Add toàn bộ một thư mục
git add backend/src/main/java/vn/medicore/common/

# 3. Bo add (Unstage) một file lỡ add nhầm
git restore --staged backend/target/

# 4. Commit code với thông điệp chuẩn Conventional Commits
git commit -m "feat(auth): implement session-based authentication & CSRF validation"

# 5. Sửa lại commit message gần nhất hoặc bổ sung file quên add (chưa push)
git commit --amend -m "feat(auth): implement session authentication and filter"
```

### D. Đồng bộ với Remote (Push & Pull)
```bash
# 1. Đẩy nhánh local mới tạo lên Remote lần đầu tiên
git push -u origin feat/r1-02-authentication

# 2. Đẩy các commit tiếp theo trên nhánh đã có trên Remote
git push

# 3. Đẩy đè an toàn sau khi git commit --amend trên nhánh tính năng cá nhân
git push --force-with-lease

# 4. Cập nhật code mới nhất từ origin/main về nhánh hiện tại bằng rebase
git fetch origin
git rebase origin/main
```

---

## 3. Quy chuẩn Message Commit (Conventional Commits)

Định dạng chuẩn:
```text
<type>(<scope>): <mô tả ngắn gọn bằng tiếng Anh/Việt>
```

### Các Type hợp lệ:
- `feat`: Tính năng mới cho người dùng hoặc hệ thống.
- `fix`: Sửa lỗi (Bug fix).
- `refactor`: Tái cấu trúc code (không làm thay đổi API response hay logic nghiệp vụ).
- `docs`: Thêm hoặc cập nhật tài liệu (`.md`).
- `test`: Thêm hoặc sửa Unit test, ArchUnit test, Integration test.
- `chore`: Cập nhật cấu hình build Maven, Docker, dependencies, scripts.

### Các mẫu Commit Message chuẩn trong MediCore:
```bash
git commit -m "feat(auth): implement OTP login flow"
git commit -m "fix(security): resolve CSRF header missing check"
git commit -m "refactor(backend): restructure backend code to 7-layer architecture"
git commit -m "docs(arch): add git cheatsheet and update architecture ADR"
git commit -m "test(arch): add ArchUnit LayeredArchitectureTest boundary rules"
```

---

## 4. Xử lý Tình huống Thường gặp (Troubleshooting)

### Tình huống 1: Hủy bỏ thay đổi chưa commit trên một file
```bash
# Khôi phục file về trạng thái commit gần nhất
git restore backend/src/main/java/vn/medicore/controller/IdentityAccessController.java
```

### Tình huống 2: Lưu tạm công việc đang dở để chuyển sang sửa bug khẩn cấp
```bash
# Lưu stash công việc dở dang
git stash

# Chuyển nhánh sửa bug...
git checkout fix/urgent-bug

# Sau khi xong, quay lại nhánh cũ và khôi phục code đang dở
git checkout feat/r1-02-authentication
git stash pop
```

### Tình huống 3: Bị cảnh báo "adding embedded git repository"
```bash
# Loại bỏ đường dẫn thư mục tạm khỏi git index mà không xóa file thật
git rm --cached -r .claude/worktrees/
```
