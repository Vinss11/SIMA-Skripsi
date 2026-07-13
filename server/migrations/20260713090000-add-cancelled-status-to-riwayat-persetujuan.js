"use strict";

/** @type {import("sequelize-cli").Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = "RiwayatPersetujuans";
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === "postgres") {
      const [enumRows] = await queryInterface.sequelize.query(
        "SELECT typname FROM pg_type WHERE typname = 'enum_RiwayatPersetujuans_status';"
      );
      if (enumRows.length > 0) {
        await queryInterface.sequelize.query(
          'ALTER TYPE "enum_RiwayatPersetujuans_status" ADD VALUE IF NOT EXISTS \'cancelled\';'
        );
      }
    } else {
      await queryInterface.changeColumn(tableName, "status", {
        type: Sequelize.ENUM("approved", "rejected", "pending", "cancelled"),
        allowNull: false,
      });
    }

    const quotedTable = dialect === "postgres" ? `"${tableName}"` : `\`${tableName}\``;
    const quotedStatus = dialect === "postgres" ? '"status"' : "`status`";
    const quotedType = dialect === "postgres" ? '"tipe_approval"' : "`tipe_approval`";
    const quotedNote = dialect === "postgres" ? '"keterangan"' : "`keterangan`";
    await queryInterface.sequelize.query(
      `UPDATE ${quotedTable} SET ${quotedStatus} = 'cancelled' ` +
        `WHERE ${quotedType} = 'sekprodi' AND ${quotedStatus} = 'rejected' ` +
        `AND ${quotedNote} LIKE 'Dibatalkan karena topik slot %';`
    );
  },

  async down(queryInterface, Sequelize) {
    const tableName = "RiwayatPersetujuans";
    const dialect = queryInterface.sequelize.getDialect();
    const quotedTable = dialect === "postgres" ? `"${tableName}"` : `\`${tableName}\``;
    const quotedStatus = dialect === "postgres" ? '"status"' : "`status`";

    await queryInterface.sequelize.query(
      `UPDATE ${quotedTable} SET ${quotedStatus} = 'rejected' WHERE ${quotedStatus} = 'cancelled';`
    );

    if (dialect !== "postgres") {
      await queryInterface.changeColumn(tableName, "status", {
        type: Sequelize.ENUM("approved", "rejected", "pending"),
        allowNull: false,
      });
    }
  },
};
