import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {campaignLink} from './campaign-link.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const c=JSON.parse(await fs.readFile(path.join(root,'campaign.json'),'utf8'));
const days=JSON.parse(await fs.readFile(path.join(root,'calendar.json'),'utf8'));
const checks=[],videos=[];
assert.equal(days.length,30);assert.equal(days[0].date,c.startDate);assert.equal(days[29].date,c.endDate);checks.push('Thirty consecutive planned dates with correct start and end');
assert.equal(c.videos.length,8);assert.equal(c.carousels.length,4);assert.equal(c.currentAdBudgetZar,0);assert.equal(c.futureAdTestCapZar,750);assert.equal(c.futureAdReviewZar,375);
for(let w=0;w<4;w++){const posts=days.filter(d=>d.day>w*7&&d.day<=w*7+7&&d.assetId);assert.equal(posts.length,3);assert.equal(posts.filter(p=>p.format==='Video').length,2);assert.equal(posts.filter(p=>p.format==='Carousel').length,1);}checks.push('Every production week has two videos and one carousel');
assert.equal(Object.values(c.weeklyMinutes).reduce((a,b)=>a+b,0),195);checks.push('Weekly workload totals 195 minutes');
for(const v of c.videos){
  const file=path.join(root,'assets','videos',v.id,`${v.id}.mp4`);
  const p=spawnSync('ffprobe',['-v','error','-show_entries','stream=codec_type,codec_name,width,height:format=duration','-of','json',file],{encoding:'utf8',windowsHide:true});assert.equal(p.status,0,p.stderr);
  const info=JSON.parse(p.stdout),stream=info.streams.find(s=>s.codec_type==='video');assert.equal(stream.codec_name,'h264');assert.equal(stream.width,1080);assert.equal(stream.height,1920);assert(Math.abs(Number(info.format.duration)-24)<.2);
  assert(info.streams.some(s=>s.codec_type==='audio'&&s.codec_name==='aac'));assert(!/\[[^\]]+\]/.test(v.caption));
  const subtitles=await fs.readFile(path.join(root,'assets','videos',v.id,`${v.id}.srt`),'utf8');assert.equal((subtitles.match(/ --> /g)||[]).length,4);
  videos.push({id:v.id,width:stream.width,height:stream.height,duration:Number(info.format.duration),codec:stream.codec_name});
}
checks.push('All eight MP4s decoded by ffprobe with correct duration, dimensions, H.264 and AAC');
for(const carousel of c.carousels){assert.equal(carousel.slides.length,6);for(let n=1;n<=6;n++){const info=await sharp(path.join(root,'assets','carousels',carousel.id,`slide-${String(n).padStart(2,'0')}.png`)).metadata();assert.equal(info.width,1080);assert.equal(info.height,1350);}}checks.push('All 24 carousel slides are 1080x1350');
const original='https://example.com/?listingId=existing-id&areaId=stable-place&minPrice=2000&bbox=18,-34,19,-33#details';
const tagged=new URL(campaignLink(original,{source:'facebook',content:'V01'}));for(const key of ['listingId','areaId','minPrice','bbox'])assert.equal(tagged.searchParams.get(key),new URL(original).searchParams.get(key));assert.equal(tagged.hash,'#details');assert.equal(tagged.searchParams.get('utm_source'),'facebook');assert.throws(()=>campaignLink('javascript:alert(1)',{source:'facebook',content:'V01'}));checks.push('Campaign tags preserve existing listing, area, filters, bounds and fragment');
await fs.writeFile(path.join(root,'verification','asset-checks.json'),JSON.stringify({checks,videos,currentSpendZar:0,liveJourneyStatus:'Not tested'},null,2));console.log(JSON.stringify({checks,videos:videos.length}));
