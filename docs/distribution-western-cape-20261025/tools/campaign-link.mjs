// Add campaign tags to an existing Share URL without replacing its state.
export function campaignLink(input, { source, medium='organic_social', content, campaign='wc_rooms_prelaunch_20261026' }) {
  const url=new URL(input);
  if(!['https:','http:'].includes(url.protocol)) throw new Error('Use an http or https URL.');
  if(!['facebook','instagram','tiktok'].includes(source)) throw new Error('Source must be facebook, instagram or tiktok.');
  if(!['organic_social','paid_social'].includes(medium)) throw new Error('Use organic_social or paid_social.');
  if(!content || !/^[A-Za-z0-9_-]{1,80}$/.test(content)) throw new Error('Supply an asset or group code, such as V01 or G01.');
  url.searchParams.set('utm_source',source); url.searchParams.set('utm_medium',medium);
  url.searchParams.set('utm_campaign',campaign); url.searchParams.set('utm_content',content);
  return url.toString();
}
if(process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\','/'))){
  const [input,source,content,medium,campaign]=process.argv.slice(2);
  if(!input){console.error('Usage: node campaign-link.mjs <existing-share-url> <facebook|instagram|tiktok> <V01|G01> [organic_social|paid_social] [campaign-name]');process.exitCode=1;}
  else {try{console.log(campaignLink(input,{source,content,medium,campaign}));}catch(error){console.error(error.message);process.exitCode=1;}}
}
