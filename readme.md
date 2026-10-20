# Jenny

Jenkins and Terraform playground

## Skills

terraform:
```sh
# tu pick skill nhe 16/20
npx skills add hashicorp/agent-skills --agent github-copilot

# hoac chi dinh luon 16 skill
npx skills add hashicorp/agent-skills --agent github-copilot -s azure-verified-modules new-terraform-provider provider-actions provider-configuration provider-docs provider-ephemeral-resources provider-framework-migration provider-resources provider-test-patterns refactor-module run-acceptance-tests terraform-policy terraform-search-import terraform-stacks terraform-style-guide terraform-test -y
```

jenkins:
```sh
npx skills add https://github.com/bagelhole/devops-security-agent-skills --skill jenkins --agent github-copilot -y
```

## Đồng bộ code repos

Tạo `code-repos.txt`, mỗi dòng có cú pháp `repo-url` hoặc `repo-url=git-folder`:

```text
git@github.com:your-org/service-a.git
https://github.com/your-org/service-b.git=backend
ssh://git@github.com/your-org/service-c.git
git@github.com:another-org/service-a.git=another-service-a
```

- Hỗ trợ URL HTTPS, SSH dạng `ssh://...` và `git@host:path`.
- Chỉ có URL: tên thư mục mặc định là tên repo (bỏ đuôi `.git`).
- Có `=git-folder`: clone hoặc pull trong thư mục được chỉ định; hỗ trợ
  đường dẫn tương đối với `target-dir` hoặc đường dẫn tuyệt đối (không phụ
  thuộc `target-dir`).
- Có dấu `=` nhưng để trống phần thư mục: vẫn dùng tên repo mặc định.

Cú pháp: `bash sync-code-repos.sh [target-dir] [code-repos.txt]`.
Tham số thứ nhất là thư mục đích (mặc định `.`), tham số thứ hai là file
danh sách (mặc định `code-repos.txt`). Đường dẫn file danh sách tương đối
được tính từ thư mục làm việc hiện tại, không phải `target-dir`.

```sh
# Dùng thư mục hiện tại và file code-repos.txt mặc định:
bash /home/runner/work/jenny/jenny/sync-code-repos.sh
# Chỉ định thư mục đích, dùng file code-repos.txt mặc định:
bash /home/runner/work/jenny/jenny/sync-code-repos.sh /path/to/repos
# Chỉ định cả thư mục đích và file danh sách:
bash /home/runner/work/jenny/jenny/sync-code-repos.sh /path/to/repos /path/to/code-repos.txt
# Dùng thư mục hiện tại với file danh sách khác:
bash /home/runner/work/jenny/jenny/sync-code-repos.sh . /path/to/code-repos.txt

# hay dung
./sync-code-repos.sh ../odcx
```

Script tự tạo `target-dir` nếu chưa tồn tại. Nếu thư mục repo chưa tồn tại,
script clone repo về; nếu đã có checkout với cùng
`origin`, script chạy `git pull --ff-only` trên nhánh hiện tại để tránh tự
tạo merge commit; nhánh hiện tại phải được cấu hình theo dõi `origin`.
Cần cài Git và cấu hình quyền truy cập repo trước khi chạy: dùng SSH key
cho URL SSH hoặc Git credential helper/token cho repo HTTPS riêng tư.

Dòng trống, dòng bắt đầu bằng `#` và khoảng trắng đầu/cuối được bỏ qua.
Nếu thư mục đã tồn tại nhưng không phải Git checkout hoặc có `origin` khác,
script báo lỗi và bỏ qua, không ghi đè. Khi một repo lỗi, script tiếp tục
xử lý các repo còn lại và trả mã thoát khác 0. Với các repo trùng tên,
hãy chỉ định thư mục riêng bằng `=git-folder`.
