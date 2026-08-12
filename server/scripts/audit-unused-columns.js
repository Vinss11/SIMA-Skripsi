'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });

const fs = require('fs');
const path = require('path');
const db = require('../models');

const SERVER_ROOT = path.join(__dirname, '..');
const PROJECT_ROOT = path.join(SERVER_ROOT, '..');
const RUNTIME_DIRS = [
  path.join(SERVER_ROOT, 'controllers'),
  path.join(SERVER_ROOT, 'middlewares'),
  path.join(SERVER_ROOT, 'routes'),
  path.join(SERVER_ROOT, 'services'),
  path.join(SERVER_ROOT, 'scripts'),
  path.join(SERVER_ROOT, 'utils'),
  path.join(SERVER_ROOT, 'constants'),
  path.join(PROJECT_ROOT, 'client', 'src'),
];
const RUNTIME_FILES = [path.join(SERVER_ROOT, 'app.js')];

const walkJs = target => {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return target.endsWith('.js') ? [target] : [];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap(entry =>
    walkJs(path.join(target, entry.name))
  );
};

const runtimeFiles = [...RUNTIME_DIRS.flatMap(walkJs), ...RUNTIME_FILES]
  .filter(fs.existsSync)
  .map(file => ({
    file: path.relative(PROJECT_ROOT, file).replaceAll('\\', '/'),
    text: fs.readFileSync(file, 'utf8'),
  }));

const countToken = token => {
  if (!token) return { count: 0, files: [] };
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(^|[^A-Za-z0-9_])${escaped}([^A-Za-z0-9_]|$)`, 'g');
  let count = 0;
  const files = [];
  for (const source of runtimeFiles) {
    const matches = source.text.match(pattern);
    if (!matches) continue;
    count += matches.length;
    files.push(source.file);
  }
  return { count, files };
};

const quote = identifier => `"${String(identifier).replaceAll('"', '""')}"`;
const normalizeTableName = value => {
  if (typeof value === 'string') return value;
  return value.tableName;
};

const main = async () => {
  db.sequelize.options.logging = false;
  await db.sequelize.authenticate();
  const queryInterface = db.sequelize.getQueryInterface();
  const tableNames = (await queryInterface.showAllTables())
    .map(normalizeTableName)
    .filter(table => table !== 'SequelizeMeta')
    .sort();

  const modelByTable = new Map();
  for (const model of Object.values(db.sequelize.models)) {
    modelByTable.set(normalizeTableName(model.getTableName()), model);
  }

  const report = [];
  for (const table of tableNames) {
    const definition = await queryInterface.describeTable(table);
    const model = modelByTable.get(table);
    const attributeByField = new Map(
      Object.entries(model?.rawAttributes || {}).map(([attribute, metadata]) => [
        metadata.field || attribute,
        { attribute, metadata },
      ])
    );
    const associationForeignKeys = new Set(
      Object.values(model?.associations || {})
        .map(association => association.foreignKey)
        .filter(Boolean)
    );
    const columns = Object.keys(definition);
    const aggregates = columns.flatMap(column => [
      `COUNT(${quote(column)})::int AS ${quote(`${column}__nonnull`)}`,
      `COUNT(DISTINCT ${quote(column)}::text)::int AS ${quote(`${column}__distinct`)}`,
    ]);
    const stats = await db.sequelize.query(
      `SELECT COUNT(*)::int AS "__total", ${aggregates.join(', ')} FROM ${quote(table)}`,
      { type: db.Sequelize.QueryTypes.SELECT, plain: true }
    );

    for (const column of columns) {
      const mapped = attributeByField.get(column);
      const attribute = mapped?.attribute;
      const tokens = [...new Set([column, attribute].filter(Boolean))];
      const usages = tokens.map(token => ({ token, ...countToken(token) }));
      const runtimeReferences = usages.reduce((sum, usage) => sum + usage.count, 0);
      const modelMarkers = [model?.name, table].filter(Boolean);
      const modelContextFiles = runtimeFiles.filter(source =>
        modelMarkers.some(marker => source.text.includes(marker))
      );
      const contextualReferences = usages.reduce((sum, usage) => {
        const escaped = usage.token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`(^|[^A-Za-z0-9_])${escaped}([^A-Za-z0-9_]|$)`, 'g');
        return sum + modelContextFiles.reduce(
          (fileSum, source) => fileSum + (source.text.match(pattern)?.length || 0),
          0
        );
      }, 0);
      const protectedImplicitly = Boolean(
        definition[column].primaryKey ||
        definition[column].references ||
        associationForeignKeys.has(column) ||
        associationForeignKeys.has(attribute) ||
        ['id', 'createdAt', 'updatedAt', 'deletedAt'].includes(column)
      );
      report.push({
        table,
        column,
        attribute: attribute || null,
        model: model?.name || null,
        type: definition[column].type,
        allowNull: definition[column].allowNull,
        defaultValue: definition[column].defaultValue,
        totalRows: stats.__total,
        nonNullRows: stats[`${column}__nonnull`],
        distinctValues: stats[`${column}__distinct`],
        runtimeReferences,
        contextualReferences,
        referenceFiles: [...new Set(usages.flatMap(usage => usage.files))],
        protectedImplicitly,
        classification: !mapped && !protectedImplicitly
          ? 'DB_ONLY'
          : runtimeReferences === 0 && !protectedImplicitly
            ? 'REVIEW_UNUSED'
            : contextualReferences === 0 && !protectedImplicitly
              ? 'REVIEW_CONTEXT'
              : runtimeReferences <= 2 && !protectedImplicitly
                ? 'REVIEW_LOW_REFERENCE'
            : 'USED_OR_PROTECTED',
      });
    }
  }

  const candidates = report.filter(item => item.classification !== 'USED_OR_PROTECTED');
  if (process.argv.includes('--compact')) {
    console.log(`tables=${tableNames.length} columns=${report.length} candidates=${candidates.length}`);
    for (const item of candidates) {
      console.log([
        item.classification,
        `${item.table}.${item.column}`,
        `rows=${item.nonNullRows}/${item.totalRows}`,
        `refs=${item.runtimeReferences}`,
        item.referenceFiles.join(','),
      ].join('\t'));
    }
    return;
  }
  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    totals: {
      tables: tableNames.length,
      columns: report.length,
      candidates: candidates.length,
      dbOnly: candidates.filter(item => item.classification === 'DB_ONLY').length,
      reviewUnused: candidates.filter(item => item.classification === 'REVIEW_UNUSED').length,
    },
    candidates,
  }, null, 2));
};

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.sequelize.close();
  });
