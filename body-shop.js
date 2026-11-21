import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const PROJECT_URL='https://nxlovetjigddieykrzny.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_jGV44_1rCOu4IyA-ZEcjFQ_WoMWq9HJ';
const el=id=>document.getElementById(id);
const notice=message=>{el('notice').textContent=message;};
const configured=PUBLISHABLE_KEY.startsWith('sb_publishable_');
const client=configured?createClient(PROJECT_URL,PUBLISHABLE_KEY):null;
let currentUser=null;
async function refresh(){
 if(!client)return;
 const {data:{user},error}=await client.auth.getUser();
 currentUser=error?null:user;
 el('auth').hidden=!!currentUser;el('account').hidden=!currentUser;el('application').hidden=true;
 if(!currentUser)return;
 el('who').textContent=currentUser.email||'';el('status').textContent='Loading application...';
 const {data,error:err}=await client.from('body_shops').select('business_name,status').eq('owner_user_id',currentUser.id).maybeSingle();
 if(err){el('status').textContent='Unable to load application. '+err.message;return;}
 el('status').textContent=data?`${data.business_name} — ${data.status}`:'No application submitted yet.';
 el('application').hidden=!!data;
}
el('login').addEventListener('submit',async e=>{e.preventDefault();if(!client)return;const {error}=await client.auth.signInWithPassword({email:el('email').value.trim(),password:el('password').value});if(error){notice(error.message);return;}notice('');await refresh();});
el('signup').addEventListener('click',async()=>{if(!client||!el('login').reportValidity())return;const {data,error}=await client.auth.signUp({email:el('email').value.trim(),password:el('password').value,options:{emailRedirectTo:new URL('body-shop.html',location.href).href}});if(error){notice(error.message);return;}notice(data.session?'Account created.':'Check your email to confirm your account.');await refresh();});
el('logout').addEventListener('click',async()=>{if(!client)return;const {error}=await client.auth.signOut();if(error){notice(error.message);return;}el('application').reset();notice('Signed out.');await refresh();});
el('application').addEventListener('submit',async e=>{e.preventDefault();if(!client||!currentUser)return;const button=e.currentTarget.querySelector('button');button.disabled=true;try{const fields=Object.fromEntries(new FormData(e.currentTarget));for(const k of Object.keys(fields))fields[k]=fields[k].trim()||null;fields.state=fields.state?.toUpperCase();const {error}=await client.from('body_shops').insert({...fields,owner_user_id:currentUser.id,email:currentUser.email,status:'pending'});if(error){notice('Application failed: '+error.message);return;}notice('Application submitted for review.');await refresh();}finally{button.disabled=false;}});
if(client)refresh();else notice('Setup required: configure the browser-safe Supabase publishable key.');
