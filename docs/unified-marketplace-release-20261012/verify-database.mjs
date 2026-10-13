import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir='docs/unified-marketplace-release-20261012';
const read=f=>JSON.parse(fs.readFileSync(dir+'/'+f+'.json'));
const after=read('database-after'),before=read('functions-parsed-before'),tables=read('table-security-parsed-before'),data=read('data-comparison'),security=read('security-comparison');
const normalize=s=>s.replaceAll('\r\n','\n').trim();
const acl=value=>Array.isArray(value)?'{'+value.join(',')+'}':value;
const sql=fs.readFileSync('supabase/migrations/20261012011144_unified_marketplace_accounts.sql','utf8');
const checks=[];
const check=(label,value)=>{assert(value,label);checks.push(label);};
for(const m of sql.matchAll(/create(?: or replace)? function (\w+)\.(\w+)\([\s\S]*?\bas \$\$([\s\S]*?)\$\$;/gi)){
 const live=after.functions.find(f=>f.schema===m[1]&&f.name===m[2]);
 check('Installed body matches '+m[1]+'.'+m[2],live&&normalize(live.definition.match(/AS \$function\$([\s\S]*?)\$function\$/)[1])===normalize(m[3]));
}
for(const name of ['create_organization','accept_organization_invitation']){
 const prior=before.find(f=>f.proname===name),current=after.functions.find(f=>f.name===name);
 check(name+' grants and privilege mode unchanged',acl(prior.proacl)===acl(current.acl)&&prior.prosecdef===current.securityDefiner);
}
const sorted=xs=>xs.toSorted((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
check('All public table ACL and RLS flags unchanged',JSON.stringify(sorted(tables.tableSecurity))===JSON.stringify(sorted(after.tableSecurity)));
check('All public policies unchanged',JSON.stringify(sorted(tables.policies))===JSON.stringify(sorted(after.policies)));
check('All 24 checked table fingerprints and existing account rows unchanged',data.passed);
check('All permanent accounts have four workflows',after.permanentProfiles===11&&after.allWorkflows===11);
check('Exactly one primary and active selection per account',after.primaryActiveCounts.every(p=>p.primary===1&&p.active===1));
check('Migration history has the expected missing migration',after.migrations.filter(m=>m.version==='20261012011144').length===1);
const recovery=after.functions.find(f=>f.name==='ensure_marketplace_account'),draft=after.functions.find(f=>f.name==='pinpoint_property_create_draft');
check('Recovery grants only authenticated application role',acl(recovery.acl)==='{postgres=X/postgres,authenticated=X/postgres}');
check('Draft uses invoker mode and only service-role grant',!draft.securityDefiner&&acl(draft.acl)==='{postgres=X/postgres,service_role=X/postgres}');
for(const name of ['enable_marketplace_profile','initialize_marketplace_profile'])check(name+' helpers revoked from app roles',acl(after.functions.find(f=>f.name===name).acl)==='{postgres=X/postgres}');
check('Only reviewed self-recovery advisor added',security.reviewedNewSelfRecovery);
fs.writeFileSync(dir+'/database-verified.json',JSON.stringify({passed:true,checks,data,security},null,2));
fs.writeFileSync(dir+'/rollback-functions.sql','-- Historical organization function definitions only; additive account rows and helpers remain. A database rollback requires a separate decision.\n'+before.filter(f=>['create_organization','accept_organization_invitation'].includes(f.proname)).map(f=>f.definition+';').join('\n'));
console.log(JSON.stringify({passed:true,checks:checks.length}));
