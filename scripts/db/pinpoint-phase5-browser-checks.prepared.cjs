/* Offline preparation only. Importing this module does not open a browser.
 * No attempt after 10 is authorized. A separately approved parent must supply
 * its unique attempt/result IDs, clone fixtures and captured analytics cleanup.
 */
module.exports.checkPersistedProgress = async function checkPersistedProgress(page, expect, completed) {
  const panels = page.locator('section:visible').filter({
    has: page.getByRole('heading', {name:'Purchase progress', exact:true}),
  });
  await expect(panels).toHaveCount(1);
  for (const label of completed) {
    const row = panels.locator('li').filter({has:page.getByText(label,{exact:true})});
    await expect(row).toHaveCount(1);
    await expect(row.getByText('Completed',{exact:true})).toBeVisible();
  }
  await expect(panels.getByText(`${completed.length}/7`,{exact:true})).toBeVisible();
};

// Supply actual SQL-persisted labels, not only the presence of a label that
// also appears for an upcoming milestone. Use on desktop and after phone reload.
module.exports.checkViewingInterest = async function checkViewingInterest(page, expect) {
  const panels=page.locator('section:visible').filter({has:page.getByRole('heading',{name:'Purchase progress',exact:true})});
  await expect(panels).toHaveCount(1);
  const row=panels.locator('li').filter({has:page.getByText('Viewing Scheduled',{exact:true})});
  await expect(row.getByText('Completed',{exact:true})).toHaveCount(0);
};

// Parent uses these without launching a browser; all ownership checks must pass.
module.exports.captureAnalytics = function captureAnalytics(sql, cloneName) {
  if(!/^pinpoint-release-[0-9a-f-]{36}-db$/.test(cloneName))throw new Error('Disposable clone required');
  return JSON.parse(sql("select coalesce(json_agg(id order by id),'[]') from public.analytics_events"));
};
module.exports.cleanCapturedAnalytics = function cleanCapturedAnalytics(sql, cloneName, before) {
  const after=module.exports.captureAnalytics(sql,cloneName);
  const ids=after.filter(id=>!before.includes(id));
  if(!ids.every(id=>/^[0-9a-f-]{36}$/.test(id)))throw new Error('Invalid captured analytics ID');
  if(ids.length)sql(`delete from public.analytics_events where id in (${ids.map(id=>`'${id}'`).join(',')})`);
  if(JSON.stringify(module.exports.captureAnalytics(sql,cloneName))!==JSON.stringify(before))throw new Error('Analytics baseline not restored');
  return ids;
};
