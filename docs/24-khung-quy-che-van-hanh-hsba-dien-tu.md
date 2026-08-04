---
aliases:
  - Khung quy chế vận hành hồ sơ bệnh án điện tử
artifact_type: operational-policy-framework
status: DRAFT
---
# Khung quy chế vận hành hồ sơ bệnh án điện tử

<!-- obsidian-nav:start -->
[[23-ma-tran-yeu-cau-tt13-2025|Phần trước]] · [[docs|Mục lục]]
<!-- obsidian-nav:end -->

> [!CAUTION]
> Đây là **khung soạn thảo**, không phải quy chế đã được cơ sở khám bệnh, chữa bệnh ban hành. Chỉ có hiệu lực sau khi người có thẩm quyền phê duyệt, ghi số văn bản, ngày hiệu lực, phạm vi áp dụng và có bằng chứng phổ biến/đào tạo.

## 1. Thông tin kiểm soát văn bản

| Trường | Giá trị phải điền khi ban hành |
|---|---|
| Cơ sở áp dụng | `TBD` |
| Số quyết định/quy chế | `TBD` |
| Người phê duyệt | `TBD` |
| Ngày ký/ngày hiệu lực | `TBD` |
| Phạm vi khoa/phòng/hình thức điều trị | `TBD` |
| Owner nội dung | Clinical Records + Security + Legal |
| Chu kỳ rà soát | `TBD` |
| Phiên bản/thay thế văn bản | `TBD` |

Mọi `TBD` là production blocker. Không đổi `status: DRAFT` trước khi đủ bảng trên và có bản ký.

## 2. Mục đích, phạm vi và căn cứ

Quy chế cần quy định việc lập, cập nhật, quản lý, lưu trữ, sử dụng và an toàn thông tin đối với HSBA điện tử; bao gồm ký/xác nhận theo Điều 3 TT13/2025/TT-BYT.

Căn cứ tối thiểu cần Legal Owner kiểm tra trước ban hành:

- Luật Khám bệnh, chữa bệnh năm 2023.
- TT13/2025/TT-BYT.
- Chương X TT32/2023/TT-BYT và các mẫu/phụ lục áp dụng.
- Luật Giao dịch điện tử và văn bản hướng dẫn.
- NĐ137/2024/NĐ-CP khi chuyển đổi giấy/thông điệp dữ liệu.
- Legal inventory của [[23-ma-tran-yeu-cau-tt13-2025#Legal inventory cần owner xác nhận|Điều 1.4]].

## 3. Vai trò và trách nhiệm

| Vai trò | Trách nhiệm tối thiểu |
|---|---|
| Thủ trưởng cơ sở | Phê duyệt phạm vi, phương thức ký/xác nhận, chuyển đổi hồ sơ giấy, go-live và quy chế |
| Clinical Records Manager | Quản lý cấu trúc hồ sơ, completeness, retention, truy xuất, chuyển đổi và chain of custody |
| Nhân viên y tế | Ghi chép, cập nhật, ký/xác nhận đúng phạm vi chuyên môn và thời điểm |
| Người bệnh/đại diện | Ký/xác nhận nội dung được workflow yêu cầu theo capacity đã xác minh |
| IAM/Security | Định danh, phân quyền, attestation verification, audit, incident response |
| Infrastructure/SRE | Hạ tầng, backup, restore, monitoring, continuity evidence |
| Compliance Reviewer | Duy trì matrix, legal inventory, evidence và approval |
| QA/UAT Owner | Conformance, negative authorization, restore/retrieval và workflow tests |

Vai trò vận hành không tự nhận quyền xem/sửa/ký clinical content. Quyền cuối vẫn theo [[07-phan-quyen|authorization contract]].

## 4. Lập và cập nhật hồ sơ

1. Tạo hồ sơ đúng Patient đã định danh; suspected duplicate không auto-merge.
2. Chỉ ghi nội dung thuộc nhiệm vụ/quyền chuyên môn và context điều trị.
3. Mọi record giữ actor, role, thời điểm, source, Encounter/Visit/Episode phù hợp và correlation ID.
4. Field/mẫu bắt buộc theo mapping Chương X TT32 đã được Clinical/Legal duyệt.
5. Dữ liệu người bệnh khai báo được gắn source; không tự đổi thành clinically verified.
6. Hồ sơ thiếu nội dung bắt buộc phải có work queue, owner, SLA và audit; không silently complete.

## 5. Sửa, bổ sung và xử lý sai

- Draft được sửa theo quyền.
- Version đã ký/xác nhận không ghi đè.
- Amendment/correction tạo version mới, giữ previous version, reason, actor, timestamp và attestation mới khi cần.
- `ENTERED_IN_ERROR` không xóa lịch sử; cần reason, authorization và downstream notification khi dữ liệu đã được dùng/công bố.
- Không hard-delete clinical record, attestation, conversion evidence hoặc audit event.

## 6. Ký và xác nhận điện tử

Quy chế ban hành phải có signer matrix theo từng content type/mẫu:

| Nội dung | Signer capacity | Thời điểm | Phương thức được duyệt | Verifier | Fallback | Evidence/retention |
|---|---|---|---|---|---|---|
| `TBD từ TT32 mapping` | `TBD` | `TBD` | `TBD` | `TBD` | `TBD` | `TBD` |

Nguyên tắc:

1. Chỉ dùng phương thức được cơ sở và Legal/Security Owner phê duyệt: chữ ký điện tử hợp pháp, kỹ thuật sinh trắc học, hoặc hình thức khác phù hợp khoản 4 Điều 22 Luật Giao dịch điện tử.
2. Domain state `SIGNED` không tự chứng minh giá trị pháp lý. Target version phải có `ElectronicAttestation` hợp lệ theo [[adr/0008-ranh-gioi-tuan-thu-ky-xac-nhan-va-dinh-danh-dien-tu|ADR-0008]].
3. Attestation nhắm đúng target version và digest; lưu signer capacity, method, validation outcome, time và provider/verifier reference.
4. Không lưu private key, OTP secret, raw biometric sample/template trong clinical payload hoặc audit.
5. Provider/verifier outage, revoked credential, mismatch hoặc failed biometric không được tự hạ cấp sang phương thức yếu hơn. Dùng fallback đã phê duyệt hoặc giữ record chưa ký.
6. Sign và publish là hai hành vi tách biệt, có quyền và audit riêng.

## 7. Phân quyền, delegated access và break-glass

- Default deny; permission + effective role + Department + relationship + time + resource state.
- Người đại diện phải có relationship/capacity/scope còn hiệu lực tại thời điểm ký/xác nhận.
- Revoke có hiệu lực với request mới; xử lý session/cache theo policy.
- Break-glass cần requester, grantor/policy mechanism, Patient scope, purpose, reason, TTL, alert, reviewer, outcome và review deadline.
- Break-glass không cấp quyền financial/admin và không thay signer capacity.

## 8. Lưu trữ, backup và phục hồi

Quy chế phải khóa:

- retention theo loại record/evidence/audit;
- backup frequency, encrypted storage, copy separation/immutability và access;
- RPO/RTO target được owner phê duyệt;
- lịch restore drill và người chịu trách nhiệm;
- logical-integrity checks sau restore: version chain, digest/attestation, attachment checksum, Patient/Visit/Encounter invariants;
- evidence: bắt đầu/kết thúc, recovered point, missing/corrupt records, sample retrieval, exception và corrective action.

Backup thành công không đồng nghĩa phục hồi đạt. Production yêu cầu restore drill có bằng chứng.

## 9. Truy xuất, khai thác và xuất dữ liệu

Mỗi yêu cầu truy xuất phải ghi purpose of use: điều trị, kiểm tra, thanh tra, nghiên cứu khoa học hoặc quản lý y tế.

- Xác minh người yêu cầu, thẩm quyền, phạm vi, Patient/cohort, thời gian và approval.
- Tối thiểu hóa dữ liệu; de-identify/pseudonymize cho nghiên cứu khi phù hợp.
- Export có manifest, version, checksum, generated time, requester/approver và audit download.
- Kênh giao nhận bảo mật; expiry/revoke cho download token.
- Retrieval drill đo thời gian, completeness, authorization và integrity.
- Từ chối yêu cầu thiếu purpose/thẩm quyền; không dùng break-glass để vượt quy trình nghiên cứu/thanh tra.

## 10. Chuyển tiếp hồ sơ giấy đang điều trị

Theo Điều 5.1 TT13:

1. Đợt điều trị bắt đầu trước 21/07/2025 đang dùng hồ sơ giấy có thể tiếp tục đến ra viện/kết thúc đợt ngoại trú.
2. Chỉ chuyển sang điện tử khi cơ sở có khả năng và quyết định/quy trình phù hợp.
3. Không tạo hai nguồn clinical truth song song không có cutover marker.
4. Cutover record phải có Patient/episode, mốc thời gian, phạm vi trang/nội dung, người thực hiện/kiểm tra, checksum và exception.
5. Team điều trị phải biết nguồn canonical tại mọi thời điểm.

## 11. Chuyển đổi hồ sơ giấy cũ

Theo Điều 5.2 TT13 và NĐ137/2024/NĐ-CP:

- Chỉ thực hiện theo quyết định của Thủ trưởng cơ sở.
- Mỗi batch có quyết định, phạm vi, custodian, thời gian và trạng thái.
- Mỗi item có legacy identifier, Patient match, page count, storage reference, checksum, operator/reviewer và reconciliation outcome.
- Scan thiếu trang, mờ, sai Patient, checksum mismatch hoặc malware phải quarantine và xử lý ngoại lệ.
- Giữ chain of custody và liên kết tới bản giấy theo retention policy.
- Chuyển đổi không tự cho phép tiêu hủy bản giấy.

## 12. An toàn thông tin và sự cố

- Access control, encryption, secret/key management, endpoint/network/storage controls và monitoring theo inventory của cơ sở.
- Phân loại sự cố: unauthorized access, data leak, tampering, attestation failure, identity mismatch, unavailable/corrupt record, backup/restore failure.
- Runbook ghi containment, clinical continuity, evidence preservation, notification/escalation, recovery và post-incident review.
- Log redaction; audit không chứa raw secret/biometric/full clinical payload không cần thiết.

## 13. Đào tạo, kiểm tra và quản lý phiên bản

- Đào tạo theo vai trò trước cấp quyền; lưu attendance/acknowledgement/version.
- UAT theo signer/content matrix, paper transition, downtime, restore và retrieval.
- Rà quy chế định kỳ và khi pháp luật/workflow/provider thay đổi.
- Thay đổi phương thức ký, retention, signer matrix hoặc conversion policy cần Legal/Clinical/Security review.
- Version cũ giữ để truy nguyên; ngày hiệu lực/cutover rõ.

## 14. Checklist ban hành

- [ ] Cơ sở và phạm vi áp dụng đã xác định.
- [ ] Chương X TT32 đã mapping đầy đủ.
- [ ] Signer/content/method matrix đã phê duyệt.
- [ ] Định danh cá nhân/electronic identity workflow đã phê duyệt.
- [ ] Retention và legal inventory đã phê duyệt.
- [ ] Hạ tầng, backup, security inventory có bằng chứng.
- [ ] Restore/retrieval drills đạt target.
- [ ] Paper transition/conversion SOP và biểu mẫu đã duyệt.
- [ ] Incident/downtime runbook đã diễn tập.
- [ ] Số văn bản, người ký, ngày hiệu lực và owner đã điền.
- [ ] Nhân sự đã đào tạo; acknowledgement lưu được.
- [ ] [[23-ma-tran-yeu-cau-tt13-2025|Matrix]] không còn production blocker cho phạm vi go-live.

---

<!-- related-links:start -->
## Liên kết liên quan

- [[23-ma-tran-yeu-cau-tt13-2025|Ma trận TT13]]
- [[06-ho-so-suc-khoe-va-kham|Hồ sơ]]
- [[07-phan-quyen|Quyền và audit]]
- [[12-yeu-cau-phi-chuc-nang|Hạ tầng/recovery]]
- [[13-ke-hoach-va-nghiem-thu-mvp|Nghiệm thu]]
<!-- related-links:end -->
