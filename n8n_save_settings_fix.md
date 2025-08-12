# Fix for Save Settings - Update Main Tables

## Problem
When saving new settings, the n8n workflow only inserts into the history tables (`tenant_settings_history`, `faqs_history`) but doesn't update the main tables (`tenant_settings`, `faqs`). This causes the frontend to show old data.

## Current Code (Broken)
The "Prepare Update/Revert Query" node only:
1. Archives old settings in `tenant_settings_history`
2. Inserts new settings into `tenant_settings_history`
3. Archives old FAQs in `faqs_history`
4. Inserts new FAQs into `faqs_history`

But it doesn't update the main tables that the frontend reads from.

## Fixed Code

**Node ID**: `75c962f7-75ae-4ce6-b3b8-54d110d99e76` ("Prepare Update/Revert Query")

Replace the jsCode with:

```javascript
const updates = $input.item.json.body;
const tenant_id = $input.item.json.tenant_id || 'default';
const queries = [];

// 1. Archive current settings (if they exist)
queries.push(`
  UPDATE tenant_settings_history
  SET is_current = false
  WHERE tenant_id = '${tenant_id}' AND is_current = true
`);

// 2. Insert new settings version into history
const newVersion = Date.now(); // Unix timestamp as version
queries.push(`
  INSERT INTO tenant_settings_history (
    tenant_id, system_message, handover_mode, 
    language, thresholds, version, is_current
  ) VALUES (
    '${tenant_id}',
    ${updates.system_message ? `'${updates.system_message.replace(/'/g, "''")}'` : 'NULL'},
    COALESCE('${updates.handover_mode || ''}', 'ask'),
    COALESCE('${updates.language || ''}', 'en'),
    ${JSON.stringify(updates.thresholds || {})}::jsonb,
    ${newVersion},
    true
  )
`);

// 3. UPDATE the main tenant_settings table
queries.push(`
  INSERT INTO tenant_settings (tenant_id, system_message, handover_mode, language, thresholds)
  VALUES (
    '${tenant_id}',
    ${updates.system_message ? `'${updates.system_message.replace(/'/g, "''")}'` : 'NULL'},
    COALESCE('${updates.handover_mode || ''}', 'ask'),
    COALESCE('${updates.language || ''}', 'en'),
    ${JSON.stringify(updates.thresholds || {})}::jsonb
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    system_message = EXCLUDED.system_message,
    handover_mode = EXCLUDED.handover_mode,
    language = EXCLUDED.language,
    thresholds = EXCLUDED.thresholds
`);

// 4. Archive current FAQs (no deletion)
if (updates.faqs && Array.isArray(updates.faqs)) {
  updates.faqs.forEach((faq, index) => {
    queries.push(`
      INSERT INTO faqs_history (
        tenant_id, question, answer, 
        keywords, priority, version
      ) VALUES (
        '${tenant_id}',
        '${faq.question.replace(/'/g, "''")}',
        '${faq.answer.replace(/'/g, "''")}',
        ${faq.keywords ? `'${JSON.stringify(faq.keywords)}'::jsonb` : 'NULL'},
        ${index + 1},
        ${newVersion}
      )
    `);
  });
}

// 5. UPDATE the main faqs table
queries.push(`
  DELETE FROM faqs WHERE tenant_id = '${tenant_id}'
`);

if (updates.faqs && Array.isArray(updates.faqs)) {
  updates.faqs.forEach((faq, index) => {
    queries.push(`
      INSERT INTO faqs (tenant_id, question, answer, keywords, priority)
      VALUES (
        '${tenant_id}',
        '${faq.question.replace(/'/g, "''")}',
        '${faq.answer.replace(/'/g, "''")}',
        ${faq.keywords ? `'${JSON.stringify(faq.keywords)}'::jsonb` : 'NULL'},
        ${index + 1}
      )
    `);
  });
}

return [{
  json: {
    sqlQuery: queries.join(';\n'),
    tenant_id: tenant_id,
    new_version: newVersion
  }
}];
```

## What This Fix Does

1. **Archives old settings** in `tenant_settings_history`
2. **Inserts new settings** into `tenant_settings_history`
3. **Updates main tenant_settings table** using UPSERT (INSERT ... ON CONFLICT)
4. **Archives old FAQs** in `faqs_history`
5. **Updates main faqs table** by deleting old FAQs and inserting new ones

## Expected Result

After saving settings:
1. **Frontend will show new data** immediately
2. **History is preserved** for version control
3. **Main tables are updated** for current usage

## Alternative: Simpler Approach

If you prefer a simpler approach, you can just update the main tables:

```javascript
const updates = $input.item.json.body;
const tenant_id = $input.item.json.tenant_id || 'default';
const queries = [];

// Update main tenant_settings table
queries.push(`
  INSERT INTO tenant_settings (tenant_id, system_message, handover_mode, language, thresholds)
  VALUES (
    '${tenant_id}',
    ${updates.system_message ? `'${updates.system_message.replace(/'/g, "''")}'` : 'NULL'},
    COALESCE('${updates.handover_mode || ''}', 'ask'),
    COALESCE('${updates.language || ''}', 'en'),
    ${JSON.stringify(updates.thresholds || {})}::jsonb
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    system_message = EXCLUDED.system_message,
    handover_mode = EXCLUDED.handover_mode,
    language = EXCLUDED.language,
    thresholds = EXCLUDED.thresholds
`);

// Update main faqs table
queries.push(`
  DELETE FROM faqs WHERE tenant_id = '${tenant_id}'
`);

if (updates.faqs && Array.isArray(updates.faqs)) {
  updates.faqs.forEach((faq, index) => {
    queries.push(`
      INSERT INTO faqs (tenant_id, question, answer, keywords, priority)
      VALUES (
        '${tenant_id}',
        '${faq.question.replace(/'/g, "''")}',
        '${faq.answer.replace(/'/g, "''")}',
        ${faq.keywords ? `'${JSON.stringify(faq.keywords)}'::jsonb` : 'NULL'},
        ${index + 1}
      )
    `);
  });
}

return [{
  json: {
    sqlQuery: queries.join(';\n'),
    tenant_id: tenant_id
  }
}];
```
