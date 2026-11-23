import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const client=createClient('https://nxlovetjigddieykrzny.supabase.co','sb_publishable_jGV44_1rCOu4IyA-ZEcjFQ_WoMWq9HJ');
const root=document.createElement('section');root.id='document-review-panel';root.hidden=true;root.className='panel';
root.innerHTML='<h2>Dealer document verification</h2><p>Verify both PDFs against official Georgia records before approving any application. Only authorized NEWGIGZ administrators may access these documents.</p><p><a href="https://verify.sos.ga.gov/verification/Search.aspx?facility=Y" target="_blank" rel="noopener noreferrer">Georgia dealer license lookup (official)</a></p><button id="doc-review-refresh" type="button">Refresh document reviews</button><p id="doc-review-notice" role="status" aria-live="polite"></p><div id="doc-review-list"></div>';
const dashboard=document.getElementById('dashboard');if(dashboard)dashboard.append(root);
const msg=s=>{document.getElementById('doc-review-notice').textContent=s;};
const txt=(tag,value)=>{const n=document.createElement(tag);n.textContent=value;return n;};
async function refresh(){
 const {data:{user}}=await client.auth.getUser();if(!user){root.hidden=true;return;}
 const {data:isAdmin,error:roleError}=await client.rpc('is_auto_club_admin');if(roleError||isAdmin!==true){root.hidden=true;return;}
 root.hidden=false;
 const {data:dealers,error}=await client.from('dealerships').select('id,legal_name,status,dealer_license_number').order('created_at',{ascending:false}).limit(100);
 if(error){msg('Could not load dealerships.');return;}
 const list=document.getElementById('doc-review-list');list.replaceChildren();
 for(const dealer of dealers){
  const card=document.createElement('article');card.className='application';card.append(txt('h3',`${dealer.legal_name} (${dealer.status})`),txt('p',`License number: ${dealer.dealer_license_number||'Not supplied'}`));
  const {data:docs,error:docError}=await client.from('dealership_documents').select('id,document_type,storage_path,original_filename,uploaded_at,verified_at,verification_notes').eq('dealership_id',dealer.id);
  if(docError){card.append(txt('p','Unable to load documents.'));list.append(card);continue;}
  for(const [type,label] of [['formation','Business formation document'],['dealer_license','Dealership license']]){
   const doc=(docs||[]).find(d=>d.document_type===type);const section=document.createElement('div');section.style.marginBottom='1rem';section.append(txt('h4',label));
   if(!doc){section.append(txt('p','Missing document'));card.append(section);continue;}
   section.append(txt('p',`${doc.original_filename} | ${doc.verified_at?'Verified':'Awaiting verification'}`));
   const view=txt('button','Open private PDF');view.type='button';view.className='secondary';view.onclick=async()=>{
    const {data,error:linkError}=await client.storage.from('dealer-verification').createSignedUrl(doc.storage_path,60);
    if(linkError||!data?.signedUrl)return msg('Unable to open private PDF. Check administrator access.');
    const a=document.createElement('a');a.href=data.signedUrl;a.target='_blank';a.rel='noopener noreferrer';document.body.append(a);a.click();a.remove();
   };section.append(view);
   if(!doc.verified_at){
    const labelEl=txt('label','Verification notes (source, date, legal name and license match)');const notes=document.createElement('textarea');notes.maxLength=2000;notes.required=true;labelEl.append(notes);section.append(labelEl);
    const confirmLabel=txt('label',' I reviewed this document and independently verified its authenticity.');const checkbox=document.createElement('input');checkbox.type='checkbox';confirmLabel.prepend(checkbox);section.append(confirmLabel);
    const approve=txt('button','Mark document verified');approve.type='button';approve.onclick=async()=>{
     if(!checkbox.checked||notes.value.trim().length<15)return msg('Confirm independent verification and enter meaningful notes.');
     if(!confirm(`Mark ${label} for ${dealer.legal_name} as verified?`))return;
     approve.disabled=true;
     const {data:{user}}=await client.auth.getUser();
     const {error:updateError}=await client.from('dealership_documents').update({verified_by:user.id,verified_at:new Date().toISOString(),verification_notes:notes.value.trim()}).eq('id',doc.id).is('verified_at',null);
     if(updateError){approve.disabled=false;return msg('Verification failed: '+updateError.message);}
     msg('Verification recorded. Refresh the dealership review above before approval.');await refresh();
    };section.append(approve);
   }else section.append(txt('p',doc.verification_notes||'No notes recorded'));
   card.append(section);
  }list.append(card);
 }
}
document.getElementById('doc-review-refresh')?.addEventListener('click',()=>refresh().catch(()=>msg('Unable to refresh documents.')));
client.auth.onAuthStateChange(()=>{setTimeout(()=>refresh().catch(()=>msg('Unable to load document reviews.')),0);});
refresh().catch(()=>msg('Unable to load document reviews.'));
