import {beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({rpc:vi.fn(),user:vi.fn(),admin:vi.fn()}));
vi.mock("@/lib/auth",()=>({requireUser:mocks.user}));
vi.mock("@/features/admin/auth",()=>({requireAdmin:mocks.admin}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({rpc:mocks.rpc})}));
import {confirmEntryPermission,decideEntry} from "./publication-data";
const entryId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",revisionId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const command={category:"event",entryId,revisionId,expectedVersion:3,permissionConfirmed:true};
beforeEach(()=>{vi.resetAllMocks();mocks.user.mockResolvedValue({user:{id:entryId}});mocks.admin.mockResolvedValue({user:{id:entryId}});});
describe("Revision-bound publication adapter",()=>{
 it("retains a replacement pending review when an older approval is unpublished",async()=>{const result={entryId,category:"event",version:4,pendingRevisionId:revisionId};mocks.rpc.mockResolvedValue({data:result,error:null});await expect(decideEntry({category:"event",entryId,expectedVersion:3,decision:"unpublish",reason:"Remove earlier approval"})).resolves.toEqual(result);expect(mocks.rpc).toHaveBeenCalledWith("pinpoint_entry_unpublish",{category:"event",target:entryId,expected_version:3,reason:"Remove earlier approval"});});
 it("forbids caller actor/publication claims and mismatched persisted permission scope",async()=>{await expect(confirmEntryPermission({...command,posterId:entryId})).rejects.toThrow();expect(mocks.rpc).not.toHaveBeenCalled();mocks.rpc.mockResolvedValue({data:{entryId,category:"tourism",revisionId,confirmed:true,version:3},error:null});await expect(confirmEntryPermission(command)).rejects.toThrow("response mismatch");});
 it("keeps a real database conflict without retrying or claiming approval",async()=>{const conflict={code:"PT409"};mocks.rpc.mockResolvedValue({data:null,error:conflict});await expect(decideEntry({...command,permissionConfirmed:undefined,decision:"approve",authorityNotes:"Evidence",locationNotes:"Venue checked",mediaState:"none",reviewed:true})).rejects.toBeDefined();const input={category:"event",entryId,revisionId,expectedVersion:3,decision:"approve",authorityNotes:"Evidence",locationNotes:"Venue checked",mediaState:"none",reviewed:true};await expect(decideEntry(input)).rejects.toBe(conflict);expect(mocks.rpc).toHaveBeenCalledTimes(1);});
 it("runs the current account/MFA gate before a mutation and refuses wrong-version success",async()=>{mocks.admin.mockRejectedValueOnce(new Error("MFA required"));await expect(decideEntry({category:"event",entryId,expectedVersion:3,decision:"unpublish",reason:"Remove"})).rejects.toThrow("MFA required");expect(mocks.rpc).not.toHaveBeenCalled();mocks.rpc.mockResolvedValue({data:{entryId,category:"event",version:3,pendingRevisionId:null},error:null});await expect(decideEntry({category:"event",entryId,expectedVersion:3,decision:"unpublish",reason:"Remove"})).rejects.toThrow("response mismatch");});
});
