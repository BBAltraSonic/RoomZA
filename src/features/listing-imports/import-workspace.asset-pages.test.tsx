// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}));
vi.mock('next/dynamic',()=>({default:()=>()=>null}));
vi.mock('@/lib/supabase/browser',()=>({createClient:()=>({channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:vi.fn()})}));
import {ImportWorkspace} from '@/features/listing-imports/import-workspace';
import type {ImportJobSummary} from '@/features/listing-imports/types';
import type {WorkspaceRow} from '@/features/listing-imports/import-rows-table';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',rowId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',agent='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const job:ImportJobSummary={id,organizationId:id,sourceKind:'json',sourceName:'images.json',stage:'resolving',version:4,totalRows:1,processedRows:1,validRows:0,warningRows:1,blockedRows:0,committedRows:0,failedRows:0,heartbeatAt:null,updatedAt:'2026-10-25T00:00:00Z',messageCode:null,messageDetail:null};
const row:WorkspaceRow={id:rowId,row_version:1,row_number:1,state:'publish_blocked',normalized_data:{title:'Synthetic image home',address:'Synthetic address',listingType:'rent',price:8000,responsibleAgentId:agent},duplicate_candidate_ids:[],duplicate_strategy:null,duplicate_listing_id:null,publication_selected:false,resulting_listing_id:null,listing_import_issues:[]};
const image=(number:number)=>({id:`dddddddd-dddd-4ddd-8ddd-${String(number).padStart(12,'0')}`,row_id:rowId,state:'matched',source_name:`page-${number}.png`,mime_type:'image/png',size_bytes:68,sort_order:0,is_cover:true,match_method:'explicit',rejection_code:null,updated_at:'2026-10-25T00:00:00Z'});
function setup(){
 vi.useFakeTimers();let fail=false;const reads:string[]=[];const writes:unknown[]=[];
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(String(input),'http://localhost');
  if(url.pathname.endsWith('/assets')){
   if(init?.method==='PATCH'){writes.push(JSON.parse(String(init.body)));return Response.json({ok:true,data:{assetId:image(2).id}});}
   const cursor=url.searchParams.get('cursor')??'';reads.push(cursor);
   if(fail&&cursor==='second')return new Response('<html>Unavailable</html>',{status:503});
   return Response.json({ok:true,data:{assets:[image(cursor==='second'?2:1)],nextCursor:cursor==='second'?null:'second'}});
  }
  return Response.json({ok:true,data:{job,rows:[row],nextCursor:null}});
 }));
 render(<ImportWorkspace initialJob={job} initialConfiguration={{mapping:{},defaults:{responsibleAgentId:agent},selection:{mode:'explicit',included:[]},sourceMetadata:{headers:[]},sheetName:null,recordPath:null}} initialRows={[row]} initialNextCursor={null} agents={[{id:agent,label:'Contained owner',role:'owner'}]}/>);
 const details=[...document.querySelectorAll('details')].find(x=>x.querySelector('summary')?.textContent?.includes('Images'));if(details)details.open=true;
 return {reads,writes,setFailure:(value:boolean)=>{fail=value;}};
}
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});
it('navigates bounded image pages and returns to the original page without duplicate reads',async()=>{
 const fixture=setup();await act(async()=>{await vi.advanceTimersByTimeAsync(1);});
 expect(screen.getByText('page-1.png')).toBeTruthy();
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Next images'}));});
 expect(screen.getByText('page-2.png')).toBeTruthy();expect(screen.queryByText('page-1.png')).toBeNull();
 expect((screen.getByRole('button',{name:'Next images'}) as HTMLButtonElement).disabled).toBe(true);
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Previous images'}));});
 expect(screen.getByText('page-1.png')).toBeTruthy();expect(fixture.reads).toEqual(['','second','']);
});
it('keeps the current images when a later page fails and retries that exact page',async()=>{
 const fixture=setup();await act(async()=>{await vi.advanceTimersByTimeAsync(1);});fixture.setFailure(true);
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Next images'}));});
 expect(screen.getByText('page-1.png')).toBeTruthy();expect(screen.getByRole('alert').textContent).toMatch(/load saved images/i);
 fixture.setFailure(false);await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Retry image loading'}));});
 expect(screen.getByText('page-2.png')).toBeTruthy();expect(screen.queryByRole('alert')).toBeNull();expect(fixture.reads).toEqual(['','second','second']);
});
it('refreshes the same image page after an actual arrangement response',async()=>{
 const fixture=setup();await act(async()=>{await vi.advanceTimersByTimeAsync(1);});
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Next images'}));});
 await act(async()=>{fireEvent.click(screen.getByRole('checkbox',{name:'Cover for page-2.png'}));});
 expect(fixture.writes).toHaveLength(1);expect(fixture.reads).toEqual(['','second','second']);expect(screen.getByText('page-2.png')).toBeTruthy();
});
