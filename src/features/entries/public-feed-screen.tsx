"use client";
import { SpecialDetailsProvider, SpecialDetailSurface, useSpecialDetails } from "@/features/discovery/special-details";
import { DiscoveryClock } from "@/features/discovery/discovery-clock";
import { SavedSpecialsProvider } from "@/features/discovery/saved-specials-client";
import Link from "next/link";
import { useDiscoveryControls } from "@/features/discovery/url-controls";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PinpointHeader, DiscoverySortPills } from "@/components/navigation/pinpoint-header";
import { DiscoveryShell } from "@/features/discovery/discovery-shell";
import { DiscoveryMapLoader } from "@/features/discovery/discovery-map-loader";
import { DiscoveryLocationAction } from "@/features/discovery/location-action";
import { EntryFeedCard } from "./entry-feed-card";
import { observeDiscoveryRefresh } from "@/features/discovery/refresh";
import { LocationSelector } from "@/features/map-discovery/location-selector";
import { haversineKm } from "@/features/map-discovery/lib/distance";
import { Button } from "@/components/ui/button";
import type { DiscoveryPlace } from "@/features/places/place";
import type { EntryCategory } from "./schema";
import { publicEntryFeedSchema, type PublicEntryFeed } from "./public-contract";
import { entryFeedHref } from "./public-url";
export function PublicEntryFeedScreen(props: Parameters<typeof PublicEntryFeedScreenContent>[0]) {
  return <SpecialDetailsProvider category={props.category}><PublicEntryFeedScreenContent key={props.category + ":" + (props.areaId ?? "none") + ":" + (props.page ?? 1) + ":" + String(props.invalid ?? false)} {...props} /></SpecialDetailsProvider>;
}

function PublicEntryFeedScreenContent({category,areaId,page=1,place:initialPlace,initial,invalid=false,mapApiKey}:{category:EntryCategory;areaId:string|null;page?:number;place:DiscoveryPlace|null;initial:PublicEntryFeed|null;invalid?:boolean;view?:"feed"|"map";mapApiKey?:string}) {
  const details=useSpecialDetails();
  const view="map";
  const router=useRouter(),[place,setPlace]=useState(initialPlace),[feed,setFeed]=useState(initial),[checking,setChecking]=useState(!!areaId),[error,setError]=useState(false),[retry,setRetry]=useState(0),[selected,setSelected]=useState<string>();
  const {query,setQuery,sort,setSort,withControls}=useDiscoveryControls(["Ending soon","Latest","Nearest"]);
  const label=category==="event"?"Events":"Places";
  useEffect(()=>{if(!areaId||invalid)return;let disposed=false,sequence=0;let request:AbortController|undefined,alarm:ReturnType<typeof setTimeout>|undefined;
    async function refresh(){request?.abort();const controller=new AbortController();request=controller;const current=++sequence,started=performance.now();setChecking(true);
      try{
        if(!place){const response=await fetch("/api/places/"+areaId,{cache:"no-store",signal:controller.signal});if(!response.ok)throw new Error();const location=(await response.json()).data.place as DiscoveryPlace;if(location.id!==areaId)throw new Error();if(!disposed&&!controller.signal.aborted)setPlace(location);}
        const response=await fetch(`/api/entries?category=${category}&areaId=${areaId}&page=${page}`,{cache:"no-store",signal:controller.signal});if(!response.ok)throw new Error();const fresh=publicEntryFeedSchema.parse(await response.json());
        if(fresh.category!==category||fresh.areaId!==areaId||fresh.page!==page)throw new Error();if(disposed||controller.signal.aborted||current!==sequence)return;
        clearTimeout(alarm);const now=Date.parse(fresh.serverNow),elapsed=performance.now()-started;
        const items=fresh.items.filter(item=>Date.parse(item.content.endsAt)-now>elapsed);
        if(items.length!==fresh.items.length||items.some(item=>item.state==="upcoming"&&Date.parse(item.content.startsAt)-now<=elapsed)){
          setFeed(null);setError(false);alarm=setTimeout(()=>void refresh(),100);return;
        }
        setFeed({...fresh,items});setChecking(false);setError(false);
        const boundaries=items.flatMap(item=>[Date.parse(item.content.endsAt)-now,...(item.state==="upcoming"?[Date.parse(item.content.startsAt)-now]:[])]).filter(ms=>ms>elapsed);
        if(boundaries.length)alarm=setTimeout(()=>{setFeed(null);void refresh();},Math.min(Math.max(0,Math.min(...boundaries)-elapsed),2_147_483_647));
      }catch{if(!disposed&&!controller.signal.aborted&&current===sequence){if(alarm===undefined)setFeed(null);setChecking(false);setError(true);}}
    }
    void refresh();const stop=observeDiscoveryRefresh(refresh);return()=>{disposed=true;request?.abort();clearTimeout(alarm);stop();};
  },[areaId,category,page,place,invalid,retry]);
  const items=useMemo(()=>{const term=query.trim().toLocaleLowerCase();return(feed?.items??[]).filter(item=>[item.content.title,item.content.description,item.content.venueName,item.content.address].some(text=>text.toLocaleLowerCase().includes(term))).sort((a,b)=>sort==="Latest"?Date.parse(b.approvedAt)-Date.parse(a.approvedAt):sort==="Nearest"&&place?haversineKm(place.center,{lat:a.content.latitude,lng:a.content.longitude})-haversineKm(place.center,{lat:b.content.latitude,lng:b.content.longitude}):Date.parse(a.content.endsAt)-Date.parse(b.content.endsAt));},[feed,query,sort,place]);
  const points=useMemo(()=>items.map(item=>({id:item.entryId,title:item.content.title,latitude:item.content.latitude,longitude:item.content.longitude})),[items]);
  const select=(id:string)=>{setSelected(id);if(details?.id)details.open(id);document.getElementById("entry-"+id)?.scrollIntoView({block:"nearest",behavior:"smooth"});};
  const selectedItem=items.find(item=>item.entryId===selected);
  const selectedCard=selectedItem&&!details?.id?<EntryFeedCard item={selectedItem} selected expanded onClose={()=>setSelected(undefined)}/>:undefined;
  const header=<PinpointHeader category="specials" addHref={`/post/entries/${category}`} view={view} areaId={areaId} area={place?.fullAddress} count={!checking&&!error?feed?.totalCount:undefined}
    location={<LocationSelector idPrefix="entry-feed" selectedLocation={place?.label} onSelect={location=>router.push(withControls(entryFeedHref(category,location.id,view,1,location.fullAddress)))}/>}
    searchActive={Boolean(query)} searchHint="Filter this page" search={<form role="search" onSubmit={event=>event.preventDefault()}><input type="search" value={query} onChange={event=>setQuery(event.target.value)} aria-label="Search specials on this page" placeholder="Search specials or venues" className="bg-transparent outline-none"/>{query ? <button type="button" className="min-h-11 min-w-11 text-sm font-semibold text-forest" onClick={() => setQuery("")} aria-label="Clear specials search">Clear</button> : null}</form>}
    toolbar={<DiscoverySortPills options={["Ending soon","Latest","Nearest"]} value={sort} onChange={setSort}/>}/>;
  const results=<div className="space-y-5 px-5 py-6"><header className="space-y-3"><h1 className="text-2xl font-semibold">{label} Specials{place?" in "+place.label:" nearby"}</h1><p className="text-sm text-muted-foreground">Approved {category==="event"?"events, including upcoming dates":"experiences available now"}. Read the venue and dates before travelling.</p></header>
    <div aria-label="Special type" className="flex flex-wrap gap-2">{(["Shopping","Places","Events"] as const).map(kind=><Link key={kind} aria-current={(category==="event"?kind==="Events":kind==="Places")?"page":undefined} className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-semibold aria-[current=page]:bg-forest aria-[current=page]:text-primary-foreground" href={kind==="Shopping"?"/offers?"+new URLSearchParams({view,...(areaId?{areaId}:{}),...(place?{area:place.fullAddress}:{})}):entryFeedHref(kind==="Places"?"tourism":"event",areaId,view,1,place?.fullAddress)}>{kind}</Link>)}</div>
    {invalid?<p role="alert" className="text-status-error-text">This location link is unavailable. Choose another location.</p>:!areaId?<div className="space-y-4"><p>Choose a location to see {label.toLowerCase()} specials.</p><DiscoveryLocationAction idPrefix="entry-feed" /></div>:<>
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-3"><p role="status" className="text-sm">{checking?"Checking specials…":error?"Specials could not be checked.":feed?`${feed.totalCount} ${category === "event" ? (feed.totalCount === 1 ? "event" : "events") : (feed.totalCount === 1 ? "experience" : "experiences")} · ${items.length} shown on this page`:"Loading specials…"}</p><Button variant="outline" disabled={checking} onClick={()=>setRetry(value=>value+1)}>Refresh specials</Button></div>
      {error?<p role="alert" className="text-status-error-text">Could not load specials. Refresh or choose another location.</p>:feed?<>
        {feed.items.length===0?<div className="space-y-3"><p>No current {label.toLowerCase()} specials in this area.</p><DiscoveryLocationAction idPrefix="entry-feed">Choose another location</DiscoveryLocationAction></div>:null}
        {feed.items.length>0&&items.length===0?<p>No specials match your search on this page.</p>:null}
        <p className="text-xs text-muted-foreground">Search and sorting apply to this page. Nearest uses the selected location’s centre.</p>
        <ul className="space-y-4">{items.map(item=><li id={"entry-"+item.entryId} key={item.entryId}><EntryFeedCard item={item} selected={selected===item.entryId} onShowOnMap={view==="map"?()=>select(item.entryId):undefined} /></li>)}</ul>
        <nav aria-label="Specials pages" className="flex gap-5">{page>1?<Link className="inline-flex min-h-11 items-center underline" href={withControls(entryFeedHref(category,areaId,view,page-1,place?.fullAddress))}>Previous specials</Link>:null}{feed.hasNext?<Link className="inline-flex min-h-11 items-center underline" href={withControls(entryFeedHref(category,areaId,view,page+1,place?.fullAddress))}>Next specials</Link>:null}</nav>
      </>:null}
    </>}
  </div>;
  return <DiscoveryClock serverNow={feed?.serverNow ?? "2026-01-01T00:00:00Z"}><SavedSpecialsProvider><DiscoveryShell detail={details?.id ? <SpecialDetailSurface /> : undefined} onboarding={!areaId} header={header} results={results} view={view} resultsLabel="Specials near the map" map={<DiscoveryMapLoader place={place} points={points} mapApiKey={mapApiKey} selectedId={selected} onSelect={select} selectedCard={selectedCard} onCloseSelection={()=>setSelected(undefined)} categoryLabel="Specials"/>}/></SavedSpecialsProvider></DiscoveryClock>;
}
