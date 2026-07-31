"use strict";

const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class AssignmentActivationAttempt extends Model {
    static associate(models) {
      AssignmentActivationAttempt.belongsTo(models.PenetapanPembimbing, {
        foreignKey: "penetapan_pembimbing_id",
        as: "assignment",
      });
    }
  }
  AssignmentActivationAttempt.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    penetapan_pembimbing_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    status: { type: DataTypes.ENUM("pending", "activation_failed", "activated"), allowNull: false, defaultValue: "pending" },
    attempt_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    last_attempt_at: DataTypes.DATE,
    activated_at: DataTypes.DATE,
    error_code: DataTypes.STRING(80),
    error_message: DataTypes.TEXT,
  }, {
    sequelize,
    modelName: "AssignmentActivationAttempt",
    tableName: "AssignmentActivationAttempts",
    timestamps: true,
  });
  return AssignmentActivationAttempt;
};
