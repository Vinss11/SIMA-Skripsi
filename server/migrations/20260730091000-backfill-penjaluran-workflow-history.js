"use strict";

module.exports = {
  async up(queryInterface) {
    if (queryInterface.sequelize.getDialect() !== "postgres") return;
    await queryInterface.sequelize.query(`
      INSERT INTO "RiwayatWorkflowPenjalurans" (
        pendaftaran_penjaluran_id, jalur, raw_status, workflow_stage, event_type,
        actor_type, actor_id, note, metadata, occurred_at, deduplication_key,
        "createdAt", "updatedAt"
      )
      SELECT
        p.id,
        COALESCE(
          NULLIF(p.form_lanjutan_payload->>'jalur', ''),
          CASE WHEN p.jalur = 'alih' THEN p.penjaluran_baru::text ELSE p.jenis_jalur_diambil::text END,
          'unknown'
        ),
        COALESCE(NULLIF(entry.value->>'status', ''), p.form_lanjutan_status::text),
        CASE COALESCE(NULLIF(entry.value->>'status', ''), p.form_lanjutan_status::text)
          WHEN 'draft' THEN 'draft'
          WHEN 'review_sekprodi' THEN 'waiting_final_decision'
          WHEN 'menunggu_approval_sekprodi' THEN 'waiting_final_decision'
          WHEN 'approved' THEN 'approved'
          WHEN 'rejected' THEN 'rejected'
          WHEN 'completed' THEN 'completed'
          WHEN 'cancelled' THEN 'cancelled'
          ELSE 'under_path_review'
        END,
        'legacy_timeline_import',
        COALESCE(NULLIF(entry.value->>'actor', ''), 'system'),
        CASE WHEN entry.value->>'actor_id' ~ '^[0-9]+$' THEN (entry.value->>'actor_id')::integer ELSE NULL END,
        NULLIF(entry.value->>'note', ''),
        jsonb_build_object('source', 'form_lanjutan_payload', 'legacy_entry', entry.value),
        COALESCE(p."updatedAt", p."createdAt", NOW()),
        'penjaluran:' || p.id || ':legacy-timeline:' || entry.ordinality,
        NOW(),
        NOW()
      FROM "PendaftaranPenjalurans" p
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(p.form_lanjutan_payload->'workflow_timeline') = 'array'
            THEN p.form_lanjutan_payload->'workflow_timeline'
          ELSE '[]'::jsonb
        END
      ) WITH ORDINALITY AS entry(value, ordinality)
      ON CONFLICT (deduplication_key) DO NOTHING;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM "RiwayatWorkflowPenjalurans"
      WHERE event_type = 'legacy_timeline_import';
    `);
  },
};
