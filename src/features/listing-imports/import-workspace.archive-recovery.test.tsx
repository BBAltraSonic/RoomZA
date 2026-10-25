// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}));
vi.mock('next/dynamic',()=>({default:()=>()=>null}));
vi.mock('@/lib/supabase/browser',()=>({createClient:()=>({channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:vi.fn()})}));
vi.mock('@zip.js/zip.js',()=>{throw new Error('Controlled ZIP library download failure');});
import {ImportWorkspace} from './import-workspace';
import type {ImportJobSummary} from './types';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',agent='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const job:ImportJobSummary={id,organizationId:id,sourceKind:'json',sourceName:'archive.json',stage:'resolving',version:1,totalRows:0,processedRows:0,validRows:0,warningRows:0,blockedRows:0,committedRows:0,failedRows:0,heartbeatAt:null,updatedAt:'2026-10-25T00:00:00Z',messageCode:null,messageDetail:null};
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});
it('reports a ZIP library load failure and releases all upload controls without writing',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn(async(_url:RequestInfo|URL,_init?:RequestInit)=>Response.json({ok:true,data:{job,rows:[],assets:[],nextCursor:null}}));vi.stubGlobal('fetch',fetcher);
 render(<ImportWorkspace initialJob={job} initialConfiguration={{mapping:{},defaults:{responsibleAgentId:agent},selection:{mode:'explicit',included:[]},sourceMetadata:{headers:[]},sheetName:null,recordPath:null}} initialRows={[]} initialNextCursor={null} agents={[{id:agent,label:'Contained owner',role:'owner'}]}/>);
 const panel=[...document.querySelectorAll('details')].find(x=>x.querySelector('summary')?.textContent?.includes('Images'));if(panel)panel.open=true;
 await act(async()=>{await vi.advanceTimersByTimeAsync(1);});
 const archive=screen.getByLabelText('Upload ZIP archive') as HTMLInputElement;
 await act(async()=>{fireEvent.change(archive,{target:{files:[new File(['declared fixture'],'images.zip',{type:'application/zip'})]}});await Promise.resolve();});
 for(const label of ['Upload ZIP archive','Upload images','Upload image folder'])expect((screen.getByLabelText(label) as HTMLInputElement).disabled).toBe(false);
 expect(screen.getByRole('alert').textContent).toMatch(/ZIP archive could not be processed safely/i);
 expect(fetcher.mock.calls.every(([,init])=>!init?.method||init.method==='GET')).toBe(true);
});
