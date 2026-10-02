import { createClient } from '@supabase/supabase-js';
export function movementRequestId() {
 if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
 // Mobile LAN previews can be HTTP; getRandomValues remains available there.
 const bytes=globalThis.crypto.getRandomValues(new Uint8Array(16));
 bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
}
export function onlineConfig(env=import.meta.env) {
 const url=env?.VITE_SUPABASE_URL?.trim(),key=env?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
 if(!url||!key)throw new Error('Online ainda não configurado. Preencha VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env.local e reinicie o jogo.');
 if(!/^https?:\/\//.test(url))throw new Error('VITE_SUPABASE_URL precisa ser a URL do projeto Supabase.');
 return {url,key};
}
export function createRoomClient({client,clock=()=>performance.now(),onChange=()=>{}}={}) {
 if(!client){const {url,key}=onlineConfig();client=createClient(url,key);}
 let room=null,userId=null,channel=null,timer=null,disposed=false,offset=0,lastReceived=-Infinity;
 let status='connecting',error='',polling=false;
 const snapshot=()=>({room,userId,slot:room?.host_id===userId?0:1,status,error,
  now:clock()+offset,connected:!!room&&!disposed&&clock()-lastReceived<7000});
 function notify(){if(!disposed)onChange(snapshot());}
 function accept(next){
  if(!disposed&&(!room||next.id!==room.id||next.revision>=room.revision)){room=next;notify();}
 }
 async function rpc(action,extra={}) {
  if(disposed)throw new Error('Sala encerrada neste aparelho.');
  const started=clock();
  const {data,error:failure}=await client.rpc('aura_room_action',{p_action:action,...(room?{p_room:room.id}:{}),...extra})
   .abortSignal(AbortSignal.timeout(12000));
  if(disposed)return null;
  if(failure)throw new Error(failure.message||'Não foi possível conectar ao Supabase.');
  offset=data.server_now-(started+clock())/2;lastReceived=clock();error='';
  accept(data.room);return data.room;
 }
 async function sync(){
  if(disposed||polling||!room)return;
  polling=true;
  try{await rpc('sync');}catch(e){error=e.message;status='reconnecting';notify();}finally{polling=false;}
 }
 async function open(action,code) {
  const {data,error:sessionError}=await client.auth.getSession();
  if(sessionError)throw new Error(sessionError.message);
  let session=data.session;
  if(!session){const result=await client.auth.signInAnonymously();if(result.error)throw new Error('Não foi possível autenticar. Ative Anonymous Sign-Ins no Supabase. '+result.error.message);session=result.data.session;}
  if(disposed)return;
  userId=session.user.id;
  await rpc(action,code?{p_code:code}:{});
  if(disposed)return;
  channel=client.channel('aura-room-'+room.id).on('postgres_changes',
   {event:'UPDATE',schema:'public',table:'aura_rooms',filter:'id=eq.'+room.id},payload=>{
    lastReceived=clock();error='';accept(payload.new);
   }).subscribe(next=>{
    if(disposed)return;
    status=next==='SUBSCRIBED'?'realtime':'reconnecting';notify();
    if(next==='SUBSCRIBED')void sync();
   });
  timer=setInterval(()=>void sync(),2000);
  // Read again after subscribing: a guest may enter before the subscription is ready.
  await sync();
  return room;
 }
 return {snapshot,open,ready:()=>rpc('ready'),replay:()=>rpc('replay'),sync,
  move:(key,request=movementRequestId())=>rpc('move',{p_key:key,p_request:request,p_match:room.match_no,p_round:room.round_no}),
  async leave(){try{if(room)await rpc('leave');}finally{this.dispose();}},
  dispose(){if(disposed)return;disposed=true;clearInterval(timer);if(channel)void client.removeChannel(channel);},
 };
}
