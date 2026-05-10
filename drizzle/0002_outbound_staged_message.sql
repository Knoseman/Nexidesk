-- Link outbound_queue row to the staged messages row (created before send; worker sets sentAt on success).

ALTER TABLE outbound_queue
  ADD COLUMN staged_message_id bigint REFERENCES messages (id);
