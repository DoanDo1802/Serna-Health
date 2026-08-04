---
aliases:
  - Ma trận yêu cầu Thông tư 13/2025/TT-BYT
  - TT13 compliance matrix
artifact_type: regulatory-requirement-matrix
status: DRAFT
source_sections:
  - TT13/2025/TT-BYT
---
# Ma trận yêu cầu Thông tư 13/2025/TT-BYT

<!-- obsidian-nav:start -->
[[22-backlog-mvp|Phần trước]] · [[docs|Mục lục]] · [[24-khung-quy-che-van-hanh-hsba-dien-tu|Phần tiếp theo]]
<!-- obsidian-nav:end -->

> [!IMPORTANT]
> Ma trận này truy nguyên **thiết kế hướng tới đáp ứng**, không chứng nhận MediCore hoặc cơ sở khám bệnh, chữa bệnh đã tuân thủ. `VERIFIED` chỉ được dùng khi có triển khai, kiểm thử, bằng chứng vận hành và owner có thẩm quyền xác nhận.

## 1. Baseline và nguồn

- Văn bản: Thông tư 13/2025/TT-BYT, **Hướng dẫn triển khai hồ sơ bệnh án điện tử**, ban hành 06/06/2025, hiệu lực 21/07/2025.
- Cấu trúc: 6 Điều, không có phụ lục trong bản ký bốn trang.
- Nguồn xác nhận: [Bộ Y tế](https://moh.gov.vn/thong-tin-chi-dao-dieu-hanh/-/asset_publisher/DOHhlnDN87WZ/content/huong-dan-moi-nhat-trien-khai-ho-so-benh-an-ien-tu), [Thư Viện Pháp Luật](https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Thong-tu-13-2025-TT-BYT-huong-dan-trien-khai-ho-so-benh-an-dien-tu-660113.aspx), [LuatVietnam](https://luatvietnam.vn/y-te/thong-tu-13-2025-tt-byt-huong-dan-trien-khai-ho-so-benh-an-dien-tu-tu-bo-y-te-402396-d1.html), [Báo Điện tử Chính phủ](https://baochinhphu.vn/huong-dan-moi-nhat-trien-khai-ho-so-benh-an-dien-tu-102250610172135659.htm).
- Bản scan đối chiếu: [Bệnh viện Đa khoa Bạc Liêu](https://bvdkbaclieu.gov.vn/upload/1000079/20250625/574_Thong_tu-13-2025-TT-BYT_939faa4c81.pdf), SHA-256 `5b26d75016f71dc5837a346ad37377e4da937d799e7c3ab6e9c980d31d5c4363`.
- Chưa phát hiện bản ghi riêng trên hệ thống văn bản Chính phủ/Công báo tại thời điểm rà soát 31/07/2026. Không suy ra văn bản hết hiệu lực từ việc thiếu bản ghi.

### Trạng thái

| Trạng thái | Ý nghĩa |
|---|---|
| `NOT_ASSESSED` | Chưa có nguồn/đánh giá đủ tin cậy |
| `GAP` | Chưa có thiết kế đáp ứng |
| `PARTIAL` | Có một phần thiết kế |
| `DOCUMENTED_DESIGN` | Contract tài liệu đã mô tả, chưa có bằng chứng triển khai |
| `EVIDENCE_PENDING` | Có triển khai nhưng chưa đủ bằng chứng/phê duyệt |
| `VERIFIED` | Đủ bằng chứng và owner có thẩm quyền xác nhận |
| `NOT_APPLICABLE_APPROVED` | Không áp dụng, có lý do/người duyệt/ngày duyệt |

`NOT_APPLICABLE` không có phê duyệt không phải trạng thái hợp lệ. Các row chặn production không được `VERIFIED` chỉ bằng link tới Markdown.

## 2. Ma trận Điều 1 — nguyên tắc quản lý, triển khai

| Requirement ID | Nguồn | Nghĩa vụ | Applicability | Thiết kế/contract | Bằng chứng cần có | Owner | Trạng thái | Gap/Gate |
|---|---|---|---|---|---|---|---|---|
| `TT13-1.1-LIFECYCLE` | Điều 1.1 | HSBA được lập, cập nhật, hiển thị, ký, lưu trữ, quản lý, sử dụng và khai thác bằng phương tiện điện tử | APPLICABLE | [[06-ho-so-suc-khoe-va-kham|Hồ sơ]], [[11-mo-hinh-du-lieu|ERD]], [[21-schema-vat-ly-mvp|Schema]] | E2E từng hành vi, authorization, audit, retention, restore/retrieval | Clinical + Records | PARTIAL | Release 1 chỉ bao phủ Note/Diagnosis tối thiểu; chặn tuyên bố HSBA đầy đủ |
| `TT13-1.2-TT32-X` | Điều 1.2 | Đầy đủ thông tin theo Chương X TT32/2023/TT-BYT | APPLICABLE | Sub-matrix mục 9 | Bản chính thức Chương X; mapping trường/mẫu → UI/API/schema/test | Legal + Clinical Records | NOT_ASSESSED | **Production blocker**; không suy diễn từ mô hình hiện tại |
| `TT13-1.3-PERSONAL-ID` | Điều 1.3 | Kết nối thông tin HSBA với số định danh cá nhân của công dân Việt Nam và người nước ngoài đã có tài khoản định danh điện tử | APPLICABLE | MVP thu thập `PatientIdentifier` ở trạng thái `SELF_DECLARED`/`STAFF_RECORDED`/`MANUALLY_VERIFIED`; `ElectronicIdentityLink` chỉ kích hoạt khi có provider được duyệt; [[adr/0008-ranh-gioi-tuan-thu-ky-xac-nhan-va-dinh-danh-dien-tu|ADR-0008]] | R1 evidence cho thu thập/bảo vệ định danh; production evidence cần adapter/source được duyệt, match/revoke tests, DPIA, access audit | Identity + Legal | PARTIAL | R1 được code phần chuẩn bị dữ liệu; TT13 Điều 1.3 vẫn chặn production claim đến khi có kết nối điện tử |
| `TT13-1.4-LEGAL` | Điều 1.4 | Tuân thủ các nhóm pháp luật liên quan | APPLICABLE | Legal inventory bên dưới | Danh mục văn bản hiện hành, applicability và legal sign-off | Legal/Compliance | GAP | Không được gom thành một checkbox |

### Legal inventory cần owner xác nhận

Mỗi nhóm sau phải có inventory/version/applicability/evidence riêng: khám bệnh, chữa bệnh; dữ liệu; CNTT; giao dịch điện tử; an toàn thông tin mạng; an ninh mạng; tiếp cận thông tin; bảo vệ dữ liệu cá nhân; lưu trữ dữ liệu; quản lý, kết nối và chia sẻ dữ liệu điện tử của cơ quan nhà nước. Việc dẫn tên nhóm tại đây chưa chứng minh đáp ứng.

## 3. Ma trận Điều 2 — công nghệ thông tin

| Requirement ID | Nguồn | Nghĩa vụ | Applicability | Thiết kế/contract | Bằng chứng cần có | Owner | Trạng thái | Gap/Gate |
|---|---|---|---|---|---|---|---|---|
| `TT13-2.1-WORKSTATION` | Điều 2.1 | Có máy trạm | APPLICABLE | [[12-yeu-cau-phi-chuc-nang#18.3. Sẵn sàng, hạ tầng và khôi phục|NFR]] | Inventory theo cơ sở, hardening, lifecycle | Infrastructure | GAP | Deployment gate |
| `TT13-2.1-NETWORK` | Điều 2.1 | Có hạ tầng kết nối mạng | APPLICABLE | NFR/deployment baseline | Topology, segmentation, redundancy, monitoring | Infrastructure + Security | PARTIAL | Evidence pending |
| `TT13-2.1-SERVER` | Điều 2.1 | Có máy chủ | APPLICABLE | [[20-so-quyet-dinh-kien-truc|Deployment]] | Compute inventory/capacity/HA theo cơ sở | Infrastructure | PARTIAL | Cloud diagram không thay inventory |
| `TT13-2.1-STORAGE` | Điều 2.1 | Có lưu trữ dữ liệu, gồm lưu trữ dự phòng | APPLICABLE | PostgreSQL, object storage, PITR | Backup policy, encrypted copies, restore drill | SRE + Records | PARTIAL | Chặn production đến restore evidence |
| `TT13-2.1-SECURITY` | Điều 2.1 | Có thiết bị/giải pháp bảo mật thông tin | APPLICABLE | [[07-phan-quyen|RBAC]], [[12-yeu-cau-phi-chuc-nang|Security NFR]] | Control inventory, config evidence, security tests, incident runbook | Security | PARTIAL | Product controls chưa đủ deployment controls |
| `TT13-2.2-APPLICATIONS` | Điều 2.2 | Có ứng dụng CNTT quản lý KCB để triển khai HSBA | APPLICABLE | MediCore module map | Deployed capability inventory và UAT | Product + Clinical | DOCUMENTED_DESIGN | Chưa có code/deployment evidence |
| `TT13-2.3-TECH-STANDARDS` | Điều 2.3 | Đáp ứng tiêu chuẩn kỹ thuật CNTT trong cơ quan nhà nước | PENDING_CLASSIFICATION | NFR catalog placeholder | Legal/Architecture xác định tiêu chuẩn áp dụng và conformance evidence | Architecture + Legal | NOT_ASSESSED | `REG-02` blocker |
| `TT13-2.4-RECOVERY` | Điều 2.4 | Sẵn sàng phục hồi thông tin, dữ liệu | APPLICABLE | RPO/RTO target, backup/restore contract | Restore drill, recovered point, integrity sample, owner sign-off | SRE + Records | DOCUMENTED_DESIGN | Target không đồng nghĩa đã đạt |
| `TT13-2.4-RETRIEVAL` | Điều 2.4 | Truy xuất khi cần cho điều trị, kiểm tra, thanh tra, nghiên cứu khoa học và quản lý y tế | APPLICABLE | Record retrieval/export contract | Purpose/approval tests, timed drill, export audit, de-identification where applicable | Records + Security | PARTIAL | Chặn production đến drill/evidence |

## 4. Ma trận Điều 3 — ký, xác nhận điện tử

| Requirement ID | Nguồn | Nghĩa vụ | Applicability | Thiết kế/contract | Bằng chứng cần có | Owner | Trạng thái | Gap/Gate |
|---|---|---|---|---|---|---|---|---|
| `TT13-3-SUBJECT` | Đoạn dẫn Điều 3 | NVYT, người bệnh hoặc đại diện ký/xác nhận nội dung liên quan | APPLICABLE | Signer capacity + `ElectronicAttestation` | Workflow mapping theo content type; authorization; representative validity | Clinical + Legal | DOCUMENTED_DESIGN | Mapping TT32 còn thiếu |
| `TT13-3.1-E-SIGNATURE` | Điều 3.1 | Cho phép chữ ký điện tử hợp pháp | APPLICABLE khi cơ sở chọn | ADR-0008 external verification port | Provider/credential contract, validation/revocation/timestamp tests | Legal + Security | GAP | `SIGN-01` OPEN |
| `TT13-3.2-BIOMETRIC` | Điều 3.2 | Cho phép kỹ thuật sinh trắc học | APPLICABLE khi cơ sở chọn | ADR-0008 method class | DPIA, liveness/match policy, fallback, evidence; không lưu raw biometric | Privacy + Security | GAP | Không mặc định chọn |
| `TT13-3.3-OTHER` | Điều 3.3 | Hình thức điện tử khác theo khoản 4 Điều 22 Luật Giao dịch điện tử | APPLICABLE khi được duyệt | ADR-0008 method class | Legal opinion, internal policy, verification/replay tests | Legal | GAP | Application attestation chưa được coi hợp pháp |
| `TT13-3-DIGEST` | DESIGN | Attestation nhắm đúng immutable version/digest | DESIGN | ADR-0008 + schema | Tamper tests, digest verification, timestamp/correlation evidence | Architecture + Security | DOCUMENTED_DESIGN | Control thiết kế, không tự gắn nhãn nghĩa vụ nguyên văn |

## 5. Ma trận Điều 4 — hiệu lực và lộ trình

| Requirement ID | Nguồn | Nghĩa vụ | Applicability | Thiết kế/contract | Bằng chứng cần có | Owner | Trạng thái | Gap/Gate |
|---|---|---|---|---|---|---|---|---|
| `TT13-4.1-EFFECTIVE` | Điều 4.1 | Hiệu lực từ 21/07/2025 | APPLICABLE | Baseline tài liệu | Legal source review | Legal | VERIFIED | Xác minh theo bản ký/bài Bộ Y tế |
| `TT13-4.2A-HOSPITAL` | Điều 4.2.a | Bệnh viện triển khai chậm nhất 30/09/2025 | PENDING_CLASSIFICATION | Scope boundary | Giấy phép/phân loại cơ sở; deployment approval | Facility Director + Legal | NOT_ASSESSED | Mốc đã qua; cần đánh giá cơ sở cụ thể |
| `TT13-4.2B-OTHER` | Điều 4.2.b | Cơ sở khác có nội trú, điều trị ban ngày và ngoại trú hoàn thành chậm nhất 31/12/2026 | PENDING_CLASSIFICATION | Scope boundary | Phân loại/phạm vi điều trị và deployment evidence | Facility Director + Legal | NOT_ASSESSED | Không tự chọn thay cơ sở |
| `TT13-4.3A-TT46` | Điều 4.3.a | TT46/2018/TT-BYT hết hiệu lực kể từ ngày TT13 được ban hành | APPLICABLE | Source baseline | Rà docs không dùng TT46 làm baseline hiện hành | Legal | VERIFIED | Có thể giữ làm lịch sử, phải ghi hết hiệu lực |
| `TT13-4.3B-TT54` | Điều 4.3.b | Mục VIII Phụ lục I và tiêu chí BAĐT liên quan của TT54/2017 hết hiệu lực | APPLICABLE | Source baseline | Rà docs không dùng phần này làm baseline hiện hành | Legal | VERIFIED | Không diễn đạt toàn bộ TT54 hết hiệu lực |

## 6. Ma trận Điều 5 — chuyển tiếp

| Requirement ID | Nguồn | Nghĩa vụ | Applicability | Thiết kế/contract | Bằng chứng cần có | Owner | Trạng thái | Gap/Gate |
|---|---|---|---|---|---|---|---|---|
| `TT13-5.1-ACTIVE-PAPER` | Điều 5.1 | Hồ sơ giấy của đợt đang điều trị được tiếp tục đến ra viện/kết thúc ngoại trú, trừ khi cơ sở chuyển được sang điện tử | APPLICABLE | [[24-khung-quy-che-van-hanh-hsba-dien-tu#10. Chuyển tiếp hồ sơ giấy đang điều trị|Khung quy chế]] | SOP, continuity test, quyết định chuyển, audit | Clinical Records | DOCUMENTED_DESIGN | Quy chế chưa ban hành |
| `TT13-5.2-CONVERSION` | Điều 5.2 | Thủ trưởng quyết định chuyển đổi hồ sơ giấy cũ theo điều kiện thực tế và NĐ137/2024/NĐ-CP | APPLICABLE khi chuyển đổi | Conversion batch/item schema | Quyết định, chain of custody, checksum, đối soát, exception report | Facility Director + Records | DOCUMENTED_DESIGN | Không tự động scan rồi hủy bản giấy |

## 7. Ma trận Điều 6 — tổ chức thực hiện

| Requirement ID | Nguồn | Nghĩa vụ | Applicability | Thiết kế/contract | Bằng chứng cần có | Owner | Trạng thái | Gap/Gate |
|---|---|---|---|---|---|---|---|---|
| `TT13-6.3A-DEPLOY` | Điều 6.3.a | Cơ sở tổ chức triển khai theo TT13 và hướng dẫn có thẩm quyền | APPLICABLE | Backlog + matrix | Deployment plan, UAT, go-live approval, evidence index | Facility Director | GAP | Product docs không thay kế hoạch cơ sở |
| `TT13-6.3B-POLICY` | Điều 6.3.b | Xây dựng, ban hành quy chế lập, cập nhật, quản lý, lưu trữ, sử dụng và ATTT, gồm Điều 3 | APPLICABLE | [[24-khung-quy-che-van-hanh-hsba-dien-tu|Khung quy chế]] | Quyết định ban hành, số/ngày hiệu lực, training acknowledgement, review log | Facility Director + Records + Security | DOCUMENTED_DESIGN | Khung `DRAFT`; **production blocker** |

## 8. Production blockers hiện tại

1. Chưa phân rã và phê duyệt Chương X TT32 (`TT13-1.2-TT32-X`).
2. Chưa phân loại cơ sở và lộ trình áp dụng (`REG-03`).
3. Chưa khóa phương thức/evidence ký, xác nhận (`SIGN-01`, ADR-0008 còn `PROPOSED`).
4. Chưa khóa adapter và quy trình định danh điện tử (`IDN-02`). Phần thu thập CCCD/hộ chiếu an toàn ở MVP không bị chặn.
5. Chưa có code, DDL, test, deployment inventory, restore/retrieval drill.
6. Khung quy chế chưa được cơ sở ban hành.
7. Chưa có legal inventory cho Điều 1.4 và tiêu chuẩn kỹ thuật Điều 2.3.

## 9. Sub-matrix Chương X TT32/2023/TT-BYT

> [!WARNING]
> TT13 Điều 1.2 dẫn chiếu toàn bộ thông tin theo Chương X TT32. Phiên rà soát này chưa thu được bản Chương X đầy đủ từ nguồn chính thức đủ để phân rã từng trường/mẫu. Vì vậy không gắn nhãn bắt buộc pháp lý cho Allergy, Diagnosis, Prescription, Observation hoặc tài liệu khác chỉ dựa trên thiết kế hiện tại.

| Requirement ID | Nguồn | Nội dung | Owner | Trạng thái | Gate |
|---|---|---|---|---|---|
| `TT32-X-SOURCE` | Chương X TT32/2023/TT-BYT | Lấy bản chính thức/đủ tin cậy, ghi phiên bản và tình trạng hiệu lực | Legal | NOT_ASSESSED | Chặn toàn bộ mapping bên dưới |
| `TT32-X-FORMS` | Chương X và phụ lục/mẫu được dẫn | Liệt kê loại hồ sơ/mẫu theo phạm vi cơ sở | Clinical Records | NOT_ASSESSED | Chặn clinical completeness |
| `TT32-X-FIELDS` | Từng Điều/khoản/mẫu | Ánh xạ trường bắt buộc → UI/API/entity/schema | Clinical + Product | NOT_ASSESSED | Chặn production |
| `TT32-X-SIGNERS` | Từng Điều/khoản/mẫu | Ánh xạ nội dung, signer capacity, thời điểm ký/xác nhận | Clinical + Legal | NOT_ASSESSED | Chặn `SIGN-01` |
| `TT32-X-TESTS` | Mapping đã duyệt | Conformance test và evidence cho từng requirement áp dụng | QA + Clinical | NOT_ASSESSED | Chặn production |

## 10. Traceability target

```text
Requirement
→ applicability + owner
→ Decision
→ ADR
→ domain document
→ logical ERD
→ physical schema
→ backlog story
→ acceptance/test
→ operational evidence
→ authorized approval
```

Không được bỏ qua `applicability`, `evidence` hoặc `approval` khi đổi trạng thái sang `VERIFIED`.

---

<!-- related-links:start -->
## Liên kết liên quan

- [[01-tong-quan-va-pham-vi|Ranh giới phạm vi]]
- [[12-yeu-cau-phi-chuc-nang|NFR và recovery]]
- [[13-ke-hoach-va-nghiem-thu-mvp|Nghiệm thu]]
- [[14-gia-dinh-cau-hoi-va-dinh-huong#22.2. Câu hỏi còn mở|Decision OPEN]]
- [[24-khung-quy-che-van-hanh-hsba-dien-tu|Khung quy chế]]
- [[adr/0008-ranh-gioi-tuan-thu-ky-xac-nhan-va-dinh-danh-dien-tu|ADR-0008]]
<!-- related-links:end -->
