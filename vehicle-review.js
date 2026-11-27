import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { createAdminPhotoManager } from './admin-photos.js';
const client=createClient('https://nxlovetjigddieykrzny.supabase.co','sb_publishable_jGV44_1rCOu4IyA-ZEcjFQ_WoMWq9HJ');
const el=id=>document.getElementById(id);
const notice=msg=>{el('notice').textContent=msg;};
const node=(tag,value,cls)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=String(value??'');if(cls)n.className=cls;return n;};
let epoch=0;
const photos=createAdminPhotoManager(client,{onReviewed:async()=>{notice('Photograph review recorded.');await refresh();}});
function clear(){epoch++;photos.clear();el('vehicles').replaceChildren();}
function signedOut(){clear();el('dashboard').hidden=true;el('login-panel').hidden=false;el('admin-email').textContent='';}
async function authorize(){const {data,error}=await client.auth.getUser();if(error||!data?.user)throw new Error('Administrator sign-in required.');const role=await client.rpc('is_auto_club_admin');if(role.error||role.data!==true)throw new Error('Administrator access required.');return data.user;}
function detail(parent,label,value){const d=node('div');d.append(node('strong',label),node('span',value==null||value===''?'Not supplied':value));parent.append(d);}
async function refresh(){clear();const current=epoch;const active=()=>current===epoch;try{
 const user=await authorize();if(!active())return;
 el('login-panel').hidden=true;el('dashboard').hidden=false;el('admin-email').textContent=user.email||'';
 const {data,error}=await client.from('vehicles').select('id,dealership_id,vin,year,make,model,trim,mileage,price,description,status,created_at').order('created_at',{ascending:false}).limit(100);if(error)throw error;if(!active())return;
 const list=el('vehicles');if(!data?.length){list.append(node('p','No vehicle listings have been submitted yet.'));return;}
 const dealers=await client.from('dealerships').select('id,legal_name,status').in('id',[...new Set(data.map(v=>v.dealership_id))]);if(dealers.error)throw dealers.error;if(!active())return;
 const map=new Map((dealers.data||[]).map(d=>[d.id,d]));
 for(const v of data){if(!active())return;const d=map.get(v.dealership_id);const card=node('article',undefined,'vehicle');card.append(node('h3',`${v.year} ${v.make} ${v.model}${v.trim?' '+v.trim:''}`),node('span',v.status,'pill'));
 const meta=node('div',undefined,'meta');detail(meta,'Dealership',d?.legal_name);detail(meta,'Dealer status',d?.status);detail(meta,'VIN',v.vin);detail(meta,'Mileage',v.mileage?.toLocaleString());detail(meta,'Price',v.price==null?'':Number(v.price).toLocaleString('en-US',{style:'currency',currency:'USD'}));detail(meta,'Submitted',new Date(v.created_at).toLocaleString());detail(meta,'Description',v.description);card.append(meta);
 const label=node('label','Vehicle review notes (required for every decision)');const notes=node('textarea');notes.id='vehicle-notes-'+v.id;notes.maxLength=2000;label.htmlFor=notes.id;card.append(label,notes);
 const readiness=node('p','Checking primary photograph status…');readiness.setAttribute('role','status');card.append(readiness);const actions=node('div',undefined,'actions');const buttons=[];let ready=false,busy=false;const test=/^TEST/i.test(v.vin||'');
 const update=()=>{for(const [b,status] of buttons)b.disabled=busy||!notes.value.trim()||(status==='published'&&(!ready||d?.status!=='approved'||test));};
 for(const [status,title,cls] of [['published','Publish',''],['rejected','Reject','danger'],['archived','Archive','secondary']]){const b=node('button',title,cls);b.type='button';buttons.push([b,status]);actions.append(b);b.onclick=async()=>{if(!active()||b.disabled)return;const reason=notes.value.trim();if(!confirm(`Change ${v.year} ${v.make} ${v.model} to ${status}? This decision will be recorded.`))return;busy=true;update();try{await authorize();if(!active())return;const {error}=await client.rpc('review_vehicle',{p_vehicle_id:v.id,p_status:status,p_review_notes:reason});if(error)throw error;if(active()){notice(`Vehicle review recorded: ${status}.`);await refresh();}}catch(e){if(active())notice(`Review failed: ${e.message}`);}finally{busy=false;if(active())update();}};}
 notes.addEventListener('input',update);update();card.append(actions);list.append(card);
 await photos.mount(card,v,d,value=>{if(!active())return;ready=value===true;readiness.textContent=test?'Test listing: publication disabled.':d?.status!=='approved'?'Dealership approval required.':ready?'Approved primary photograph recorded. Storage validity is checked by the database on publication.':'Approved primary photograph required.';update();});
 }
 }catch(e){if(active()){signedOut();notice(e.message||'Unable to load listings.');}}}
el('login').addEventListener('submit',async e=>{e.preventDefault();notice('Signing in…');const {error}=await client.auth.signInWithPassword({email:el('email').value.trim(),password:el('password').value});el('password').value='';if(error){notice('Unable to sign in. Check your credentials.');return;}notice('');await refresh();});
el('refresh').addEventListener('click',refresh);
el('logout').addEventListener('click',async()=>{signedOut();const {error}=await client.auth.signOut();notice(error?'Local dashboard cleared; sign-out failed. Retry or close this browser session.':'Signed out.');});
client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')signedOut();});
refresh();
