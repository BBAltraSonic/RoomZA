import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const campaign=JSON.parse(await fs.readFile(path.join(root,'campaign.json'),'utf8'));
const calendar=JSON.parse(await fs.readFile(path.join(root,'calendar.json'),'utf8'));
const output=path.join(root,'outputs','pinpoint-western-cape-20261025');
await fs.mkdir(path.join(output,'previews'),{recursive:true});
const wb=Workbook.create();
const results=wb.worksheets.add('Results'),cal=wb.worksheets.add('Calendar'),owners=wb.worksheets.add('Owners'),enquiries=wb.worksheets.add('Enquiries');
const ink='#151A24',amber='#FFF0CB',paper='#FBFAF7',soft='#F2F0EC';
const col=i=>{let r='';for(let n=i;n;n=Math.floor((n-1)/26))r=String.fromCharCode(65+(n-1)%26)+r;return r;};
function base(sheet,lastCol,lastRow){
  sheet.showGridLines=false;
  const all=sheet.getRange(`B2:${lastCol}${lastRow}`);all.format.font={name:'Arial',size:11,color:ink};all.format.rowHeight=23;all.format.verticalAlignment='center';
  sheet.getRange(`B2:${lastCol}2`).format.font={name:'Arial',size:16,bold:true,color:ink};
  sheet.getRange(`B3:${lastCol}3`).format.borders={bottom:{style:'thin',color:'#D89B23'}};
  sheet.getRange(`B8:${lastCol}8`).format.rowHeight=34;
  sheet.getRange(`B2:${lastCol}${lastRow}`).format.columnWidth=18;
}
function header(sheet,row,labels){const range=sheet.getRange(`B${row}:${col(labels.length+1)}${row}`);range.values=[labels];range.format={fill:ink,font:{name:'Arial',size:11,bold:true,color:'#FFFFFF'},horizontalAlignment:'center',verticalAlignment:'center',rowHeight:36,wrapText:true};range.format.borders={insideVertical:{style:'thin',color:'#FFFFFF'}};}
function input(sheet,range,format){sheet.getRange(range).format.fill=amber;if(format)sheet.getRange(range).setNumberFormat(format);}
const list=(sheet,range,values)=>sheet.getRange(range).dataValidation={rule:{type:'list',values}};
// Date-only inputs use midnight so dates entered normally in Excel share the same boundaries.
const date=value=>new Date(`${value}T00:00:00Z`);
const status=(sheet,range)=>{
  list(sheet,range,['Not tested','Pass','Needs work']);
  sheet.getRange(range).conditionalFormats.add('containsText',{text:'Needs work',format:{fill:'#FCE1DF',font:{color:'#9A2727',bold:true}}});
};

base(cal,'L',38);cal.tabColor=ink;
cal.getRange('B2').values=[['30-day content calendar']];
cal.getRange('B4').values=[['Day 1']];cal.getRange('C4').values=[[date(campaign.startDate)]];input(cal,'C4','dd mmm yyyy');
cal.getRange('E4').values=[['Timezone']];cal.getRange('F4').values=[['Africa/Johannesburg']];cal.getRange('F4').format.columnWidth=25;
cal.getRange('B5').values=[['Amber = editable. Proposed dates; no posts scheduled. Change Day 1 to shift every date.']];
cal.getRange('B6').values=[['One row per original asset. Cross-posted copies do not add to the original-post count.']];
header(cal,8,['Day','Date','Time SAST','Asset','Format','Audience','Post or task','Status','Published date','Destinations','Notes']);
cal.getRange('B9:L38').values=calendar.map(r=>[r.day,null,r.time,r.assetId,r.format,r.audience,r.title,r.status,null,r.destinations,r.notes]);
cal.getRange('C9:C38').formulas=calendar.map((_,i)=>[`=$C$4+B${i+9}-1`]);cal.getRange('C9:C38').setNumberFormat('dd mmm yyyy');
cal.getRange('B9:B38').setNumberFormat('0');cal.getRange('D9:D38').format.horizontalAlignment='center';cal.getRange('B9:L38').format.rowHeight=62;cal.getRange('H9:H38').format.wrapText=true;cal.getRange('L9:L38').format.wrapText=true;
cal.getRange('B9:B38').format.columnWidth=7;cal.getRange('D9:G38').format.columnWidth=16;cal.getRange('H8:H38').format.columnWidth=62;cal.getRange('K8:K38').format.columnWidth=29;cal.getRange('L8:L38').format.columnWidth=49;
input(cal,'I9:J38');cal.getRange('J9:J38').setNumberFormat('dd mmm yyyy');list(cal,'I9:I38',['Ready','Planned','Scheduled','Published','Skipped']);cal.freezePanes.freezeRows(8);cal.freezePanes.freezeColumns(3);

base(owners,'K',68);
owners.getRange('B2').values=[['Owner conversations and participation']];
owners.getRange('B4').values=[['Use a stable neutral ID per owner. Keep personal details and original permissions outside this workbook.']];
owners.getRange('B5').values=[['A conversation needs a substantive reply. Participation needs authority, consent and permission evidence.']];
owners.getRange('B6').values=[['Targets: 12 unique owner conversations and 3 participating owners. Targets are not forecasts.']];
header(owners,8,['Owner ID','Town / suburb','Reply date','Authority confirmed','Participation confirmed','Organic media permission','Unique conversation','Unique participant','Evidence reference','Next action']);
input(owners,'B9:G68');input(owners,'J9:K68');owners.getRange('D9:D68').setNumberFormat('dd mmm yyyy');list(owners,'E9:G68',['Yes','No']);
for(let r=9;r<=68;r++){
  owners.getRange(`H${r}`).formulas=[[`=IF(OR(B${r}="",NOT(ISNUMBER(D${r}))),"",IF(COUNTIFS($B$9:B${r},B${r},$D$9:D${r},">0")=1,1,0))`]];
  owners.getRange(`I${r}`).formulas=[[`=IF(B${r}="","",IF(AND(ISNUMBER(D${r}),E${r}="Yes",F${r}="Yes",G${r}="Yes",J${r}<>""),IF(COUNTIFS($B$9:B${r},B${r},$D$9:D${r},">0",$E$9:E${r},"Yes",$F$9:F${r},"Yes",$G$9:G${r},"Yes",$J$9:J${r},"<>")=1,1,0),0))`]];
}
owners.getRange('B8:B68').format.columnWidth=15;owners.getRange('C8:C68').format.columnWidth=27;owners.getRange('E8:I68').format.columnWidth=20;owners.getRange('J8:K68').format.columnWidth=42;owners.freezePanes.freezeRows(8);owners.freezePanes.freezeColumns(2);

base(enquiries,'O',108);
enquiries.getRange('B2').values=[['Renter enquiries and source attribution']];
enquiries.getRange('B4').values=[['Dedup key = stable renter code + room code, such as R001-L001. Count repeat contact for the same room once.']];
enquiries.getRange('B5').values=[['Qualified = matching area and budget + contact/viewing request + actual available room; exclude tests.']];
enquiries.getRange('B6').values=[['Use Yes/No for every qualification input. Unknown source remains Unknown. Update the original row when attribution is resolved.']];
header(enquiries,8,['Date SAST','Dedup key','Source','Medium','Asset ID','Area match','Budget match','Contact / viewing requested','Room available','Test enquiry','Source evidence type','Unique qualified','Paid attributed','Evidence reference']);
input(enquiries,'B9:L108');input(enquiries,'O9:O108');enquiries.getRange('B9:B108').setNumberFormat('dd mmm yyyy');
list(enquiries,'D9:D108',['Facebook','Instagram','TikTok','Owner share','Unknown']);list(enquiries,'E9:E108',['organic_social','paid_social','Unknown']);list(enquiries,'G9:K108',['Yes','No']);list(enquiries,'L9:L108',['Observed','Self-reported','Unknown']);
for(let r=9;r<=108;r++){
  enquiries.getRange(`M${r}`).formulas=[[`=IF(OR(NOT(ISNUMBER(B${r})),C${r}="",COUNTBLANK(G${r}:K${r})>0),"",IF(AND(G${r}="Yes",H${r}="Yes",I${r}="Yes",J${r}="Yes",K${r}="No"),IF(COUNTIFS($B$9:B${r},">0",$C$9:C${r},C${r},$G$9:G${r},"Yes",$H$9:H${r},"Yes",$I$9:I${r},"Yes",$J$9:J${r},"Yes",$K$9:K${r},"No")=1,1,0),0))`]];
  enquiries.getRange(`N${r}`).formulas=[[`=IF(M${r}="","",IF(AND(M${r}=1,E${r}="paid_social",OR(D${r}="Facebook",D${r}="Instagram",D${r}="TikTok"),OR(L${r}="Observed",L${r}="Self-reported"),O${r}<>""),1,0))`]];
}
enquiries.getRange('B8:C108').format.columnWidth=18;enquiries.getRange('D8:E108').format.columnWidth=22;enquiries.getRange('F8:H108').format.columnWidth=15;enquiries.getRange('I8:L108').format.columnWidth=22;enquiries.getRange('M8:N108').format.columnWidth=18;enquiries.getRange('O8:O108').format.columnWidth=36;enquiries.freezePanes.freezeRows(8);enquiries.freezePanes.freezeColumns(3);

base(results,'M',37);results.tabColor=ink;
results.getRange('B2').values=[['Western Cape campaign results']];
results.getRange('B4:C7').values=[['Preparation ad budget (ZAR)',campaign.currentAdBudgetZar],['Future all-in ad cap (ZAR)',campaign.futureAdTestCapZar],['First tranche review (ZAR)',campaign.futureAdReviewZar],['Logging started?','No']];
results.getRange('C4:C6').setNumberFormat('"R"#,##0.00');input(results,'C7');list(results,'C7',['Yes','No']);
results.getRange('F4:F7').values=[['Owner conversations'],['Participating owners'],['Qualified enquiries'],['Paid attributed enquiries']];results.getRange('F4:F7').format.columnWidth=29;
results.getRange('G4:G7').formulas=[['=IF($C$7<>"Yes","Not recorded",SUM(Owners!H9:H68))'],['=IF($C$7<>"Yes","Not recorded",SUM(Owners!I9:I68))'],['=IF($C$7<>"Yes","Not recorded",SUM(Enquiries!M9:M108))'],['=IF($C$7<>"Yes","Not recorded",SUM(Enquiries!N9:N108))']];
results.getRange('J4').values=[['Pilot town / suburb']];input(results,'K4');results.getRange('K4').format.columnWidth=28;
results.getRange('B8').values=[['Amber = editable inputs. Leave unmeasured actuals blank; enter a measured zero when appropriate.']];
header(results,10,['Period','Start','End','Original posts','Outbound clicks','Ad spend ZAR','Live listing snapshot','Qualified enquiries','Paid enquiries','Cost / paid enquiry','Review done?','Evidence reference']);
for(let i=0;i<4;i++){
  const r=11+i,offset=i*7;
  results.getRange(`B${r}`).values=[[i===3?'Days 22–30':`Week ${i+1}`]];
  results.getRange(`C${r}:D${r}`).formulas=[[`=Calendar!$C$4+${offset}`,`=C${r}+${i===3?8:6}`]];
  results.getRange(`E${r}`).formulas=[[`=IF($C$7<>"Yes","Not recorded",COUNTIFS(Calendar!$I$9:$I$38,"Published",Calendar!$J$9:$J$38,">="&C${r},Calendar!$J$9:$J$38,"<"&D${r}+1))`]];
  results.getRange(`I${r}`).formulas=[[`=IF($C$7<>"Yes","Not recorded",SUMIFS(Enquiries!$M$9:$M$108,Enquiries!$B$9:$B$108,">="&C${r},Enquiries!$B$9:$B$108,"<"&D${r}+1))`]];
  results.getRange(`J${r}`).formulas=[[`=IF($C$7<>"Yes","Not recorded",SUMIFS(Enquiries!$N$9:$N$108,Enquiries!$B$9:$B$108,">="&C${r},Enquiries!$B$9:$B$108,"<"&D${r}+1))`]];
  results.getRange(`K${r}`).formulas=[[`=IF(OR(G${r}="",$C$23<>"Pass",NOT(ISNUMBER(J${r}))),"n.a.",IF(OR(J${r}=0,COUNTIFS(Enquiries!$B$9:$B$108,">="&C${r},Enquiries!$B$9:$B$108,"<"&D${r}+1,Enquiries!$E$9:$E$108,"paid_social",Enquiries!$M$9:$M$108,1,Enquiries!$N$9:$N$108,0)>0),"n.a.",G${r}/J${r}))`]];
}
input(results,'F11:H14');input(results,'L11:M14');results.getRange('C11:D14').setNumberFormat('dd mmm yyyy');results.getRange('G11:G14').setNumberFormat('"R"#,##0.00');results.getRange('K11:K14').setNumberFormat('"R"#,##0.00');list(results,'L11:L14',['Yes','No']);
results.getRange('B16').values=[['Live listings are dated local snapshots, not cumulative totals. Clicks, enquiries and confirmed tenancies are different outcomes.']];
header(results,18,['Readiness input','Status','Count / evidence','Evidence date']);
results.getRange('B19:B25').values=[['Current local listings (minimum 5)'],['Mobile renter-contact journey'],['Owner submission and review'],['Required media permissions'],['Campaign source reporting'],['Availability rechecked for launch'],['South African housing-ad setup']];
results.getRange('C19').formulas=[['=IF(D19="","Not tested",IF(AND(ISNUMBER(D19),D19>=5,ISNUMBER(E19),$K$4<>""),"Pass","Needs work"))']];
input(results,'D19:E25');input(results,'C20:C25');results.getRange('C20:C25').values=Array.from({length:6},()=>['Not tested']);status(results,'C20:C25');results.getRange('E19:E25').setNumberFormat('dd mmm yyyy');
results.getRange('B27:B30').values=[['Organic live-listing launch'],['Paid test readiness'],['Recorded ad spend (ZAR)'],['Next advertising action']];
results.getRange('C27').formulas=[['=IF(AND(C19="Pass",C20="Pass",C21="Pass",C22="Pass",C23="Pass",C24="Pass",COUNTA(D20:D24)=5,COUNT(E20:E24)=5),"Ready","Preparation")']];
results.getRange('C28').formulas=[['=IF(AND(C27="Ready",C25="Pass",D25<>"",ISNUMBER(E25),$C$7="Yes"),"Ready","Preparation")']];
results.getRange('C29').formulas=[['=IF(COUNT(G11:G14)=0,"Not recorded",SUM(G11:G14))']];results.getRange('C29').setNumberFormat('"R"#,##0.00');
results.getRange('C30').formulas=[['=IF(C28<>"Ready","Keep ads at R0",IF(COUNT(G11:G14)=0,"Prepare first capped tranche",IF(SUM(G11:G14)>=$C$5,"Cap reached: stop",IF(SUM(G11:G14)>=$C$6,IF(AND(ISNUMBER(G7),G7>0),"Pause: review remaining budget","Keep paused: no attributed enquiry"),"First tranche only"))))']];
results.getRange('C30:G30').format.rowHeight=40;
results.getRange('B32').values=[['Targets: 12 owner conversations, 3 participating owners, 5 publishable rentals. Planning targets, not forecasts.']];
results.getRange('B33').values=[['Ad cap is all-in. Pause at R375; release remaining budget only after attributed enquiry and renewed readiness checks.']];
results.getRange('B34').values=[['Initial state is unmeasured. Source: user-approved campaign plan, 25 October 2026. No live performance imported.']];
results.getRange('B35').values=[['Set Logging started to Yes only when maintaining actual records. Enquiries require evidence for paid attribution.']];
results.getRange('B36').values=[['Use one owner ID per business and one renter-room key per enquiry. Repeated channel contact must not inflate counts.']];
results.getRange('B37').values=[['See readiness-and-measurement.md for the precise definitions, source tags and pause conditions.']];
results.getRange('B4:B37').format.columnWidth=43;results.getRange('C4:C37').format.columnWidth=20;results.getRange('D10:D25').format.columnWidth=37;results.getRange('E10:E25').format.columnWidth=21;results.getRange('G4:G30').format.columnWidth=21;results.getRange('H10:M14').format.columnWidth=21;
results.getRange('C19:C28').format.rowHeight=26;results.getRange('B19:B25').format.rowHeight=30;

// Exercise the actual operational formulas, then restore all authored actuals.
const testReport=[];
const get=(s,cell)=>s.getRange(cell).values[0][0];
const expected=(label,s,cell,want)=>{const got=get(s,cell);assert.equal(got,want,`${label}: ${cell} was ${got}`);testReport.push({label,cell,expected:want,actual:got});};
wb.recalculate();
expected('Unmeasured counts stay unavailable',results,'G4','Not recorded');
expected('No permission or journey evidence means preparation',results,'C28','Preparation');
expected('Ads remain zero before readiness',results,'C30','Keep ads at R0');
results.getRange('C7').values=[['Yes']];
owners.getRange('B9:G10').values=[['OWN-001','Bellville',date('2026-10-27'),'Yes','Yes','Yes'],['OWN-001','Bellville',date('2026-10-28'),'Yes','Yes','Yes']];owners.getRange('J9:J10').values=[['TEST-EVIDENCE'],['TEST-EVIDENCE']];
enquiries.getRange('B9:L12').values=[
  [date('2026-10-27'),'R001-L001','Facebook','paid_social','V01','Yes','Yes','Yes','Yes','No','Observed'],
  [date('2026-10-28'),'R001-L001','Instagram','organic_social','V01','Yes','Yes','Yes','Yes','No','Observed'],
  [date('2026-10-29'),'R002-L001','Facebook','paid_social','V01','Yes','Yes','Yes','Yes','Yes','Observed'],
  [date('2026-10-30'),'R003-L001','Unknown','paid_social','V01','Yes','Yes','Yes','Yes','No','Unknown']
];enquiries.getRange('O9:O11').values=[['TEST-CLICK-001'],['TEST-DUPLICATE'],['TEST-EXCLUDE']];
results.getRange('G11').values=[[375]];
wb.recalculate();
expected('Repeated owner counted once',results,'G4',1);expected('Repeated participant counted once',results,'G5',1);expected('Repeated enquiry and tests excluded',results,'G6',2);expected('Only evidenced paid enquiry attributed',results,'G7',1);expected('Missing reporting keeps cost unavailable',results,'K11','n.a.');
results.getRange('K4').values=[['Bellville']];results.getRange('D19').values=[[4]];results.getRange('E19').values=[[date('2026-10-31')]];wb.recalculate();expected('Four listings fail the supply gate',results,'C19','Needs work');
results.getRange('D19').values=[[5]];results.getRange('C20:C25').values=Array.from({length:6},()=>['Pass']);wb.recalculate();expected('Pass labels without evidence cannot enable launch',results,'C28','Preparation');results.getRange('D20:E25').values=Array.from({length:6},()=>['TEST-READINESS-EVIDENCE',date('2026-10-31')]);wb.recalculate();expected('Missing paid attribution still keeps CPL unavailable',results,'K11','n.a.');expected('All gates enable readiness',results,'C28','Ready');expected('First tranche requires a pause',results,'C30','Pause: review remaining budget');
enquiries.getRange('D12').values=[['Instagram']];enquiries.getRange('L12').values=[['Self-reported']];enquiries.getRange('O12').values=[['TEST-RESOLVED']];wb.recalculate();expected('Resolved source joins paid count',results,'G7',2);expected('Paid CPL uses matched paid enquiries',results,'K11',187.5);
results.getRange('G11').values=[[750]];wb.recalculate();expected('All-in cap stops spend',results,'C30','Cap reached: stop');
results.getRange('C22').values=[['Not tested']];wb.recalculate();expected('Open media gate blocks paid readiness',results,'C28','Preparation');expected('Open gate restores zero-spend instruction',results,'C30','Keep ads at R0');
// Next reserved row and the 30-day boundary must calculate correctly.
enquiries.getRange('B13:L13').values=[[date('2026-11-24'),'R004-L001','Facebook','organic_social','V08','Yes','Yes','Yes','Yes','No','Observed']];enquiries.getRange('O13').values=[['TEST-DAY30']];wb.recalculate();expected('Day 30 included in final period',results,'I14',1);
enquiries.getRange('B14:L15').values=[
  [null,'R005-L001','Facebook','organic_social','V01','Yes','Yes','Yes','Yes','No','Observed'],
  [date('2026-10-26'),'R005-L001','Facebook','organic_social','V01','Yes','Yes','Yes','Yes','No','Observed']
];wb.recalculate();expected('Undated draft does not suppress a later actual enquiry',enquiries,'M15',1);expected('Day-one midnight enquiry is included',results,'I11',3);
// Restore every temporary input. No fixture enquiries are exported.
owners.getRange('B9:G10').clear({applyTo:'contents'});owners.getRange('J9:J10').clear({applyTo:'contents'});enquiries.getRange('B9:L15').clear({applyTo:'contents'});enquiries.getRange('O9:O15').clear({applyTo:'contents'});
results.getRange('C7').values=[['No']];results.getRange('K4').clear({applyTo:'contents'});results.getRange('D19:E25').clear({applyTo:'contents'});results.getRange('C20:C25').values=Array.from({length:6},()=>['Not tested']);results.getRange('G11').clear({applyTo:'contents'});
wb.recalculate();expected('Restored workbook has no reported results',results,'G6','Not recorded');expected('Restored workbook remains in preparation',results,'C28','Preparation');
const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:30},summary:'Final formula scan',maxChars:2500});
const detail=await wb.inspect({kind:'table',range:'Results!B19:G30',include:'values,formulas',tableMaxRows:12,tableMaxCols:6,maxChars:5000});
await fs.writeFile(path.join(root,'verification','workbook-checks.json'),JSON.stringify({tests:testReport,formulaScan:errors.ndjson,readiness:detail.ndjson,engine:'Artifact Tool; native Excel editing was not exercised'},null,2));
for(const [sheet,range]of[['Results','B2:G30'],['Calendar','B2:J15'],['Owners','B2:K13'],['Enquiries','B2:O13']]){
  const image=await wb.render({sheetName:sheet,range,scale:1.25,format:'png'});await fs.writeFile(path.join(output,'previews',`${sheet}.png`),new Uint8Array(await image.arrayBuffer()));
}
const file=await SpreadsheetFile.exportXlsx(wb);await file.save(path.join(output,'Pinpoint-Western-Cape-Tracker.xlsx'));
console.log(JSON.stringify({output:path.join(output,'Pinpoint-Western-Cape-Tracker.xlsx'),checks:testReport.length,formulaScan:errors.ndjson}));
