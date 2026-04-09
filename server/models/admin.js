"use strict";
const bcrypt = require("bcrypt");
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Admin extends Model {
    static associate(models) {
      // Define associations here if needed
    }

    // Method untuk compare password
    async comparePassword(candidatePassword) {
      return await bcrypt.compare(candidatePassword, this.password);
    }
  }

  Admin.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      nip: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
      },
      nama: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      is_default_password: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      role: {
        type: DataTypes.ENUM("koordinator", "staff"),
        allowNull: false,
        defaultValue: "staff",
      },
    },
    {
      sequelize,
      modelName: "Admin",
      tableName: "Admins",
      timestamps: true,
      hooks: {
        beforeCreate: async (admin) => {
          if (admin.password) {
            const salt = await bcrypt.genSalt(10);
            admin.password = await bcrypt.hash(admin.password, salt);
          }
        },
        beforeUpdate: async (admin) => {
          if (admin.changed("password")) {
            const salt = await bcrypt.genSalt(10);
            admin.password = await bcrypt.hash(admin.password, salt);
          }
        },
      },
    }
  );

  return Admin;
};
