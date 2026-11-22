import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { createPhotoManager } from './dealer-photos.js';
const PROJECT_URL = 'https://nxlovetjigddieykrzny.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_jGV44_1rCOu4IyA-ZEcjFQ_WoMWq9HJ';
const $ = id => document.getElementById(id);
const notice = message => { $('notice').textContent = message; };
const vehicleNotice = message => { $('vehicle-notice').textContent = message; };
const supabase = createClient(PROJECT_URL,PUBLISHABLE_KEY,{auth:{detectSessionInUrl:true,persistSession:true}});
const photos = createPhotoManager(supabase);
const statusLabels = {pending:'Pending review',approved:'Approved',rejected:'Not approved',suspended:'Suspended'};
let currentDealership=null, generation=0, currentUser=null;
function setTab(tab){$('signup').hidden=tab!=='signup';$('login').hidden=tab!=='login';$('tab-signup').setAttribute('aria-pressed',String(tab==='signup'));$('tab-login').setAttribute('aria-pressed',String(tab==='login'));notice('');}
$('tab-signup').addEventListener('click',()=>setTab('signup'));
$('tab-login').addEventListener('click',()=>setTab('login'));
async function loadVehicles(){
 const dealer=currentDealership, token=generation;
 if(!dealer||dealer.status!=='approved')return;
 const {data,error}=await supabase.from('vehicles').select('id,year,make,model,vin,price,status,created_at').eq('dealership_id',dealer.id).order('created_at',{ascending:false}).limit(100);
 if(token!==generation)return;
 const list=$('vehicle-list');list.replaceChildren();
 if(error){vehicleNotice('Unable to load vehicle inventory.');return;}
 if(!data.length){const p=document.createElement('p');p.textContent='No vehicles submitted yet.';list.append(p);return;}
 for(const v of data){const item=document.createElement('div');const p=document.createElement('p');p.textContent=`${v.year} ${v.make} ${v.model} | VIN ${v.vin} | $${Number(v.price).toLocaleString('en-US')} | ${v.status}`;item.append(p);if(v.status==='draft'){const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent='Manage photographs';b.setAttribute('aria-label',`Manage photographs for ${v.year} ${v.make} ${v.model}, VIN ${v.vin}`);b.addEventListener('click',()=>{if(token===generation&&currentDealership?.id===dealer.id)photos.open(v);});item.append(b);}list.append(item);}
}
async function render(user){
 const token=++generation; currentUser=user?.id||null;photos.close();currentDealership=null;
 $('authenticated').hidden=!user;$('signup').hidden=!!user;$('login').hidden=true;$('tab-signup').hidden=!!user;$('tab-login').hidden=!!user;$('inventory').hidden=true;$('vehicle-list').replaceChildren();$('application').hidden=true;$('application-result').hidden=true;
 if(!user){setTab('login');return;}
 $('user-email').textContent=user.email||'';$('contact-email').value=user.email||'';
 const {data,error}=await supabase.from('dealerships').select('id,legal_name,status,created_at').eq('owner_user_id',user.id).maybeSingle();
 if(token!==generation)return;
 if(error){notice('Could not check your application. Please try again.');return;}
 if(data){$('application-result').hidden=false;$('application-result').textContent=`${data.legal_name} — ${statusLabels[data.status]||data.status}. Submitted ${new Date(data.created_at).toLocaleDateString()}.`;if(data.status==='approved'){currentDealership=data;$('inventory').hidden=false;await loadVehicles();}}else $('application').hidden=false;
}
$('signup').addEventListener('submit',async e=>{e.preventDefault();const email=$('signup-email').value.trim(),password=$('signup-password').value;const {error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:new URL('dealer.html',location.href).href}});notice(error?'Unable to create account. Check your details and try again.':'If this address can register, you will receive an email confirmation link. After confirming, return here and sign in.');});
$('login').addEventListener('submit',async e=>{e.preventDefault();const {data,error}=await supabase.auth.signInWithPassword({email:$('login-email').value.trim(),password:$('login-password').value});if(error)return notice('Unable to sign in. Check your credentials and confirm your email.');notice('Signed in.');if(currentUser!==data.user.id)await render(data.user);});
$('logout').addEventListener('click',async()=>{photos.close();const {error}=await supabase.auth.signOut();if(error)return notice('Unable to sign out. Please try again.');await render(null);location.reload();});
$('application').addEventListener('submit',async e=>{e.preventDefault();const {data:{user}}=await supabase.auth.getUser();if(!user)return notice('Please sign in first.');const record={owner_user_id:user.id,legal_name:$('legal-name').value.trim(),contact_name:$('contact-name').value.trim(),email:$('contact-email').value.trim(),phone:$('phone').value.trim()||null,city:$('city').value.trim(),state:'GA',dealer_license_number:$('license').value.trim(),status:'pending'};const {error}=await supabase.from('dealerships').insert(record);if(error)return notice(error.code==='23505'?'An application already exists for this account.':'Unable to submit your application. Please try again or contact support.');notice('Application received. NEWGIGZ will review your dealership information and license before approving listings.');if(currentUser===user.id)await render(user);});
$('vehicle-form').addEventListener('submit',async e=>{e.preventDefault();if(!currentDealership||currentDealership.status!=='approved')return vehicleNotice('An approved dealership is required.');const token=generation;const vin=$('vehicle-vin').value.trim().toUpperCase();if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin))return vehicleNotice('Enter a valid 17-character VIN (excluding I, O and Q).');const record={dealership_id:currentDealership.id,vin,year:Number($('vehicle-year').value),make:$('vehicle-make').value.trim(),model:$('vehicle-model').value.trim(),trim:$('vehicle-trim').value.trim()||null,mileage:Number($('vehicle-mileage').value),price:Number($('vehicle-price').value),description:$('vehicle-description').value.trim()||null,status:'draft'};const button=$('vehicle-submit');button.disabled=true;vehicleNotice('Saving draft...');try{const {error}=await supabase.from('vehicles').insert(record);if(token!==generation)return;if(error)return vehicleNotice('Unable to save draft. Check the vehicle details and dealership approval status.');$('vehicle-form').reset();vehicleNotice('Draft saved successfully. It is not published. Select Manage photographs to add images.');await loadVehicles();}finally{button.disabled=false;}});
supabase.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'){render(null);return;}if(event==='INITIAL_SESSION'||event==='SIGNED_IN'||event==='USER_UPDATED'){setTimeout(()=>{if(event==='INITIAL_SESSION'||currentUser!==(session?.user?.id||null))render(session?.user||null).catch(()=>notice('Unable to load account.'));},0);}});
