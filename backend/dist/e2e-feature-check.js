"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const data_source_1 = require("./config/data.source");
async function main() {
    await data_source_1.AppDataSource.initialize();
    const result = await data_source_1.AppDataSource.query(`SELECT w.id, w.title, w.sla_deadline, w.sla_status, w.escalated_at,
            w.sla_breached_at, r.id AS recurrence_id, r.frequency,
            r.next_run_at, r.timezone, r.time_of_day, r.is_active,
            COUNT(o.id)::int AS occurrence_count
     FROM work_items w
     LEFT JOIN work_item_recurrences r ON r.work_item_id = w.id
     LEFT JOIN work_item_occurrences o ON o.recurrence_id = r.id
     WHERE w.title IN ('SLA escalation E2E', 'Daily recurrence E2E',
                       'Monthly recurrence E2E', 'Custom weekly recurrence E2E')
     GROUP BY w.id, r.id
     ORDER BY w.title`);
    const audit = await data_source_1.AppDataSource.query(`SELECT action, entity_id, created_at
     FROM audit_logs
     WHERE entity_id = $1
     ORDER BY created_at`, ["76db22fe-b53c-496a-82f3-f0e2dcf8ab45"]);
    const notifications = await data_source_1.AppDataSource.query(`SELECT type, work_item_id, created_at
     FROM notifications
     WHERE work_item_id = $1`, ["76db22fe-b53c-496a-82f3-f0e2dcf8ab45"]);
    console.log(JSON.stringify({ result, audit, notifications }));
    await data_source_1.AppDataSource.destroy();
}
void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
