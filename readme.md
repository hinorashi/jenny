# Jenny

Jenkins and Terraform playground

## Đồng bộ code repos

Tạo `code-repos.txt`, mỗi dòng là một URL SSH với dấu `=` cuối dòng
(cũng chấp nhận URL không có dấu `=`):

```text
git@github.com:your-org/service-a.git=
git@github.com:your-org/service-b.git=
```

Chạy từ thư mục muốn chứa các repo:

```sh
bash /home/runner/work/jenny/jenny/sync-code-repos.sh
# Hoặc chỉ định file danh sách:
bash /home/runner/work/jenny/jenny/sync-code-repos.sh /path/to/code-repos.txt
```

Script clone vào thư mục mang tên repo trong thư mục làm việc hiện tại;
nếu đã có checkout với cùng `origin`, script chạy `git pull --ff-only`
trên nhánh hiện tại để tránh tự tạo merge commit. Cần cài Git và cấu hình
SSH có quyền truy cập repo trước khi chạy.

Dòng trống, dòng bắt đầu bằng `#` và khoảng trắng đầu/cuối được bỏ qua.
Nếu thư mục đã tồn tại nhưng không phải Git checkout hoặc có `origin` khác,
script báo lỗi và bỏ qua, không ghi đè. Khi một repo lỗi, script tiếp tục
xử lý các repo còn lại và trả mã thoát khác 0. Các repo trùng tên nên được
đồng bộ trong các thư mục làm việc riêng.

## Skills

terraform:
```sh
# tu pick skill nhe 16/20
npx skills add hashicorp/agent-skills --agent github-copilot -s

# hoac chi dinh luon 16 skill
npx skills add hashicorp/agent-skills --agent github-copilot -s azure-verified-modules new-terraform-provider provider-actions provider-configuration provider-docs provider-ephemeral-resources provider-framework-migration provider-resources provider-test-patterns refactor-module run-acceptance-tests terraform-policy terraform-search-import terraform-stacks terraform-style-guide terraform-test -y
```

jenkins:
```sh
npx skills add https://github.com/bagelhole/devops-security-agent-skills --skill jenkins --agent github-copilot -y
```

