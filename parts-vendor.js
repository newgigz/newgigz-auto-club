import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
// Only use the browser-safe publishable key from the NEWGIGZ Auto Club project.
// NEVER use a secret or service_role key here.
const PROJECT_URL = 'https://nxlovetjigddieykrzny.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_jGV44_1rCOu4IyA-ZEcjFQ_WoMWq9HJ';
const $ = id => document.getElementById(id);
const notice = message => { $('notice').textContent = message; };
const configured = PUBLISHABLE_KEY.startsWith('sb_publishable_') || PUBLISHABLE_KEY.startsWith('eyJ');
const client = configured ? createClient(PROJECT_URL, PUBLISHABLE_KEY) : null;
if (!configured) notice('Setup required: add your Supabase publishable key to parts-vendor.js.');
function showSignedIn(user) {
  $('auth-panel').hidden = Boolean(user);
  $('vendor-panel').hidden = !user;
  if (user) $('signed-email').textContent = user.email || '';
}
async function loadApplication(user) {
  $('vendor-form').hidden = true;
  $('application-status').textContent = 'Checking application status...';
  const {data,error} = await client.from('parts_vendors')
    .select('id,business_name,status,created_at')
    .eq('owner_user_id',user.id).maybeSingle();
  if(error) { $('application-status').textContent = 'Unable to load your application.'; notice(error.message); return; }
  if(data) {
    $('application-status').textContent = `${data.business_name}: ${data.status}. Submitted ${new Date(data.created_at).toLocaleDateString()}.`;
  } else {
    $('application-status').textContent = 'No application submitted yet.';
    $('vendor-form').hidden = false;
  }
}
async function checkSession() {
  if(!client) return;
  const {data:{user},error} = await client.auth.getUser();
  if(error || !user) { showSignedIn(null); return; }
  showSignedIn(user);
  await loadApplication(user);
}
async function authenticate(mode) {
  if(!client) return;
  const email = $('email').value.trim();
  const password = $('password').value;
  if(!email || !password || password.length < 6) { notice('Enter your email and a password of at least 6 characters.'); return; }
  $('sign-in').disabled = $('sign-up').disabled = true;
  try {
    if(mode==='signup') {
      const {error} = await client.auth.signUp({email,password,options:{emailRedirectTo:new URL('parts-vendor.html',location.href).href}});
      notice(error ? error.message : 'Registration received. Check your email for confirmation, then sign in.');
    } else {
      const {error} = await client.auth.signInWithPassword({email,password});
      if(error) { notice('Sign-in failed. Check your credentials and email confirmation.'); return; }
      notice(''); await checkSession();
    }
  } finally { $('sign-in').disabled = $('sign-up').disabled = false; }
}
$('sign-in').addEventListener('click',()=>authenticate('signin'));
$('sign-up').addEventListener('click',()=>authenticate('signup'));
$('sign-out').addEventListener('click',async()=>{ if(client) await client.auth.signOut();showSignedIn(null);notice('Signed out.'); });
$('vendor-form').addEventListener('submit',async e=>{
  e.preventDefault(); if(!client)return;
  const {data:{user},error:userError}=await client.auth.getUser();
  if(userError || !user){notice('Sign in again before applying.');return;}
  $('apply').disabled=true;
  const application={owner_user_id:user.id,business_name:$('business-name').value.trim(),contact_name:$('contact-name').value.trim(),email:user.email,phone:$('phone').value.trim()||null,city:$('city').value.trim(),state:$('state').value.trim(),business_registration_number:$('registration').value.trim()||null,status:'pending'};
  const {error}=await client.from('parts_vendors').insert(application);
  $('apply').disabled=false;
  if(error){notice(`Application could not be submitted: ${error.message}`);return;}
  notice('Application submitted for administrator review.');
  await loadApplication(user);
});
if(client) checkSession();
