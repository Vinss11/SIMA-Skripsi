"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`DROP INDEX IF EXISTS uq_mata_kuliah_alias_scope`, { transaction });
      await queryInterface.sequelize.query(`ALTER TABLE "MataKuliahAliases" DROP CONSTRAINT IF EXISTS "MataKuliahAliases_source_id_kode_alias_kode_program_studi_key"`, { transaction });
      await queryInterface.sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_alias_program_scope ON "MataKuliahAliases" (COALESCE(source_id, 0), kode_alias, kode_program_studi, program_kuliah) WHERE is_active = true`, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`DROP INDEX IF EXISTS uq_alias_program_scope`, { transaction });
      await queryInterface.sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_mata_kuliah_alias_scope ON "MataKuliahAliases" (COALESCE(source_id, 0), kode_alias, kode_program_studi) WHERE is_active = true`, { transaction });
    });
  },
};
