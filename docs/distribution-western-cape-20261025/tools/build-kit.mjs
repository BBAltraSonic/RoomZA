import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const campaign = JSON.parse(await fs.readFile(path.join(root, 'campaign.json'), 'utf8'));
const out = path.join(root, 'assets');
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ink = '#151A24', amber = '#D89B23', paper = '#F2F0EC', muted = '#AEB4C0';
const masterLogo = await fs.readFile(path.resolve(root, '../../public/logo.svg'), 'utf8');
const logoInner = masterLogo.replace(/^.*?<svg[^>]*>/s, '').replace(/<\/svg>\s*$/, '');
const logo = (x, y, size, dark) => `<g transform="translate(${x} ${y}) scale(${size/64})">${dark ? logoInner.replaceAll('#151A24', '#FBFAF7') : logoInner}</g>`;
const lines = (text, size, width) => {
  const words = String(text).split(/\s+/), result = []; let line = '';
  // Conservative Segoe UI estimate. Every exported scene is additionally reviewed visually.
  const measure = s => [...s].reduce((n,c) => n + (/[MW@]/.test(c) ? .86 : /[ilI.,'!:;]/.test(c) ? .27 : /[A-Z]/.test(c) ? .64 : /\s/.test(c) ? .29 : .52), 0) * size;
  for (const word of words) { const next = line ? `${line} ${word}` : word; if (line && measure(next) > width) { result.push(line); line = word; } else line = next; }
  if (line) result.push(line); return result;
};
const textBlock = (text, x, y, size, width, color, weight=400, lineHeight=1.2) => lines(text,size,width).map((line,i) => `<text x="${x}" y="${y+i*size*lineHeight}" fill="${color}" font-family="Segoe UI, Arial, sans-serif" font-size="${size}" font-weight="${weight}">${esc(line)}</text>`).join('');
const graphic = (kind, x, y, scale, dark) => {
  const neutral = dark ? '#28303E' : '#E1DFD9', fg = dark ? paper : ink;
  const icons = {
    pin: `<path d="M95 16c-31 0-54 23-54 53 0 40 54 83 54 83s54-43 54-83c0-30-23-53-54-53Z" fill="none" stroke="${amber}" stroke-width="7"/><circle cx="95" cy="68" r="17" fill="${amber}"/><path d="m17 150 42-17m70 0 43 17" stroke="${neutral}" stroke-width="7" stroke-linecap="round"/>`,
    cost: `<rect x="24" y="23" width="143" height="136" rx="20" fill="${neutral}"/><path d="M47 58h96M47 90h96M47 122h48" stroke="${fg}" stroke-width="7" stroke-linecap="round"/><circle cx="145" cy="136" r="31" fill="${amber}"/><text x="145" y="148" text-anchor="middle" font-family="Segoe UI,Arial" font-size="38" font-weight="700" fill="${ink}">R</text>`,
    check: `<rect x="27" y="20" width="140" height="142" rx="23" fill="${neutral}"/><path d="m58 90 25 25 55-60" stroke="${amber}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    frame: `<rect x="20" y="29" width="156" height="122" rx="19" fill="${neutral}"/><rect x="34" y="43" width="128" height="94" rx="9" stroke="${fg}" stroke-width="4" fill="none"/><path d="m83 67 36 24-36 24Z" fill="${amber}"/>`
  };
  return `<g transform="translate(${x} ${y}) scale(${scale})">${icons[kind] ?? icons.pin}</g>`;
};
const sceneSvg = (scene, index, count, vertical=true, owner=false) => {
  const width=1080, height=vertical?1920:1350, dark=index%2===0, bg=dark?ink:paper, fg=dark?paper:ink;
  const headingSize = vertical?90:80, headingY=vertical?495:340, bodyY=vertical?900:725;
  const headingLines=lines(scene.heading,headingSize,875), bodyLines=lines(scene.body,vertical?51:47,875);
  if (headingLines.length>4 || bodyLines.length>5) throw new Error(`Text exceeds layout: ${scene.heading}`);
  if (headingY+(headingLines.length-1)*headingSize*1.07 > bodyY-70) throw new Error(`Heading collides with body: ${scene.heading}`);
  const top=vertical?225:92;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="1080" height="${height}" fill="${bg}"/>
  <path d="M904 0v${height}" stroke="${dark?'#222A38':'#E4E1DB'}" stroke-width="1"/>
  ${logo(91,top-52,68,dark)}${textBlock('Pinpoint',177,top,57,650,fg,650)}
  <rect x="96" y="${top+65}" width="${owner?601:370}" height="48" rx="24" fill="${dark?'#2C2D2C':'#E6DECE'}"/>
  ${textBlock(owner?'WESTERN CAPE OWNERS':'WESTERN CAPE',119,top+98,26,800,dark?'#E8BC66':'#6D4A0E',650)}
  ${textBlock(scene.eyebrow,96,headingY-88,27,875,dark?muted:'#59606D',650)}
  ${textBlock(scene.heading,92,headingY,headingSize,875,fg,700,1.07)}
  <rect x="96" y="${bodyY-64}" width="74" height="8" rx="4" fill="${amber}"/>
  ${textBlock(scene.body,96,bodyY,vertical?51:47,875,fg,400,1.25)}
  ${graphic(scene.graphic,vertical?95:96,vertical?1240:1015,vertical?1.25:.92,dark)}
  ${textBlock('ROOMS + AFFORDABLE RENTALS',vertical?370:325,vertical?1325:1100,25,620,dark?muted:'#59606D',600)}
  ${textBlock('PREPARATION SERIES',96,vertical?1550:1253,24,720,dark?muted:'#59606D',500)}
  ${textBlock(`${String(index+1).padStart(2,'0')} / ${String(count).padStart(2,'0')}`,vertical?815:820,vertical?1550:1253,25,170,fg,600)}
  ${Array.from({length:count},(_,n)=>`<rect x="${96+n*(870/count+8)}" y="${vertical?1590:1280}" width="${870/count-8}" height="5" rx="2" fill="${n===index?amber:dark?'#343C49':'#D4D1CA'}"/>`).join('')}
  </svg>`;
};
const write = async (relative,data) => { const full=path.join(root,relative); await fs.mkdir(path.dirname(full),{recursive:true}); await fs.writeFile(full,data); };
const run = (cmd,args) => new Promise((resolve,reject) => { const child=spawn(cmd,args,{cwd:root,windowsHide:true,stdio:['ignore','ignore','pipe']}); let error=''; child.stderr.on('data',b=>error=(error+b).slice(-4000)); child.on('error',reject); child.on('exit',code=>code===0?resolve():reject(new Error(`${cmd} exited ${code}: ${error}`))); });
const stamp = secs => `00:00:${String(secs).padStart(2,'0')},000`;
const allScenes=[];
await fs.mkdir(out,{recursive:true});
for(const video of campaign.videos){
  const folder=`assets/videos/${video.id}`;
  for(let i=0;i<video.scenes.length;i++){
    const svg=sceneSvg(video.scenes[i],i,4,true,video.audience==='Owners');
    await write(`${folder}/scene-${i+1}.svg`,svg);
    await write(`${folder}/scene-${i+1}.png`,await sharp(Buffer.from(svg)).png().toBuffer());
    allScenes.push({file:`${folder}/scene-${i+1}.png`,label:`${video.id} / ${i+1}`});
  }
  await write(`${folder}/caption-facebook-instagram.txt`,`${video.caption}\n\n#Pinpoint #WesternCape #RoomRentals\n`);
  await write(`${folder}/caption-tiktok.txt`,`${video.tiktokCaption}\n\n#Pinpoint #WesternCape #RoomRentals\n`);
  await write(`${folder}/optional-voiceover.txt`,`${video.voiceover}\n`);
  await write(`${folder}/${video.id}.srt`,video.scenes.map((s,i)=>`${i+1}\n${stamp(i*6)} --> ${stamp((i+1)*6-1).replace(',000',',900')}\n${s.heading}\n${s.body}\n`).join('\n'));
  const concat=video.scenes.map((_,i)=>`file 'scene-${i+1}.png'\nduration 6`).join('\n')+"\nfile 'scene-4.png'\n";
  await write(`${folder}/sequence.txt`,concat);
  if(!process.argv.includes('--skip-video')){
    await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',path.join(out,'videos',video.id,'sequence.txt'),'-f','lavfi','-i','anullsrc=channel_layout=stereo:sample_rate=48000','-t','24','-r','30','-vf','format=yuv420p,fade=t=in:st=0:d=0.2,fade=t=out:st=23.8:d=0.2','-c:v','libx264','-preset','veryfast','-crf','21','-threads','2','-c:a','aac','-b:a','96k','-movflags','+faststart',path.join(out,'videos',video.id,`${video.id}.mp4`)]);
    console.log(`Rendered ${video.id}: 1080x1920, 24 seconds`);
  }
}
for(const carousel of campaign.carousels){
  const folder=`assets/carousels/${carousel.id}`;
  for(let i=0;i<carousel.slides.length;i++){
    const svg=sceneSvg(carousel.slides[i],i,6,false,carousel.audience==='Owners');
    await write(`${folder}/slide-${String(i+1).padStart(2,'0')}.svg`,svg);
    await write(`${folder}/slide-${String(i+1).padStart(2,'0')}.png`,await sharp(Buffer.from(svg)).png().toBuffer());
    allScenes.push({file:`${folder}/slide-${String(i+1).padStart(2,'0')}.png`,label:`${carousel.id} / ${i+1}`});
  }
  await write(`${folder}/caption-facebook-instagram.txt`,`${carousel.caption}\n\n#Pinpoint #WesternCape #RoomRentals\n`);
}
const profileSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080"><rect width="1080" height="1080" fill="${ink}"/>${logo(260,260,560,true)}</svg>`;
await write('assets/profile/profile.svg',profileSvg);
await write('assets/profile/profile.png',await sharp(Buffer.from(profileSvg)).png().toBuffer());
const cover=`<svg xmlns="http://www.w3.org/2000/svg" width="1640" height="720"><rect width="1640" height="720" fill="${ink}"/>${logo(430,145,100,true)}${textBlock('Pinpoint',555,222,78,650,paper,650)}${textBlock('Western Cape rooms',430,355,73,1000,paper,700)}${textBlock('Get ready for your next rental search.',430,435,40,1050,'#C3C7CF')}${textBlock('PREPARING TO LAUNCH',430,530,30,900,'#E8BC66',600)}</svg>`;
await write('assets/profile/facebook-cover.svg',cover);
await write('assets/profile/facebook-cover.png',await sharp(Buffer.from(cover)).png().toBuffer());

const dateAt=day=>new Date(`${campaign.startDate}T12:00:00+02:00`).getTime()+(day-1)*86400000;
const isoDate=day=>new Date(dateAt(day)).toISOString().slice(0,10);
const assets=[...campaign.videos.map(v=>({...v,format:'Video',file:`assets/videos/${v.id}/${v.id}.mp4`,thumbnail:`assets/videos/${v.id}/scene-1.png`})),...campaign.carousels.map(c=>({...c,format:'Carousel',file:`assets/carousels/${c.id}/slide-01.png`,thumbnail:`assets/carousels/${c.id}/slide-01.png`}))].sort((a,b)=>a.day-b.day);
const activity = {
  1:'Create profiles; add bios, profile image and cover; identify three appropriate groups.',
  3:'Community contribution 1; invite three relevant owners individually after checking fit.',
  5:'Reply to owners; record authority and permissions; prepare the next week as drafts.',
  7:'Community contribution 2; review results and actual effort.',
  8:'Batch the next two supplied videos; prepare owner intake and footage requests.',
  10:'Community contribution 3; aim for three additional owner conversations.',
  12:'Owner follow-up; request facts and footage only from interested owners.',
  14:'Community contribution 4; review supply and enquiry logs.',
  15:'Check whether a real walkthrough can replace V05; otherwise keep the supplied fallback.',
  17:'Community contribution 5; aim for three additional owner conversations.',
  19:'Reconfirm property facts and permissions; ask participating owners to share approved features.',
  21:'Community contribution 6; review renter questions and listing coverage.',
  22:'Prepare final week; choose content using real questions, keeping the existing cadence.',
  24:'Community contribution 7; aim for the final three owner conversations.',
  26:'Recheck any advertised availability; update owner and enquiry records.',
  28:'Community contribution 8; reconcile weekly metrics and actual spend.',
  29:'Run the readiness checklist with evidence; keep failed and untested gates open.',
  30:'Decide: continue organic preparation, or prepare the first capped ad tranche after every gate passes.'
};
const calendar=Array.from({length:30},(_,i)=>{
  const day=i+1,a=assets.find(p=>p.day===day);
  return {day,date:isoDate(day),time:a?'18:30':'',assetId:a?.id??'',format:a?.format??'Task',audience:a?.audience??'Operations',title:a?.title??activity[day]??'Replies and light follow-up.',status:a?'Ready':'Planned',actualPublishedDate:'',destinations:a?(a.format==='Video'?'Facebook; Instagram; TikTok':'Facebook; Instagram'):'',notes:a?'Preparation CTA. Upload manually or schedule after accounts are connected.':'Do not count invitations as owner conversations.'};
});
await write('calendar.json',JSON.stringify(calendar,null,2)+'\n');
const csv=(rows)=>'\uFEFF'+rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\r\n')+'\r\n';
await write('calendar.csv',csv([Object.keys(calendar[0]),...calendar.map(Object.values)]));
await write('calendar.md',`# 30-day working calendar\n\n${campaign.startDate} to ${campaign.endDate}. All publishing times are Africa/Johannesburg (SAST). Dates are proposed; nothing is scheduled. Shift Day 1 if account creation takes longer.\n\n| Day | Date | Time | Asset / activity | Destinations | Status |\n|---:|---|---|---|---|---|\n${calendar.map(r=>`| ${r.day} | ${r.date} | ${r.time||'—'} | ${r.assetId?`**${r.assetId}** — `:''}${r.title} | ${r.destinations||'—'} | ${r.status} |`).join('\n')}\n\nEight videos and four carousels are unique original assets. Cross-posts do not increase the original-post count. Group contributions reuse the supplied drafts. On Days 29–30, review the whole campaign rather than adding two more production days.\n`);
await write('content-library.md',`# Finished copy and scripts\n\nAll copy below uses the preparation CTA. Do not convert it into an availability claim without real, current facts and a tested listing link.\n\n${assets.map(a=>`## ${a.id}: ${a.title}\n\nDay ${a.day} · ${a.audience} · ${a.format}\n\n### Facebook and Instagram\n\n${a.caption}\n\n#Pinpoint #WesternCape #RoomRentals\n${a.tiktokCaption?`\n### TikTok\n\n${a.tiktokCaption}\n\n#Pinpoint #WesternCape #RoomRentals\n`:''}${a.voiceover?`\n### Optional voiceover\n\n${a.voiceover}\n`:''}\n### ${a.format==='Video'?'Scene text, six seconds each':'Slides'}\n\n${(a.scenes??a.slides).map((s,i)=>`${i+1}. **${s.heading}** ${s.body}`).join('\n')}\n`).join('\n')}\n`);

const columns=8,thumbW=180,thumbH=340,padding=16,rows=Math.ceil(allScenes.length/columns);
const composites=[];
for(let i=0;i<allScenes.length;i++){
  const source=allScenes[i],top=Math.floor(i/columns)*(thumbH+padding),left=(i%columns)*(thumbW+padding);
  const buffer=await sharp(path.join(root,source.file)).resize(thumbW,thumbH-28,{fit:'contain',background:'#ffffff'}).png().toBuffer();
  const label=Buffer.from(`<svg width="${thumbW}" height="28"><rect width="100%" height="100%" fill="white"/><text x="6" y="20" font-family="Arial" font-size="16">${source.label}</text></svg>`);
  composites.push({input:buffer,left,top},{input:label,left,top:top+thumbH-28});
}
await write('verification/asset-contact-sheet.png',await sharp({create:{width:columns*(thumbW+padding),height:rows*(thumbH+padding),channels:3,background:'#ffffff'}}).composite(composites).png().toBuffer());

const cards=assets.map(a=>`<article class="asset" data-audience="${esc(a.audience)}"><div class="visual"><img loading="lazy" src="${a.thumbnail}" alt="${esc(a.title)} cover"/>${a.format==='Video'?`<video controls preload="none" poster="${a.thumbnail}" src="${a.file}"></video>`:''}</div><div class="copy"><p class="meta">DAY ${a.day} · ${a.id} · ${a.format.toUpperCase()}</p><h3>${esc(a.title)}</h3><p class="audience">${esc(a.audience)}</p><p class="caption">${esc(a.caption)}</p><button type="button" data-copy="${esc(a.caption+'\n\n#Pinpoint #WesternCape #RoomRentals')}">Copy Facebook / Instagram caption</button>${a.tiktokCaption?`<button type="button" data-copy="${esc(a.tiktokCaption+'\n\n#Pinpoint #WesternCape #RoomRentals')}">Copy TikTok caption</button>`:''}<a class="download" href="${a.file}" download>Download ${a.format==='Video'?'MP4':'slide 1'}</a>${a.format==='Carousel'?`<details><summary>All six slides</summary><div class="slides">${a.slides.map((s,i)=>`<a href="assets/carousels/${a.id}/slide-${String(i+1).padStart(2,'0')}.png" download><img src="assets/carousels/${a.id}/slide-${String(i+1).padStart(2,'0')}.png" alt="Slide ${i+1}: ${esc(s.heading)}"/></a>`).join('')}</div></details>`:''}</div></article>`).join('');
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pinpoint · Western Cape launch kit</title><style>
:root{color-scheme:light;--ink:${ink};--amber:${amber};--paper:${paper}}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:"Segoe UI",Arial,sans-serif;line-height:1.55}header{background:var(--ink);color:#fbfaf7;padding:42px max(24px,calc((100vw - 1240px)/2));}header .brand{display:flex;align-items:center;gap:12px;font-size:23px;font-weight:650}header img{width:44px;height:44px}h1{font-size:clamp(34px,5vw,62px);line-height:1.08;max-width:900px;margin:34px 0 20px;letter-spacing:-1.8px}header p{max-width:760px;color:#c6cbd4;font-size:18px}header .eyebrow{color:#e8bc66;text-transform:uppercase;letter-spacing:1.8px;font-size:13px;margin-top:28px}main{max-width:1288px;padding:32px 24px 80px;margin:auto}nav{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 28px}a{color:inherit}nav a,.filters button{border:1px solid #cbc8c0;border-radius:10px;padding:11px 15px;text-decoration:none;background:#fbfaf7;font-size:14px;min-height:44px}.status{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;border-bottom:1px solid #d0ccc4;padding-bottom:28px;margin-bottom:32px}.status strong{display:block;font-size:28px}.status span{color:#59606d;font-size:14px}.note{padding:18px 20px;border-left:4px solid var(--amber);background:#fbfaf7;max-width:100%;margin:24px 0 32px}.filters{display:flex;gap:8px;margin-bottom:24px}.filters button[aria-pressed=true]{background:var(--ink);color:white;border-color:var(--ink)}button{cursor:pointer;font-family:inherit}button:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid #a16a0d;outline-offset:4px}.asset{display:grid;grid-template-columns:250px 1fr;gap:28px;background:#fbfaf7;border:1px solid #d9d5cd;border-radius:20px;padding:20px;margin-bottom:24px;overflow:hidden}.visual{position:relative;border-radius:12px;overflow:hidden;background:var(--ink);align-self:start}.visual>img{display:block;width:100%}.visual video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}.meta{font-size:12px;letter-spacing:1.3px;color:#655c4a;font-weight:650;margin-top:6px}.copy h3{font-size:29px;line-height:1.2;max-width:760px;letter-spacing:-.5px}.audience{display:inline-block;margin:0;padding:3px 12px;border-radius:20px;background:#ebe6db;font-size:13px}.caption{max-width:750px;white-space:pre-wrap;font-size:16px}.copy button,.download{display:inline-block;background:var(--ink);color:#fbfaf7;border:0;border-radius:9px;padding:11px 14px;margin:8px 7px 8px 0;font-size:14px;min-height:44px;text-decoration:none}.copy button+button{background:#e8e3d9;color:var(--ink)}.download{background:none;color:var(--ink);border:1px solid #cbc8c0}.slides{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px}.slides img{display:block;width:100%;border-radius:9px}summary{cursor:pointer;min-height:44px;padding:10px 0}.toast{position:fixed;bottom:24px;right:24px;background:var(--ink);color:white;padding:14px 22px;border-radius:10px;display:none}.asset[hidden]{display:none}footer{border-top:1px solid #d0ccc4;padding-top:28px;color:#59606d;font-size:14px}#calendar{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px;margin:16px 0 32px}th,td{padding:10px 12px;border-bottom:1px solid #d9d5cd;text-align:left;vertical-align:top}th{background:var(--ink);color:white}h2{font-size:28px;letter-spacing:-.5px} @media(max-width:680px){.asset{grid-template-columns:1fr;padding:16px}.visual{max-width:280px;margin:auto}.status{grid-template-columns:1fr;gap:15px}.copy h3{font-size:25px}.slides{grid-template-columns:repeat(2,1fr)}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style></head><body><header><div class="brand"><img src="assets/profile/profile.svg" alt="Pinpoint mark">Pinpoint</div><p class="eyebrow">Western Cape · rooms + affordable rentals</p><h1>Your first month of content is ready.</h1><p>Faceless videos, rental checklists and owner preparation posts. Start organically while the accounts and genuine listing supply are prepared.</p></header><main><nav aria-label="Launch kit documents"><a href="calendar.md">30-day calendar</a><a href="profiles-and-publishing.md">Profile setup</a><a href="owner-outreach-and-ugc.md">Owners + UGC</a><a href="readiness-and-measurement.md">Readiness + measurement</a><a href="outputs/pinpoint-western-cape-20261025/Pinpoint-Western-Cape-Tracker.xlsx" download>Download tracker</a><a href="research-shortlist.csv" download>Prospect shortlist</a><a href="assets/profile/profile.png" download>Profile image</a><a href="assets/profile/facebook-cover.png" download>Facebook cover</a></nav><div class="status"><div><strong>8 videos + 4 carousels</strong><span>12 original assets, reused across channels</span></div><div><strong>R0 advertising</strong><span>Future test stays gated on readiness</span></div><div><strong>3h 15m / week</strong><span>Production, distribution and follow-up</span></div></div><p class="note"><strong>Prepared, not published.</strong> You will create the accounts. No social network was connected at the last Metricool check. The calendar begins 26 October 2026 and can shift. Real property features require footage, permission, current facts and a tested listing link. These videos use captions and a silent audio track; voiceover scripts are supplied.</p><h2>Upload library</h2><div class="filters" aria-label="Filter assets"><button type="button" aria-pressed="true" data-filter="All">All assets</button><button type="button" aria-pressed="false" data-filter="Renters">For renters</button><button type="button" aria-pressed="false" data-filter="Owners">For owners</button></div>${cards}<section id="calendar"><h2>Your posting dates</h2><table><thead><tr><th>Date · SAST</th><th>Asset</th><th>Post</th><th>Audience</th></tr></thead><tbody>${assets.map(a=>`<tr><td>${isoDate(a.day)} · 18:30</td><td>${a.id}</td><td>${esc(a.title)}</td><td>${a.audience}</td></tr>`).join('')}</tbody></table></section><footer>Prepared 25 October 2026. Accounts, publication, listing availability and product journeys remain separate live tasks. Use README.md for the current checkpoint and source links.</footer></main><div class="toast" role="status" aria-live="polite"></div><script>
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));document.querySelectorAll('.asset').forEach(a=>a.hidden=button.dataset.filter!=='All'&&a.dataset.audience!==button.dataset.filter)}));
document.querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',async()=>{try{if(!navigator.clipboard)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(button.dataset.copy);const toast=document.querySelector('.toast');toast.textContent='Caption copied';toast.style.display='block';setTimeout(()=>toast.style.display='none',2200)}catch{let field=button.closest('.copy').querySelector('textarea');if(!field){field=document.createElement('textarea');field.readOnly=true;field.rows=6;field.style.width='100%';field.style.font='inherit';field.style.padding='12px';field.setAttribute('aria-label','Caption ready to copy');button.after(field)}field.value=button.dataset.copy;field.focus();field.select();const toast=document.querySelector('.toast');toast.textContent='Caption selected. Copy the selected text.';toast.style.display='block';setTimeout(()=>toast.style.display='none',3000)}}));
</script></body></html>`;
await write('index.html',html);
await write('assets/manifest.json',JSON.stringify({preparedOn:campaign.preparedOn,videos:campaign.videos.map(v=>({id:v.id,file:`videos/${v.id}/${v.id}.mp4`,width:1080,height:1920,durationSeconds:24,audio:'silent AAC; optional voiceover script supplied',status:'Ready, not published'})),carousels:campaign.carousels.map(c=>({id:c.id,slides:6,width:1080,height:1350,status:'Ready, not published'})),profile:{width:1080,height:1080},facebookCover:{width:1640,height:720}},null,2)+'\n');
console.log('Kit built: 8 videos, 24 carousel slides, calendar, captions, contact sheet and gallery.');
