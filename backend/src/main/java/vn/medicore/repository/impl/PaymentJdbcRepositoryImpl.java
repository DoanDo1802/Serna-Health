package vn.medicore.repository.impl;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import vn.medicore.common.exception.StaleVersionException;
import vn.medicore.dto.PaymentModels.OutboxEventRow;
import vn.medicore.dto.PaymentModels.PaymentIntentRow;
import vn.medicore.dto.PaymentModels.PaymentRow;
import vn.medicore.dto.PaymentModels.WebhookInboxRow;
import vn.medicore.repository.PaymentRepository;

@Repository
public class PaymentJdbcRepositoryImpl implements PaymentRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public PaymentJdbcRepositoryImpl(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void insertPaymentIntent(PaymentIntentRow row) {
        jdbc.update("""
                insert into payment_intent (id, slot_hold_id, provider, provider_reference, amount,
                    currency, status, reconciliation_reason, version, created_at, updated_at)
                values (:id, :slotHoldId, :provider, :providerReference, :amount,
                    :currency, :status, :reconciliationReason, :version, :createdAt, :updatedAt)
                """, new MapSqlParameterSource()
                .addValue("id", row.id())
                .addValue("slotHoldId", row.slotHoldId())
                .addValue("provider", row.provider())
                .addValue("providerReference", row.providerReference())
                .addValue("amount", row.amount())
                .addValue("currency", row.currency())
                .addValue("status", row.status())
                .addValue("reconciliationReason", row.reconciliationReason())
                .addValue("version", row.version())
                .addValue("createdAt", ts(row.createdAt()))
                .addValue("updatedAt", ts(row.updatedAt())));
    }

    @Override
    public void updatePaymentIntent(PaymentIntentRow row, long expectedVersion) {
        int rows = jdbc.update("""
                update payment_intent set status = :status, reconciliation_reason = :reconciliationReason,
                    version = :version, updated_at = :updatedAt
                where id = :id and version = :expectedVersion
                """, new MapSqlParameterSource()
                .addValue("id", row.id())
                .addValue("status", row.status())
                .addValue("reconciliationReason", row.reconciliationReason())
                .addValue("version", row.version())
                .addValue("updatedAt", ts(row.updatedAt()))
                .addValue("expectedVersion", expectedVersion));
        if (rows == 0) throw new StaleVersionException();
    }

    @Override
    public Optional<PaymentIntentRow> paymentIntentById(UUID id) {
        return queryOne("select * from payment_intent where id = :id", new MapSqlParameterSource("id", id), this::mapPaymentIntent);
    }

    @Override
    public Optional<PaymentIntentRow> paymentIntentByIdForUpdate(UUID id) {
        return queryOne("select * from payment_intent where id = :id for update", new MapSqlParameterSource("id", id), this::mapPaymentIntent);
    }

    @Override
    public Optional<PaymentIntentRow> paymentIntentBySlotHoldId(UUID slotHoldId) {
        return queryOne("select * from payment_intent where slot_hold_id = :slotHoldId", new MapSqlParameterSource("slotHoldId", slotHoldId), this::mapPaymentIntent);
    }

    @Override
    public Optional<PaymentIntentRow> paymentIntentByProviderReferenceForUpdate(String provider, String providerReference) {
        return queryOne("""
                select * from payment_intent
                where provider = :provider and provider_reference = :providerReference
                for update
                """, new MapSqlParameterSource("provider", provider).addValue("providerReference", providerReference), this::mapPaymentIntent);
    }

    @Override
    public boolean insertWebhookInboxAtomic(WebhookInboxRow row) {
        int rows = jdbc.update("""
                insert into webhook_inbox (id, provider, event_id, event_type, provider_transaction_id,
                    signature_status, payload_hash, raw_payload, payload, provider_occurred_at, received_at,
                    provider_time_trust, amount, currency, status, processed_at, error_code,
                    attempts, next_attempt_at, correlation_id, version)
                values (:id, :provider, :eventId, :eventType, :providerTransactionId,
                    :signatureStatus, :payloadHash, :rawPayload, cast(:payload as jsonb), :providerOccurredAt, :receivedAt,
                    :providerTimeTrust, :amount, :currency, :status, :processedAt, :errorCode,
                    :attempts, :nextAttemptAt, :correlationId, :version)
                on conflict (provider, event_id) do nothing
                """, new MapSqlParameterSource()
                .addValue("id", row.id())
                .addValue("provider", row.provider())
                .addValue("eventId", row.eventId())
                .addValue("eventType", row.eventType())
                .addValue("providerTransactionId", row.providerTransactionId())
                .addValue("signatureStatus", row.signatureStatus())
                .addValue("payloadHash", row.payloadHash())
                .addValue("rawPayload", row.rawPayload())
                .addValue("payload", row.payload())
                .addValue("providerOccurredAt", ts(row.providerOccurredAt()))
                .addValue("receivedAt", ts(row.receivedAt()))
                .addValue("providerTimeTrust", row.providerTimeTrust())
                .addValue("amount", row.amount())
                .addValue("currency", row.currency())
                .addValue("status", row.status())
                .addValue("processedAt", ts(row.processedAt()))
                .addValue("errorCode", row.errorCode())
                .addValue("attempts", row.attempts())
                .addValue("nextAttemptAt", ts(row.nextAttemptAt()))
                .addValue("correlationId", row.correlationId())
                .addValue("version", row.version()));
        return rows > 0;
    }

    @Override
    public void insertWebhookInbox(WebhookInboxRow row) {
        jdbc.update("""
                insert into webhook_inbox (id, provider, event_id, event_type, provider_transaction_id,
                    signature_status, payload_hash, raw_payload, payload, provider_occurred_at, received_at,
                    provider_time_trust, amount, currency, status, processed_at, error_code,
                    attempts, next_attempt_at, correlation_id, version)
                values (:id, :provider, :eventId, :eventType, :providerTransactionId,
                    :signatureStatus, :payloadHash, :rawPayload, cast(:payload as jsonb), :providerOccurredAt, :receivedAt,
                    :providerTimeTrust, :amount, :currency, :status, :processedAt, :errorCode,
                    :attempts, :nextAttemptAt, :correlationId, :version)
                """, new MapSqlParameterSource()
                .addValue("id", row.id())
                .addValue("provider", row.provider())
                .addValue("eventId", row.eventId())
                .addValue("eventType", row.eventType())
                .addValue("providerTransactionId", row.providerTransactionId())
                .addValue("signatureStatus", row.signatureStatus())
                .addValue("payloadHash", row.payloadHash())
                .addValue("rawPayload", row.rawPayload())
                .addValue("payload", row.payload())
                .addValue("providerOccurredAt", ts(row.providerOccurredAt()))
                .addValue("receivedAt", ts(row.receivedAt()))
                .addValue("providerTimeTrust", row.providerTimeTrust())
                .addValue("amount", row.amount())
                .addValue("currency", row.currency())
                .addValue("status", row.status())
                .addValue("processedAt", ts(row.processedAt()))
                .addValue("errorCode", row.errorCode())
                .addValue("attempts", row.attempts())
                .addValue("nextAttemptAt", ts(row.nextAttemptAt()))
                .addValue("correlationId", row.correlationId())
                .addValue("version", row.version()));
    }

    @Override
    public void updateWebhookInbox(WebhookInboxRow row, long expectedVersion) {
        int rows = jdbc.update("""
                update webhook_inbox set status = :status, processed_at = :processedAt, error_code = :errorCode,
                    attempts = :attempts, next_attempt_at = :nextAttemptAt, version = :version
                where id = :id and version = :expectedVersion
                """, new MapSqlParameterSource()
                .addValue("id", row.id())
                .addValue("status", row.status())
                .addValue("processedAt", ts(row.processedAt()))
                .addValue("errorCode", row.errorCode())
                .addValue("attempts", row.attempts())
                .addValue("nextAttemptAt", ts(row.nextAttemptAt()))
                .addValue("version", row.version())
                .addValue("expectedVersion", expectedVersion));
        if (rows == 0) throw new StaleVersionException();
    }

    @Override
    public Optional<WebhookInboxRow> webhookInboxByProviderAndEventId(String provider, String eventId) {
        return queryOne("""
                select * from webhook_inbox
                where provider = :provider and event_id = :eventId
                """, new MapSqlParameterSource("provider", provider).addValue("eventId", eventId), this::mapWebhookInbox);
    }

    @Override
    public void insertPayment(PaymentRow row) {
        jdbc.update("""
                insert into payment (id, payment_intent_id, provider, provider_transaction_id, amount,
                    currency, status, provider_occurred_at, provider_time_trust, webhook_inbox_id, captured_at, created_at)
                values (:id, :paymentIntentId, :provider, :providerTransactionId, :amount,
                    :currency, :status, :providerOccurredAt, :providerTimeTrust, :webhookInboxId, :capturedAt, :createdAt)
                """, new MapSqlParameterSource()
                .addValue("id", row.id())
                .addValue("paymentIntentId", row.paymentIntentId())
                .addValue("provider", row.provider())
                .addValue("providerTransactionId", row.providerTransactionId())
                .addValue("amount", row.amount())
                .addValue("currency", row.currency())
                .addValue("status", row.status())
                .addValue("providerOccurredAt", ts(row.providerOccurredAt()))
                .addValue("providerTimeTrust", row.providerTimeTrust())
                .addValue("webhookInboxId", row.webhookInboxId())
                .addValue("capturedAt", ts(row.capturedAt()))
                .addValue("createdAt", ts(row.createdAt())));
    }

    @Override
    public Optional<PaymentRow> paymentById(UUID id) {
        return queryOne("select * from payment where id = :id", new MapSqlParameterSource("id", id), this::mapPayment);
    }

    @Override
    public Optional<PaymentRow> paymentByIntentId(UUID paymentIntentId) {
        return queryOne("select * from payment where payment_intent_id = :intentId", new MapSqlParameterSource("intentId", paymentIntentId), this::mapPayment);
    }

    @Override
    public Optional<PaymentRow> paymentByProviderTransactionId(String provider, String providerTransactionId) {
        return queryOne("""
                select * from payment
                where provider = :provider and provider_transaction_id = :providerTransactionId
                """, new MapSqlParameterSource("provider", provider).addValue("providerTransactionId", providerTransactionId), this::mapPayment);
    }

    @Override
    public void insertOutboxEvent(OutboxEventRow row) {
        jdbc.update("""
                insert into outbox_event (id, aggregate_type, aggregate_id, event_type,
                    payload_schema_version, payload, occurred_at, published_at, attempts, status,
                    next_attempt_at, error_code, correlation_id, version)
                values (:id, :aggregateType, :aggregateId, :eventType,
                    :payloadSchemaVersion, cast(:payload as jsonb), :occurredAt, :publishedAt, :attempts, :status,
                    :nextAttemptAt, :errorCode, :correlationId, :version)
                """, new MapSqlParameterSource()
                .addValue("id", row.id())
                .addValue("aggregateType", row.aggregateType())
                .addValue("aggregateId", row.aggregateId())
                .addValue("eventType", row.eventType())
                .addValue("payloadSchemaVersion", row.payloadSchemaVersion())
                .addValue("payload", row.payload())
                .addValue("occurredAt", ts(row.occurredAt()))
                .addValue("publishedAt", ts(row.publishedAt()))
                .addValue("attempts", row.attempts())
                .addValue("status", row.status())
                .addValue("nextAttemptAt", ts(row.nextAttemptAt()))
                .addValue("errorCode", row.errorCode())
                .addValue("correlationId", row.correlationId())
                .addValue("version", row.version()));
    }

    @Override
    public Optional<OutboxEventRow> outboxEventById(UUID id) {
        return queryOne("select * from outbox_event where id = :id", new MapSqlParameterSource("id", id), this::mapOutboxEvent);
    }

    private <T> Optional<T> queryOne(String sql, MapSqlParameterSource params, org.springframework.jdbc.core.RowMapper<T> mapper) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(sql, params, mapper));
        } catch (EmptyResultDataAccessException exception) {
            return Optional.empty();
        }
    }

    private PaymentIntentRow mapPaymentIntent(ResultSet rs, int rowNum) throws SQLException {
        return new PaymentIntentRow(
                rs.getObject("id", UUID.class),
                rs.getObject("slot_hold_id", UUID.class),
                rs.getString("provider"),
                rs.getString("provider_reference"),
                rs.getBigDecimal("amount"),
                rs.getString("currency"),
                rs.getString("status"),
                rs.getString("reconciliation_reason"),
                rs.getLong("version"),
                instant(rs, "created_at"),
                instant(rs, "updated_at"));
    }

    private WebhookInboxRow mapWebhookInbox(ResultSet rs, int rowNum) throws SQLException {
        return new WebhookInboxRow(
                rs.getObject("id", UUID.class),
                rs.getString("provider"),
                rs.getString("event_id"),
                rs.getString("event_type"),
                rs.getString("provider_transaction_id"),
                rs.getString("signature_status"),
                rs.getString("payload_hash"),
                rs.getBytes("raw_payload"),
                rs.getString("payload"),
                instant(rs, "provider_occurred_at"),
                instant(rs, "received_at"),
                rs.getString("provider_time_trust"),
                rs.getBigDecimal("amount"),
                rs.getString("currency"),
                rs.getString("status"),
                instant(rs, "processed_at"),
                rs.getString("error_code"),
                rs.getInt("attempts"),
                instant(rs, "next_attempt_at"),
                rs.getString("correlation_id"),
                rs.getLong("version"));
    }

    private PaymentRow mapPayment(ResultSet rs, int rowNum) throws SQLException {
        return new PaymentRow(
                rs.getObject("id", UUID.class),
                rs.getObject("payment_intent_id", UUID.class),
                rs.getString("provider"),
                rs.getString("provider_transaction_id"),
                rs.getBigDecimal("amount"),
                rs.getString("currency"),
                rs.getString("status"),
                instant(rs, "provider_occurred_at"),
                rs.getString("provider_time_trust"),
                rs.getObject("webhook_inbox_id", UUID.class),
                instant(rs, "captured_at"),
                instant(rs, "created_at"));
    }

    private OutboxEventRow mapOutboxEvent(ResultSet rs, int rowNum) throws SQLException {
        return new OutboxEventRow(
                rs.getObject("id", UUID.class),
                rs.getString("aggregate_type"),
                rs.getObject("aggregate_id", UUID.class),
                rs.getString("event_type"),
                rs.getString("payload_schema_version"),
                rs.getString("payload"),
                instant(rs, "occurred_at"),
                instant(rs, "published_at"),
                rs.getInt("attempts"),
                rs.getString("status"),
                instant(rs, "next_attempt_at"),
                rs.getString("error_code"),
                rs.getString("correlation_id"),
                rs.getLong("version"));
    }

    private static Timestamp ts(Instant value) { return value == null ? null : Timestamp.from(value); }
    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }
}
