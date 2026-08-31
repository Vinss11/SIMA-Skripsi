"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        "BimbinganSkripsis",
        "resume_history",
        {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: [],
        },
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
          UPDATE "BimbinganSkripsis"
             SET "resume_history" = jsonb_build_array(
               jsonb_build_object(
                 'version_number', 1,
                 'resume_text', "resume_mahasiswa",
                 'status', CASE
                   WHEN "status_resume"::text = 'revisi' THEN 'revision_required'
                   ELSE "status_resume"::text
                 END,
                 'submitted_at', COALESCE("updatedAt", "createdAt"),
                 'reviewed_at', "tanggal_review_resume",
                 'review_note', "catatan_review_resume"
               )
             )
           WHERE "resume_mahasiswa" IS NOT NULL
             AND BTRIM("resume_mahasiswa") <> ''
             AND jsonb_array_length("resume_history") = 0
        `,
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("BimbinganSkripsis", "resume_history");
  },
};
