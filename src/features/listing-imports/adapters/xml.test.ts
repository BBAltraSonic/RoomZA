import {describe,expect,it} from 'vitest';
import {xmlAdapter} from './xml';
describe('XML listing source discovery',()=>{
 it.each([['<feed><listing><ref>A</ref><title>Single home</title></listing></feed>','/feed/listing'],['<listing><ref>A</ref><title>Single home</title></listing>','/listing']])('inspects one listing without a repeated sibling (%s)',async(source,path)=>{const result=await xmlAdapter.inspect(source);expect(result.recordPaths).toEqual([path]);expect(result.estimatedRows).toBe(1);expect(result.headers).toEqual(['ref','title']);expect(xmlAdapter.parseChunk(source,{recordPath:path,limit:10})).toEqual([{rowNumber:1,raw:{ref:'A',title:'Single home'}}]);});
 it('keeps separate record candidates explicit',async()=>{const result=await xmlAdapter.inspect('<feed><rental><title>Rental</title></rental><sale><title>Sale</title></sale></feed>');expect(result.recordPaths).toEqual(['/feed/rental','/feed/sale']);expect(result.headers).toEqual([]);expect(result.warnings).not.toHaveLength(0);});
 it('excludes containers without scalar listing fields',()=>{expect(xmlAdapter.discoverRecordPaths?.('<feed><empty/><listing><title>Home</title><address><street>Test street</street></address></listing></feed>')).toEqual(['/feed/listing/address','/feed/listing']);});
 it.each(['<feed><listing></feed>','<!DOCTYPE x [<!ENTITY a SYSTEM "file:///test">]><feed>&a;</feed>'])('refuses malformed or entity-bearing documents (%s)',source=>{expect(()=>xmlAdapter.inspect(source)).toThrow();});
});
